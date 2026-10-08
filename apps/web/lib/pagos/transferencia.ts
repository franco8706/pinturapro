import "server-only";

import { createHash } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { recalcularAcceso } from "./acceso";
import { notifyUser, emailLayout, html } from "@/lib/email";
import {
  codigoDeTransferencia,
  leerExtracto,
  transferenciaAlcanza,
  fechaAR,
  VALIDEZ_DEL_COBRO_DIAS,
  sumarDias,
} from "@pinturapro/dominio";

/**
 * La transferencia: el medio de pago de la suscripción que no depende de ninguna empresa
 * (decisión del dueño, 6/10/2026: "no quiero quedar supeditado a un solo medio de pago").
 *
 *  1. El pintor ve en "Mi plan" el alias, el CBU, el monto del día (US$5 al dólar oficial) y SU
 *     código ("PP-0037"), y avisa "Ya transferí": queda un cobro pendiente por ese monto, que
 *     vale 3 días.
 *  2. El dueño carga el extracto del banco en /admin → Cobro. Cada línea con un código conocido y
 *     un monto que alcanza (al menos el 97 % del pedido: el dólar se mueve) registra el pago en el
 *     libro y le suma un mes de acceso al pintor. Lo que no alcanza queda "para revisar".
 *  3. También se puede confirmar o rechazar a mano.
 *
 * El mismo extracto cargado dos veces no registra nada dos veces: cada línea entra al libro con un
 * id que sale de su propio texto (`unique (proveedor, tipo, proveedor_evento_id)`).
 */

export interface DatosDeTransferencia {
  alias: string;
  cbu: string | null;
  titular: string;
}

/** La cuenta del negocio, de las variables de entorno. Sin alias, el medio no está disponible. */
export function datosDeTransferencia(): DatosDeTransferencia | null {
  const alias = process.env.TRANSFERENCIA_ALIAS?.trim();
  const titular = process.env.TRANSFERENCIA_TITULAR?.trim();
  if (!alias || !titular) return null;
  return { alias, titular, cbu: process.env.TRANSFERENCIA_CBU?.trim() || null };
}

/** El código fijo del pintor ("PP-0037"). Se asigna la primera vez que hace falta. */
export async function codigoDelPintor(pintorId: string): Promise<string> {
  const admin = createAdminClient();
  const { data, error } = await admin.from("codigos_de_pago").select("numero").eq("pintor_id", pintorId).maybeSingle();
  if (error) throw new Error(`código de transferencia: ${error.message}`);
  if (data) return codigoDeTransferencia((data as { numero: number }).numero);
  // El alta devuelve el número. NO se vuelve a leer con la misma consulta: en una página de
  // servidor, Next memoriza los GET idénticos del mismo render y devolvía la primera lectura
  // (vacía) — el pintor nuevo nunca veía su código (8/10/2026).
  const alta = await admin.from("codigos_de_pago").insert({ pintor_id: pintorId } as never).select("numero").single();
  const nuevo: unknown = alta.data;
  if (!alta.error && nuevo) return codigoDeTransferencia((nuevo as { numero: number }).numero);
  if (alta.error?.code !== "23505") throw new Error(`código de transferencia: ${alta.error?.message ?? "sin respuesta"}`);
  // Otro pedido lo creó a la vez: se relee con OTRA consulta (por lo mismo de arriba).
  const otra = await admin.from("codigos_de_pago").select("numero, pintor_id").eq("pintor_id", pintorId).limit(1);
  const numero = (otra.data as { numero: number }[] | null)?.[0]?.numero;
  if (!numero) throw new Error("no se pudo asignar el código de transferencia");
  return codigoDeTransferencia(numero);
}

export interface CobroDeTransferencia {
  id: string;
  montoArs: number;
  codigo: string;
  venceEn: string;
  estado: string;
}

/**
 * "Ya transferí": deja un cobro pendiente con el monto del día. Si ya hay uno vigente, devuelve
 * ése (apretar dos veces no crea dos). Necesita una cotización vigente: sin dólar no hay monto.
 */
export async function avisarTransferencia(pintorId: string): Promise<CobroDeTransferencia | { error: string }> {
  const admin = createAdminClient();
  const ahora = new Date();
  const { data: abierto } = await admin
    .from("cobros")
    .select("id, monto_ars, codigo, vence_en, estado")
    .eq("pintor_id", pintorId)
    .eq("medio", "transferencia")
    .eq("estado", "pendiente")
    .gt("vence_en", ahora.toISOString())
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (abierto) {
    const c = abierto as { id: string; monto_ars: number; codigo: string; vence_en: string; estado: string };
    return { id: c.id, montoArs: c.monto_ars, codigo: c.codigo, venceEn: c.vence_en, estado: c.estado };
  }

  const [plan, cotizacion, precio] = await Promise.all([
    admin.from("planes").select("precio_usd").eq("id", "pintor").maybeSingle(),
    admin.rpc("cotizacion_vigente"),
    admin.rpc("precio_ars", { plan: "pintor" } as never),
  ]);
  const filaCotizacion: unknown = Array.isArray(cotizacion.data) ? cotizacion.data[0] : cotizacion.data;
  const montoArs: unknown = precio.data;
  if (!filaCotizacion || typeof montoArs !== "number" || !plan.data) {
    return { error: "Todavía no tenemos la cotización del dólar de hoy. Probá en un rato." };
  }
  const codigo = await codigoDelPintor(pintorId);
  const venceEn = sumarDias(ahora, VALIDEZ_DEL_COBRO_DIAS).toISOString();
  const { data, error } = await admin
    .from("cobros")
    .insert({
      pintor_id: pintorId,
      plan_id: "pintor",
      medio: "transferencia",
      monto_usd: Number((plan.data as { precio_usd: number | string }).precio_usd),
      monto_ars: montoArs,
      cotizacion_id: (filaCotizacion as { id: number }).id,
      codigo,
      estado: "pendiente",
      vence_en: venceEn,
    } as never)
    .select("id")
    .single();
  if (error || !data) return { error: "No pudimos registrar el aviso. Probá de nuevo." };
  return { id: (data as { id: string }).id, montoArs, codigo, venceEn, estado: "pendiente" };
}

/** Registra en el libro el pago de un cobro y le recalcula el acceso al pintor. Idempotente. */
async function registrarPago({
  cobroId,
  pintorId,
  monto,
  cotizacionId,
  eventoId,
  linea,
  confirmadoPor,
}: {
  cobroId: string;
  pintorId: string;
  monto: number;
  cotizacionId: number | null;
  eventoId: string;
  linea: string | null;
  confirmadoPor: string | null;
}): Promise<"registrado" | "ya_estaba"> {
  const admin = createAdminClient();
  const { error } = await admin.from("pagos_suscripcion").insert({
    cobro_id: cobroId,
    pintor_id: pintorId,
    proveedor: "transferencia",
    tipo: "cobro",
    proveedor_evento_id: eventoId,
    monto_ars: monto,
    cotizacion_id: cotizacionId,
    fecha: new Date().toISOString(),
    confirmado_por: confirmadoPor,
    linea_extracto: linea,
  } as never);
  if (error && error.code === "23505") return "ya_estaba";
  if (error) throw new Error(`registrarPago: ${error.message}`);
  await admin.from("cobros").update({ estado: "pagado", pagado_en: new Date().toISOString() } as never).eq("id", cobroId);
  const { vigente } = await recalcularAcceso(pintorId);
  await notifyUser(
    pintorId,
    "Recibimos tu transferencia",
    emailLayout(
      "Tu suscripción está al día",
      html`Confirmamos tu transferencia de $${monto.toLocaleString("es-AR")}.${vigente ? html` Podés cotizar hasta el ${fechaAR(vigente)}.` : html``}`,
    ),
  );
  return "registrado";
}

type FilaCobro = { id: string; pintor_id: string; monto_ars: number; cotizacion_id: number | null; estado: string; codigo: string | null };

/** El admin confirma a mano un aviso de transferencia (vio la plata en el banco). */
export async function confirmarTransferenciaAMano(cobroId: string, adminId: string): Promise<"registrado" | "ya_estaba" | "no_existe"> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("cobros")
    .select("id, pintor_id, monto_ars, cotizacion_id, estado, codigo")
    .eq("id", cobroId)
    .eq("medio", "transferencia")
    .maybeSingle();
  const c = data as FilaCobro | null;
  if (!c || !c.pintor_id) return "no_existe";
  if (c.estado === "pagado") return "ya_estaba";
  return registrarPago({
    cobroId: c.id,
    pintorId: c.pintor_id,
    monto: c.monto_ars,
    cotizacionId: c.cotizacion_id,
    eventoId: `manual:${c.id}`,
    linea: null,
    confirmadoPor: adminId,
  });
}

export interface ResumenDeExtracto {
  lineas: number;
  confirmadas: number;
  yaCargadas: number;
  aRevisar: number;
  sinCodigo: number;
  codigoDesconocido: number;
}

/**
 * Procesa el extracto del banco: cada línea con código y monto que alcanza confirma el cobro de
 * ese pintor; lo que no alcanza queda para revisar. Si el pintor transfirió sin avisar, se arma el
 * cobro en el momento con el precio del día.
 */
export async function procesarExtracto(csv: string, adminId: string): Promise<ResumenDeExtracto> {
  const admin = createAdminClient();
  const lineas = leerExtracto(csv);
  const resumen: ResumenDeExtracto = { lineas: lineas.length, confirmadas: 0, yaCargadas: 0, aRevisar: 0, sinCodigo: 0, codigoDesconocido: 0 };

  for (const l of lineas) {
    if (!l.codigo) {
      resumen.sinCodigo++;
      continue;
    }
    const numero = Number(l.codigo.replace(/^PP-/, ""));
    const { data: delCodigo } = await admin.from("codigos_de_pago").select("pintor_id").eq("numero", numero).maybeSingle();
    const pintorId = (delCodigo as { pintor_id: string } | null)?.pintor_id;
    if (!pintorId) {
      resumen.codigoDesconocido++;
      continue;
    }
    // El id del evento sale del texto de la línea: el mismo extracto dos veces, la misma línea.
    const eventoId = `extracto:${createHash("sha256").update(l.linea).digest("hex").slice(0, 32)}`;
    const { count } = await admin
      .from("pagos_suscripcion")
      .select("id", { count: "exact", head: true })
      .eq("proveedor", "transferencia")
      .eq("proveedor_evento_id", eventoId);
    if (count) {
      resumen.yaCargadas++;
      continue;
    }

    // El cobro que espera: el más reciente sin pagar (pendiente o para revisar).
    const { data: abierto } = await admin
      .from("cobros")
      .select("id, pintor_id, monto_ars, cotizacion_id, estado, codigo")
      .eq("pintor_id", pintorId)
      .eq("medio", "transferencia")
      .in("estado", ["pendiente", "a_revisar", "vencido"])
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    let cobro = abierto as FilaCobro | null;
    if (!cobro) {
      const nuevo = await avisarTransferencia(pintorId);
      if ("error" in nuevo) {
        resumen.aRevisar++;
        continue;
      }
      cobro = { id: nuevo.id, pintor_id: pintorId, monto_ars: nuevo.montoArs, cotizacion_id: null, estado: "pendiente", codigo: nuevo.codigo };
      const { data: conCotizacion } = await admin.from("cobros").select("cotizacion_id").eq("id", nuevo.id).maybeSingle();
      cobro.cotizacion_id = (conCotizacion as { cotizacion_id: number | null } | null)?.cotizacion_id ?? null;
    }

    if (!transferenciaAlcanza(l.monto, cobro.monto_ars)) {
      await admin.from("cobros").update({ estado: "a_revisar" } as never).eq("id", cobro.id);
      resumen.aRevisar++;
      continue;
    }
    const r = await registrarPago({
      cobroId: cobro.id,
      pintorId,
      monto: l.monto,
      cotizacionId: cobro.cotizacion_id,
      eventoId,
      linea: l.linea,
      confirmadoPor: adminId,
    });
    if (r === "registrado") resumen.confirmadas++;
    else resumen.yaCargadas++;
  }
  return resumen;
}
