import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { vigenteHasta, accesoHasta, type Movimiento, type Modalidad } from "@pinturapro/dominio";

/**
 * Recalcula hasta cuándo puede cotizar un pintor, a partir del LIBRO de pagos.
 *
 * Una regla para todos los medios (decisión del 6/10/2026): cada pago aprobado suma un mes,
 * contado desde que vencía el anterior —de cualquier medio— o desde el pago si ya había vencido.
 * Por eso se cuenta sobre TODOS los movimientos del pintor (transferencias, QR, débitos), no por
 * medio: quien pagó por transferencia y después se suscribe al débito no pierde días.
 *
 * Mientras dure el lanzamiento con fecha de fin, un pago cuenta desde ese fin (no gasta su mes en
 * días que ya eran gratis). Lo escribe la clave de servicio: `suscripciones` no la escribe nadie
 * con su sesión (0027). `puede_cotizar()` decide con lo que quede acá.
 */
export async function recalcularAcceso(pintorId: string): Promise<{ vigente: string | null }> {
  const admin = createAdminClient();
  const [pagos, ajustes, filas] = await Promise.all([
    admin.from("pagos_suscripcion").select("tipo, proveedor_evento_id, anula, fecha, modo").eq("pintor_id", pintorId),
    admin.from("ajustes_de_cobro").select("lanzamiento_hasta, aceptar_pagos_de_prueba").maybeSingle(),
    admin.from("suscripciones").select("id, proveedor, modalidad, estado").eq("pintor_id", pintorId),
  ]);
  if (pagos.error) throw new Error(`recalcularAcceso: ${pagos.error.message}`);
  if (filas.error) throw new Error(`recalcularAcceso: ${filas.error.message}`);

  const aj = ajustes.data as { lanzamiento_hasta: string | null; aceptar_pagos_de_prueba: boolean | null } | null;
  // Un pago de prueba (sandbox) no da acceso real, salvo en una base de pruebas que lo pide: la
  // fila que se escribe abajo es de producción, y `puede_cotizar()` la creía (dinero-y-comisiones, 8/10/2026).
  const valenPruebas = aj?.aceptar_pagos_de_prueba === true;
  const movimientos: Movimiento[] = ((pagos.data ?? []) as unknown as {
    tipo: Movimiento["tipo"];
    proveedor_evento_id: string;
    anula: string | null;
    fecha: string;
    modo: string;
  }[])
    .filter((p) => p.modo === "produccion" || valenPruebas)
    .map((p) => ({ tipo: p.tipo, fecha: p.fecha, eventoId: p.proveedor_evento_id, anula: p.anula }));
  const finLanzamiento = aj?.lanzamiento_hasta ?? null;
  const vigente = vigenteHasta(movimientos, { desde: finLanzamiento });

  type Fila = { id: string; proveedor: string; modalidad: Modalidad | null; estado: string };
  let pagas = ((filas.data ?? []) as unknown as Fila[]).filter((f) => f.proveedor === "transferencia" || f.proveedor === "mercadopago");
  // Quien paga a mano (transferencia o QR) tiene su fila de "pago mensual"; se crea con el primer pago.
  if (vigente && !pagas.some((f) => f.modalidad === "pago_mensual")) {
    const { data, error } = await admin
      .from("suscripciones")
      .insert({ pintor_id: pintorId, plan_id: "pintor", proveedor: "transferencia", modalidad: "pago_mensual", estado: "activa" } as never)
      .select("id, proveedor, modalidad, estado");
    if (error) throw new Error(`recalcularAcceso: ${error.message}`);
    pagas = pagas.concat((data ?? []) as unknown as Fila[]);
  }

  const ahora = Date.now();
  for (const f of pagas) {
    const cancelada = f.estado === "cancelada";
    const acceso = accesoHasta(vigente, (f.modalidad ?? "pago_mensual") as Modalidad, cancelada);
    const estado = cancelada || f.estado === "pendiente"
      ? f.estado
      : vigente && vigente.getTime() > ahora
        ? "activa"
        : acceso && acceso.getTime() > ahora
          ? "en_gracia"
          : vigente
            ? "vencida"
            : f.estado;
    const { error } = await admin
      .from("suscripciones")
      .update({
        vigente_hasta: vigente?.toISOString() ?? null,
        acceso_hasta: acceso?.toISOString() ?? null,
        estado,
        sincronizada_en: new Date().toISOString(),
      } as never)
      .eq("id", f.id);
    if (error) throw new Error(`recalcularAcceso: ${error.message}`);
  }
  return { vigente: vigente?.toISOString() ?? null };
}
