import "server-only";

import { createHash } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { recalcularAcceso } from "./acceso";
import { notifyUser, emailLayout, html } from "@/lib/email";
import {
  codigoDeTransferencia,
  analizarExtracto,
  fechaDeExtracto,
  transferenciaAlcanza,
  precioEnPesos,
  fechaAR,
  VALIDEZ_DEL_COBRO_DIAS,
  sumarDias,
  type LineaDeExtracto,
} from "@pinturapro/dominio";

/**
 * La transferencia: el medio de pago de la suscripción que no depende de ninguna empresa
 * (decisión del dueño, 6/10/2026: "no quiero quedar supeditado a un solo medio de pago").
 *
 *  1. El pintor ve en "Mi plan" el alias, el CBU, el monto del día (US$5 al dólar oficial) y SU
 *     código ("PP-0037"), y avisa "Ya transferí": queda UN aviso por ese monto, que vale 3 días.
 *  2. El dueño carga el extracto del banco en /admin → Cobro. Una línea se confirma SOLA sólo si
 *     el saldo del extracto la confirma, trae un código conocido, alcanza (≥ 97 % de lo pedido el
 *     día que llegó la plata) y no se parece a un pago de esa misma semana. Todo lo demás queda
 *     "para revisar", con lo que llegó, la línea y el motivo a la vista.
 *  3. "Llegó" registra lo que LLEGÓ (no lo pedido); "No llegó" anula. Un pago se puede devolver.
 *
 * Lo que encontraron abuso-marketplace y dinero-y-comisiones el 8/10/2026, y por qué está así:
 *  · el concepto lo escribe el que transfiere: $1 se leía $7.700 corriendo las columnas → el
 *    lector exige las columnas del encabezado y el saldo (packages/dominio/src/extracto.ts);
 *  · "Llegó" + el extracto, o dos exportaciones del mismo movimiento, daban dos y tres meses por
 *    un pago → una línea parecida a un pago de ±7 días va a revisar;
 *  · un aviso de hacía meses fijaba el precio del dólar viejo → sólo vale el aviso vigente el día
 *    que llegó la plata; si no hay, el precio de ese día;
 *  · el libro se escribía y después el acceso: un corte en el medio dejaba "pagado sin acceso" →
 *    volver a cargar el extracto (o "Llegó") lo repara.
 */

/** Más que esto sobre lo pedido no se confirma solo: un pago de varios meses lo decide el dueño. */
const MAS_DE_LO_PEDIDO = 1.5;
/** Un pago del mismo pintor, por un monto parecido (±3 %) y a menos de esto, es un posible duplicado. */
const VENTANA_DE_DUPLICADO_DIAS = 7;
const MS_DIA = 86_400_000;

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

type Admin = ReturnType<typeof createAdminClient>;

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

/** El precio del plan en dólares. */
async function precioUsd(admin: Admin): Promise<number | null> {
  const { data } = await admin.from("planes").select("precio_usd").eq("id", "pintor").maybeSingle();
  const usd = Number((data as { precio_usd: number | string } | null)?.precio_usd);
  return Number.isFinite(usd) && usd > 0 ? usd : null;
}

type Precio = { montoArs: number; cotizacionId: number };

/**
 * El precio en pesos con el dólar vigente en un momento (el de hoy, o el del día en que llegó la
 * plata). Sale de UNA lectura del dólar: la misma cuenta que `precio_ars()` de la base.
 */
async function precioAl(admin: Admin, usd: number, momento: Date | null): Promise<Precio | null> {
  let fila: { id: number | string; venta: number | string } | undefined;
  if (momento) {
    const { data } = await admin
      .from("cotizaciones_dolar")
      .select("id, venta")
      .eq("estado", "vigente")
      .lte("leida_en", momento.toISOString())
      .order("leida_en", { ascending: false })
      .limit(1);
    fila = ((data ?? []) as unknown as { id: number; venta: number | string }[])[0];
  }
  if (!fila) {
    const { data } = await admin.rpc("cotizacion_vigente");
    const f: unknown = Array.isArray(data) ? data[0] : data;
    fila = (f ?? undefined) as typeof fila;
  }
  if (!fila) return null;
  return { montoArs: precioEnPesos(usd, Number(fila.venta)), cotizacionId: Number(fila.id) };
}

export interface CobroDeTransferencia {
  id: string;
  montoArs: number;
  codigo: string;
  venceEn: string;
  estado: string;
}

type FilaAviso = { id: string; monto_ars: number; monto_usd: number | string; codigo: string; vence_en: string; estado: string; cotizacion_id: number | null };
const COLUMNAS_AVISO = "id, monto_ars, monto_usd, codigo, vence_en, estado, cotizacion_id";

/** El aviso vivo del pintor, si tiene. `relectura`: otra forma de la consulta, para que Next no devuelva una lectura memorizada. */
async function avisoVivo(admin: Admin, pintorId: string, relectura = false): Promise<FilaAviso | null> {
  const { data } = await admin
    .from("cobros")
    .select(relectura ? `${COLUMNAS_AVISO}, created_at` : COLUMNAS_AVISO)
    .eq("pintor_id", pintorId)
    .eq("medio", "transferencia")
    .eq("estado", "pendiente")
    .gt("vence_en", new Date().toISOString())
    .order("created_at", { ascending: false })
    .limit(1);
  return ((data ?? []) as unknown as FilaAviso[])[0] ?? null;
}

const comoCobro = (a: FilaAviso): CobroDeTransferencia => ({ id: a.id, montoArs: a.monto_ars, codigo: a.codigo, venceEn: a.vence_en, estado: a.estado });

/**
 * "Ya transferí": deja un aviso pendiente con el monto del día. Si ya hay uno vigente, devuelve
 * ése (apretar dos veces, o en paralelo, no crea dos: la base admite uno solo vivo por pintor).
 * Los vencidos pasan a `vencido`: ya no fijan el precio. Sin dólar no hay monto.
 */
export async function avisarTransferencia(pintorId: string): Promise<CobroDeTransferencia | { error: string }> {
  const admin = createAdminClient();
  const ahora = new Date();
  await admin
    .from("cobros")
    .update({ estado: "vencido" } as never)
    .eq("pintor_id", pintorId)
    .eq("medio", "transferencia")
    .eq("estado", "pendiente")
    .lte("vence_en", ahora.toISOString());
  const vivo = await avisoVivo(admin, pintorId);
  if (vivo) return comoCobro(vivo);

  const usd = await precioUsd(admin);
  const precio = usd ? await precioAl(admin, usd, null) : null;
  if (!usd || !precio) return { error: "Todavía no tenemos la cotización del dólar de hoy. Probá en un rato." };
  const codigo = await codigoDelPintor(pintorId);
  const venceEn = sumarDias(ahora, VALIDEZ_DEL_COBRO_DIAS).toISOString();
  const { data, error } = await admin
    .from("cobros")
    .insert({
      pintor_id: pintorId,
      plan_id: "pintor",
      medio: "transferencia",
      monto_usd: usd,
      monto_ars: precio.montoArs,
      cotizacion_id: precio.cotizacionId,
      codigo,
      estado: "pendiente",
      vence_en: venceEn,
    } as never)
    .select("id")
    .single();
  if (error?.code === "23505") {
    // Otro "Ya transferí" lo creó a la vez: es ése.
    const otro = await avisoVivo(admin, pintorId, true);
    if (otro) return comoCobro(otro);
  }
  if (error || !data) return { error: "No pudimos registrar el aviso. Probá de nuevo." };
  return { id: (data as { id: string }).id, montoArs: precio.montoArs, codigo, venceEn, estado: "pendiente" };
}

/** Registra en el libro el pago de un cobro y le recalcula el acceso al pintor. Idempotente, y repara. */
async function registrarPago({
  cobroId,
  pintorId,
  monto,
  cotizacionId,
  eventoId,
  linea,
  fechaBanco,
  confirmadoPor,
}: {
  cobroId: string;
  pintorId: string;
  monto: number;
  cotizacionId: number | null;
  eventoId: string;
  linea: string | null;
  /** "2026-10-08": el día que llegó la plata según el banco. */
  fechaBanco: string | null;
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
    fecha_banco: fechaBanco,
    confirmado_por: confirmadoPor,
    linea_extracto: linea,
  } as never);
  if (error && error.code !== "23505") throw new Error(`registrarPago: ${error.message}`);
  // Ya registrado o recién registrado: el aviso queda pagado y el acceso se recalcula desde el
  // libro. Si una vez se cortó entre el libro y el acceso, esto lo repara.
  const marcado = await admin
    .from("cobros")
    .update({ estado: "pagado", pagado_en: new Date().toISOString() } as never)
    .eq("id", cobroId)
    .neq("estado", "pagado");
  if (marcado.error) console.error("[transferencias] el pago quedó en el libro pero el aviso no se marcó:", marcado.error.message);
  const { vigente } = await recalcularAcceso(pintorId);
  if (error) return "ya_estaba";
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

type FilaCobro = {
  id: string;
  pintor_id: string | null;
  monto_ars: number;
  monto_recibido: number | string | null;
  cotizacion_id: number | null;
  estado: string;
  datos: { evento?: string; linea?: string; fecha_banco?: string; aviso?: string } | null;
};

/**
 * El admin confirma a mano ("Llegó"). Se registra lo que LLEGÓ si el extracto lo dijo, y con la
 * misma llave de esa línea: cargar el extracto otra vez no lo vuelve a sumar.
 */
export async function confirmarTransferenciaAMano(
  cobroId: string,
  adminId: string,
): Promise<"registrado" | "ya_estaba" | "no_existe" | "anulado"> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("cobros")
    .select("id, pintor_id, monto_ars, monto_recibido, cotizacion_id, estado, datos")
    .eq("id", cobroId)
    .eq("medio", "transferencia")
    .maybeSingle();
  const c = data as FilaCobro | null;
  if (!c || !c.pintor_id) return "no_existe";
  if (c.estado === "anulado") return "anulado";
  const { count } = await admin
    .from("pagos_suscripcion")
    .select("id", { count: "exact", head: true })
    .eq("cobro_id", c.id)
    .eq("tipo", "cobro");
  if (c.estado === "pagado" || count) {
    // Ya está en el libro: sólo se repara el estado y el acceso.
    await admin.from("cobros").update({ estado: "pagado" } as never).eq("id", c.id).neq("estado", "pagado");
    await recalcularAcceso(c.pintor_id);
    return "ya_estaba";
  }
  const r = await registrarPago({
    cobroId: c.id,
    pintorId: c.pintor_id,
    monto: c.monto_recibido != null ? Number(c.monto_recibido) : c.monto_ars,
    cotizacionId: c.cotizacion_id,
    eventoId: c.datos?.evento ?? `manual:${c.id}`,
    linea: c.datos?.linea ?? null,
    fechaBanco: c.datos?.fecha_banco ?? null,
    confirmadoPor: adminId,
  });
  // La revisión saldó el aviso del pintor: deja de esperar esa plata.
  if (c.datos?.aviso) {
    await admin
      .from("cobros")
      .update({ estado: "pagado", pagado_en: new Date().toISOString() } as never)
      .eq("id", c.datos.aviso)
      .in("estado", ["pendiente", "vencido"]);
  }
  return r;
}

/**
 * Una devolución (el arrepentimiento de /terminos, o un error): queda en el libro como un
 * movimiento más que anula el pago, y el acceso se recalcula sin ese mes. La plata la devuelve
 * el dueño desde el banco.
 */
export async function registrarDevolucion(pagoId: string, adminId: string): Promise<"registrado" | "ya_estaba" | "no_existe"> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("pagos_suscripcion")
    .select("id, cobro_id, pintor_id, proveedor, tipo, proveedor_evento_id, monto_ars, cotizacion_id")
    .eq("id", pagoId)
    .maybeSingle();
  const p = data as {
    cobro_id: string | null; pintor_id: string | null; proveedor: string; tipo: string;
    proveedor_evento_id: string; monto_ars: number | string; cotizacion_id: number | null;
  } | null;
  if (!p || p.tipo !== "cobro") return "no_existe";
  const { error } = await admin.from("pagos_suscripcion").insert({
    cobro_id: p.cobro_id,
    pintor_id: p.pintor_id,
    proveedor: p.proveedor,
    tipo: "devolucion",
    proveedor_evento_id: `devolucion:${p.proveedor_evento_id}`,
    anula: p.proveedor_evento_id,
    monto_ars: Number(p.monto_ars),
    cotizacion_id: p.cotizacion_id,
    fecha: new Date().toISOString(),
    confirmado_por: adminId,
  } as never);
  if (error && error.code !== "23505") throw new Error(`registrarDevolucion: ${error.message}`);
  if (p.pintor_id) await recalcularAcceso(p.pintor_id);
  return error ? "ya_estaba" : "registrado";
}

export interface ResumenDeExtracto {
  /** Si se encontró el encabezado (una fecha y un importe). */
  entendido: boolean;
  /** Si el extracto trae saldo: sin saldo, nada se confirma solo. */
  conSaldo: boolean;
  /** Créditos leídos. */
  lineas: number;
  confirmadas: number;
  yaCargadas: number;
  aRevisar: number;
  sinCodigo: number;
  codigoDesconocido: number;
  /** Movimientos que no se pudieron leer (otra cantidad de columnas, un importe imposible). */
  ilegibles: number;
  /** Líneas en las que algo falló: las demás se procesan igual. */
  conError: number;
}

type Resultado = "confirmadas" | "yaCargadas" | "aRevisar" | "sinCodigo" | "codigoDesconocido";

const pesos = (n: number) => `$${Math.round(n).toLocaleString("es-AR")}`;

/**
 * Procesa el extracto del banco. Cada línea por separado: una que falla no corta las demás (una
 * línea envenenada dejaba la pantalla en "algo se rompió" y nadie más se confirmaba).
 */
export async function procesarExtracto(csv: string, adminId: string): Promise<ResumenDeExtracto> {
  const admin = createAdminClient();
  const extracto = analizarExtracto(csv);
  const resumen: ResumenDeExtracto = {
    entendido: extracto.entendido,
    conSaldo: extracto.conSaldo,
    lineas: extracto.creditos.length,
    confirmadas: 0,
    yaCargadas: 0,
    aRevisar: 0,
    sinCodigo: 0,
    codigoDesconocido: 0,
    ilegibles: extracto.ilegibles,
    conError: 0,
  };
  const usd = await precioUsd(admin);
  const reparar = new Set<string>();
  for (const l of extracto.creditos) {
    try {
      const r = await procesarLinea(admin, l, { conSaldo: extracto.conSaldo, usd, adminId });
      resumen[r.resultado]++;
      if (r.resultado === "yaCargadas" && r.pintorId) reparar.add(r.pintorId);
    } catch (e) {
      resumen.conError++;
      console.error("[transferencias] una línea del extracto falló:", e instanceof Error ? e.message : e);
    }
  }
  // Volver a cargar un extracto repara un pago que quedó en el libro sin llegar al acceso.
  for (const id of reparar) {
    await recalcularAcceso(id).catch((e) => console.error("[transferencias] no se pudo recalcular el acceso:", e instanceof Error ? e.message : e));
  }
  return resumen;
}

async function procesarLinea(
  admin: Admin,
  l: LineaDeExtracto,
  { conSaldo, usd, adminId }: { conSaldo: boolean; usd: number | null; adminId: string },
): Promise<{ resultado: Resultado; pintorId?: string }> {
  if (!l.codigo) return { resultado: "sinCodigo" };
  const numero = Number(l.codigo.replace(/^PP-/, ""));
  const { data: delCodigo } = await admin.from("codigos_de_pago").select("pintor_id").eq("numero", numero).maybeSingle();
  const pintorId = (delCodigo as { pintor_id: string } | null)?.pintor_id;
  if (!pintorId) return { resultado: "codigoDesconocido" };

  // El id del evento sale del texto de la línea y de cuántas iguales hubo antes en el archivo: el
  // mismo extracto dos veces no registra nada dos veces, y dos transferencias iguales del mismo
  // día son dos pagos (antes, una).
  const eventoId = `extracto:${createHash("sha256").update(`${l.linea}#${l.ocurrencia}`).digest("hex").slice(0, 32)}`;
  const [enLibro, enRevision] = await Promise.all([
    admin.from("pagos_suscripcion").select("id", { count: "exact", head: true }).eq("proveedor", "transferencia").eq("proveedor_evento_id", eventoId),
    admin.from("cobros").select("id", { count: "exact", head: true }).eq("datos->>evento", eventoId),
  ]);
  if (enLibro.count || enRevision.count) return { resultado: "yaCargadas", pintorId };

  const dia = fechaDeExtracto(l.fecha);
  const finDelDia = dia ? new Date(dia.getTime() + MS_DIA - 1) : new Date();
  const fechaBanco = dia ? dia.toISOString().slice(0, 10) : null;
  // Lo que se le pidió: el aviso que estaba vigente el día que llegó la plata; si no avisó (o el
  // aviso ya había vencido), el precio con el dólar de ese día.
  const aviso = await avisoDelDia(admin, pintorId, dia);
  const precio = !aviso && usd ? await precioAl(admin, usd, finDelDia) : null;
  const esperado = aviso?.monto_ars ?? precio?.montoArs ?? null;

  let motivo: string | null = null;
  if (esperado === null) motivo = "no hay cotización del dólar para ese día";
  else if (!conSaldo) motivo = "el extracto no trae saldo: no se puede comprobar solo";
  else if (l.sospecha) motivo = l.sospecha;
  else if (!transferenciaAlcanza(l.monto, esperado)) motivo = `no alcanza: llegó ${pesos(l.monto)} de ${pesos(esperado)}`;
  else if (l.monto > esperado * MAS_DE_LO_PEDIDO) motivo = `llegó más de lo pedido (${pesos(l.monto)} de ${pesos(esperado)}): un pago de varios meses se confirma a mano`;
  else {
    const parecido = await pagoParecido(admin, pintorId, l.monto, dia ?? new Date());
    if (parecido) motivo = `posible duplicado del pago del ${fechaAR(parecido)}`;
  }

  if (motivo) {
    const { error } = await admin.from("cobros").insert({
      pintor_id: pintorId,
      plan_id: "pintor",
      medio: "transferencia",
      monto_usd: aviso ? Number(aviso.monto_usd) : usd ?? 1,
      monto_ars: esperado ?? Math.max(1, Math.round(l.monto)),
      monto_recibido: l.monto,
      cotizacion_id: aviso?.cotizacion_id ?? precio?.cotizacionId ?? null,
      codigo: l.codigo,
      estado: "a_revisar",
      vence_en: sumarDias(new Date(), VALIDEZ_DEL_COBRO_DIAS).toISOString(),
      datos: { motivo, linea: l.linea, evento: eventoId, fecha_banco: fechaBanco, aviso: aviso?.id ?? null },
    } as never);
    if (error) throw new Error(`para revisar: ${error.message}`);
    return { resultado: "aRevisar", pintorId };
  }

  // Se confirma. El aviso del día; si el pintor avisó después de transferir, su aviso vivo; si
  // no avisó nunca, uno nuevo con el precio de ese día.
  let cobro: { id: string; cotizacion_id: number | null } | null = aviso ?? (await avisoVivo(admin, pintorId));
  if (!cobro) {
    const { data, error } = await admin
      .from("cobros")
      .insert({
        pintor_id: pintorId,
        plan_id: "pintor",
        medio: "transferencia",
        monto_usd: usd,
        monto_ars: esperado,
        cotizacion_id: precio?.cotizacionId ?? null,
        codigo: l.codigo,
        estado: "pendiente",
        vence_en: sumarDias(new Date(), VALIDEZ_DEL_COBRO_DIAS).toISOString(),
      } as never)
      .select("id, cotizacion_id")
      .single();
    if (error || !data) throw new Error(`cobro: ${error?.message ?? "sin respuesta"}`);
    cobro = data as { id: string; cotizacion_id: number | null };
  }
  const r = await registrarPago({
    cobroId: cobro.id,
    pintorId,
    monto: l.monto,
    cotizacionId: cobro.cotizacion_id ?? precio?.cotizacionId ?? null,
    eventoId,
    linea: l.linea,
    fechaBanco,
    confirmadoPor: adminId,
  });
  return { resultado: r === "registrado" ? "confirmadas" : "yaCargadas", pintorId };
}

/** El aviso del pintor que estaba vigente el día que llegó la plata (aunque después haya vencido). */
async function avisoDelDia(admin: Admin, pintorId: string, dia: Date | null): Promise<FilaAviso | null> {
  const desde = dia ?? new Date();
  const hasta = dia ? new Date(dia.getTime() + MS_DIA - 1) : new Date();
  const { data } = await admin
    .from("cobros")
    .select(COLUMNAS_AVISO)
    .eq("pintor_id", pintorId)
    .eq("medio", "transferencia")
    .in("estado", ["pendiente", "vencido"])
    .lte("created_at", hasta.toISOString())
    .gte("vence_en", desde.toISOString())
    .order("created_at", { ascending: false })
    .limit(1);
  return ((data ?? []) as unknown as FilaAviso[])[0] ?? null;
}

/**
 * Un pago ya registrado del mismo pintor, por un monto parecido (±3 %) y a menos de una semana
 * del día de esta plata: "Llegó" a mano + el extracto, o el mismo movimiento en otra
 * exportación, sumaban dos y tres meses por una sola transferencia (8/10/2026).
 */
async function pagoParecido(admin: Admin, pintorId: string, monto: number, dia: Date): Promise<Date | null> {
  const { data } = await admin
    .from("pagos_suscripcion")
    .select("fecha, fecha_banco, monto_ars, proveedor_evento_id")
    .eq("pintor_id", pintorId)
    .eq("tipo", "cobro")
    .gte("fecha", new Date(dia.getTime() - VENTANA_DE_DUPLICADO_DIAS * MS_DIA).toISOString());
  for (const p of (data ?? []) as unknown as { fecha: string; fecha_banco: string | null; monto_ars: number | string }[]) {
    const cuando = p.fecha_banco ? new Date(`${p.fecha_banco}T03:00:00Z`) : new Date(p.fecha);
    const cerca = Math.abs(cuando.getTime() - dia.getTime()) <= VENTANA_DE_DUPLICADO_DIAS * MS_DIA;
    const parecido = Math.abs(Number(p.monto_ars) - monto) <= monto * 0.03;
    if (cerca && parecido) return cuando;
  }
  return null;
}
