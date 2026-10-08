import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { evaluarCotizacion, type EstadoCotizacion } from "@pinturapro/dominio";

/**
 * La cotización del dólar con la que se pasan a pesos los US$5 de la suscripción (decisión del
 * dueño, 6/10/2026: "todos cobran 5 dólares; hay que monitorear el dólar a la hora de cobrar").
 *
 * No hace falta un agente de inteligencia artificial: es una tarea que corre 3 veces por día
 * hábil (Cloud Scheduler → POST /api/cotizacion/actualizar) y guarda cada lectura en
 * `cotizaciones_dolar` (migración 0027). Se toca plata, así que ante la duda NO se usa:
 *
 *  · Fuente principal: el dólar oficial del Banco Nación, para la venta (dolarapi.com, que lo
 *    publica en JSON). Es el que entiende cualquiera y el que dicen los términos.
 *  · Control: la cotización oficial del BCRA (API pública del Banco Central). Si las dos
 *    difieren más del 5 %, la lectura se guarda como `descartada` y no se usa.
 *  · Si salta más del 10 % respecto de la vigente, queda `a_confirmar` hasta que el dueño la
 *    acepte en /admin. Mientras tanto se sigue cobrando con la anterior.
 *  · Si no se puede leer, no se guarda nada y se sigue con la última buena: NUNCA se frena un
 *    cobro por la cotización. El vigilante avisa si pasan 48 h sin una lectura nueva.
 *
 * Las reglas (qué es "salta" y "difieren") son las de `@pinturapro/dominio` (`evaluarCotizacion`),
 * probadas sin red. Cada problema sale al log como ERROR, que es lo que dispara la alerta por
 * logs de Google Cloud.
 */

/** Las URLs se pueden cambiar por entorno (la prueba de regresión las apunta a un servidor propio). */
const FUENTE_BNA = process.env.COTIZACION_FUENTE_URL || "https://dolarapi.com/v1/dolares/oficial";
const FUENTE_BCRA = process.env.COTIZACION_CONTROL_URL || "https://api.bcra.gob.ar/estadisticascambiarias/v1.0/Cotizaciones/USD";
const TIMEOUT_MS = 8_000;

async function leerJson(url: string): Promise<unknown> {
  const r = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT_MS), cache: "no-store" });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.json();
}

/** `{ compra, venta }` del oficial del Banco Nación, o null si no se pudo leer un número válido. */
async function leerBna(): Promise<{ compra: number | null; venta: number } | null> {
  try {
    const d = (await leerJson(FUENTE_BNA)) as { compra?: unknown; venta?: unknown };
    const venta = Number(d?.venta);
    const compra = Number(d?.compra);
    if (!Number.isFinite(venta) || venta <= 0) return null;
    return { venta, compra: Number.isFinite(compra) && compra > 0 ? compra : null };
  } catch (e) {
    console.error(`[cotizacion] no se pudo leer el Banco Nación: ${e instanceof Error ? e.message : e}`);
    return null;
  }
}

/** La cotización del BCRA (control). Null si no se pudo leer: el control es opcional. */
async function leerBcra(): Promise<number | null> {
  try {
    const d = (await leerJson(FUENTE_BCRA)) as {
      results?: { detalle?: { codigoMoneda?: string; tipoCotizacion?: unknown }[] }[];
    };
    const fila = d?.results?.[0]?.detalle?.find((x) => x?.codigoMoneda === "USD");
    const v = Number(fila?.tipoCotizacion);
    return Number.isFinite(v) && v > 0 ? v : null;
  } catch (e) {
    console.error(`[cotizacion] no se pudo leer el BCRA (control): ${e instanceof Error ? e.message : e}`);
    return null;
  }
}

export type ResultadoCotizacion =
  | { guardada: true; estado: EstadoCotizacion; venta: number; control: number | null; motivo: string }
  | { guardada: false; motivo: string };

/** Lee, evalúa y guarda una cotización. La llama la ruta de Cloud Scheduler. */
export async function actualizarCotizacion(): Promise<ResultadoCotizacion> {
  const admin = createAdminClient();
  const [bna, control, anterior, ajustes] = await Promise.all([
    leerBna(),
    leerBcra(),
    admin.rpc("cotizacion_vigente"),
    // Los umbrales viven en la base (0027): el dueño los puede ajustar sin publicar una versión.
    admin.from("ajustes_de_cobro").select("salto_maximo, diferencia_maxima_fuentes").maybeSingle(),
  ]);
  if (!bna) {
    console.error("[cotizacion] sin lectura del dólar: se sigue cobrando con la última válida");
    return { guardada: false, motivo: "no se pudo leer la fuente principal" };
  }
  if (anterior.error) {
    console.error(`[cotizacion] no se pudo leer la cotización vigente: ${anterior.error.message}`);
    return { guardada: false, motivo: "no se pudo leer la cotización vigente" };
  }
  const filaAnterior: unknown = Array.isArray(anterior.data) ? anterior.data[0] : anterior.data;
  const ventaAnterior = filaAnterior ? Number((filaAnterior as { venta: unknown }).venta) : null;

  const umbrales = ajustes.data as { salto_maximo: number | string; diferencia_maxima_fuentes: number | string } | null;
  const evaluacion = evaluarCotizacion(bna.venta, control, ventaAnterior, {
    ...(umbrales ? { saltoMaximo: Number(umbrales.salto_maximo), diferenciaMaxima: Number(umbrales.diferencia_maxima_fuentes) } : {}),
  });
  if (!evaluacion) return { guardada: false, motivo: "lectura inválida" };

  const { error } = await admin.from("cotizaciones_dolar").insert({
    fuente: "bna",
    compra: bna.compra,
    venta: bna.venta,
    control,
    estado: evaluacion.estado,
    motivo: evaluacion.motivo,
  } as never);
  if (error) {
    console.error(`[cotizacion] no se pudo guardar: ${error.message}`);
    return { guardada: false, motivo: "no se pudo guardar" };
  }
  if (evaluacion.estado !== "vigente") {
    // ERROR a propósito: es lo que dispara la alerta por logs. Una cotización que no se usa la
    // tiene que mirar el dueño (confirmar el salto en /admin, o ver qué fuente se rompió).
    console.error(`[cotizacion] ${evaluacion.estado}: ${evaluacion.motivo} (venta ${bna.venta})`);
  }
  return { guardada: true, estado: evaluacion.estado, venta: bna.venta, control, motivo: evaluacion.motivo };
}
