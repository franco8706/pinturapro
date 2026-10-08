/**
 * La suscripción del pintor: las condiciones del cobro (lanzamiento, plan, precio al dólar del
 * día) y el acceso de quien mira.
 * (Parte de lib/queries: ver index.ts.)
 *
 * Desde el 6/10/2026 la plataforma no cobra comisión por trabajo: el pintor paga una
 * suscripción mensual (US$5 en pesos al dólar del día). La barrera es la base
 * (`puede_cotizar()`, migración 0027); esto es lo que la pantalla necesita para explicarlo.
 *
 * Si la base todavía no tiene la 0027 (tablas y funciones inexistentes), nada se rompe: se
 * informa `disponible: false` y la pantalla dice lo de siempre —cotizar es gratis—, que es lo
 * que la base hace en ese estado.
 */
import { createClient } from "@/lib/supabase/server";
import { createPublicClient } from "@/lib/supabase/publico";
import { publico, ETIQUETAS } from "@/lib/cache-publico";
import { estadoDeAcceso, textoDeAcceso, type EstadoAcceso } from "@pinturapro/dominio";
import { dbError, SUPA } from "./base";

/** La tabla o la función no existen todavía: la base está antes de la 0027. No es un error. */
function faltaLaMigracion(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false;
  return (
    error.code === "42P01" ||
    error.code === "42883" ||
    error.code === "PGRST202" ||
    error.code === "PGRST205" ||
    /does not exist|Could not find/i.test(error.message ?? "")
  );
}

export interface CondicionesDeCobro {
  /** La base ya tiene el modelo de cobro (0027). */
  disponible: boolean;
  /** ISO. `null` = el lanzamiento todavía no tiene fecha de fin. */
  lanzamientoHasta: string | null;
  exigir: boolean;
  plan: { id: string; nombre: string; precioUsd: number; beneficios: string[] } | null;
  /** El precio en pesos con la cotización vigente; `null` si todavía no hay cotización. */
  precioArs: number | null;
  /** La cotización con la que se calculó (dólar oficial vendedor del Banco Nación). */
  cotizacion: { venta: number; leidaEn: string } | null;
}

const SIN_COBRO: CondicionesDeCobro = {
  disponible: false,
  lanzamientoHasta: null,
  exigir: false,
  plan: null,
  precioArs: null,
  cotizacion: null,
};

/** Lo público del cobro. Se cachea un minuto, como el resto de lo público. Fechas en ISO: la caché serializa. */
async function leer_getCondicionesDeCobro(): Promise<CondicionesDeCobro> {
  if (!SUPA) return SIN_COBRO;
  try {
    const supabase = createPublicClient();
    const [ajustes, planes, cotizacion, precio] = await Promise.all([
      supabase.from("ajustes_de_cobro").select("lanzamiento_hasta, exigir_suscripcion").maybeSingle(),
      supabase.from("planes").select("id, nombre, precio_usd, beneficios").eq("id", "pintor").maybeSingle(),
      supabase.rpc("cotizacion_vigente"),
      // Las funciones de la base no están en los tipos generados: se leen como `unknown`.
      supabase.rpc("precio_ars", { plan: "pintor" } as never),
    ]);
    if (faltaLaMigracion(ajustes.error)) return SIN_COBRO;
    for (const [nombre, r] of [["ajustes", ajustes], ["planes", planes], ["cotizacion", cotizacion], ["precio", precio]] as const) {
      if (r.error) dbError(`getCondicionesDeCobro:${nombre}`, r.error);
    }
    const a = ajustes.data as { lanzamiento_hasta: string | null; exigir_suscripcion: boolean } | null;
    const p = planes.data as { id: string; nombre: string; precio_usd: number | string; beneficios: string[] | null } | null;
    const filaCotizacion: unknown = cotizacion.data;
    const c = (Array.isArray(filaCotizacion) ? filaCotizacion[0] : filaCotizacion) as
      | { venta: number | string; leida_en: string }
      | null
      | undefined;
    return {
      disponible: true,
      lanzamientoHasta: a?.lanzamiento_hasta ?? null,
      exigir: a?.exigir_suscripcion ?? true,
      plan: p ? { id: p.id, nombre: p.nombre, precioUsd: Number(p.precio_usd), beneficios: p.beneficios ?? [] } : null,
      precioArs: typeof (precio.data as unknown) === "number" ? (precio.data as unknown as number) : null,
      cotizacion: c ? { venta: Number(c.venta), leidaEn: c.leida_en } : null,
    };
  } catch (e) {
    dbError("getCondicionesDeCobro", e);
    return SIN_COBRO;
  }
}
export const getCondicionesDeCobro = publico(leer_getCondicionesDeCobro, "getCondicionesDeCobro", [ETIQUETAS.cobro]);

export interface MiAcceso {
  /** La base ya tiene el modelo de cobro (0027). */
  disponible: boolean;
  puedeCotizar: boolean;
  estado: EstadoAcceso;
  /** El estado en palabras (de dominio: el mismo texto que ve la app móvil). */
  texto: string;
  vigenteHasta: string | null;
  accesoHasta: string | null;
  lanzamientoHasta: string | null;
}

const ACCESO_SIN_COBRO: MiAcceso = {
  disponible: false,
  puedeCotizar: true,
  estado: "lanzamiento",
  texto: "Cotizar es gratis durante el lanzamiento.",
  vigenteHasta: null,
  accesoHasta: null,
  lanzamientoHasta: null,
};

/** El acceso del pintor que mira. Lee con su sesión: la base sólo le devuelve lo suyo. */
export async function getMiAcceso(userId: string): Promise<MiAcceso> {
  if (!SUPA) return ACCESO_SIN_COBRO;
  try {
    const supabase = await createClient();
    const [filas, puede, condiciones] = await Promise.all([
      supabase.from("suscripciones").select("proveedor, estado, acceso_hasta, vigente_hasta").eq("pintor_id", userId),
      supabase.rpc("puede_cotizar"),
      getCondicionesDeCobro(),
    ]);
    if (faltaLaMigracion(filas.error)) return ACCESO_SIN_COBRO;
    if (filas.error) dbError("getMiAcceso", filas.error);
    const rows = (filas.data ?? []) as {
      proveedor: string;
      estado: string;
      acceso_hasta: string | null;
      vigente_hasta: string | null;
    }[];
    const max = (xs: (string | null)[]) =>
      xs.filter((x): x is string => !!x).sort().at(-1) ?? null;
    const vigenteHasta = max(rows.map((r) => r.vigente_hasta));
    const accesoHasta = max(rows.map((r) => r.acceso_hasta));
    const inscripto = rows.some((r) => r.proveedor === "lanzamiento" && r.estado !== "cancelada");
    const lanzamientoHasta = condiciones.lanzamientoHasta;
    const lanzamientoVivo = inscripto && (!lanzamientoHasta || new Date(lanzamientoHasta).getTime() > Date.now());
    // Un lanzamiento sin fecha de fin se trata como "en curso" para el estado.
    const finLanzamiento = lanzamientoVivo ? new Date(lanzamientoHasta ?? "9999-12-31T00:00:00Z") : null;
    const estado = estadoDeAcceso({
      vigente: vigenteHasta ? new Date(vigenteHasta) : null,
      acceso: accesoHasta ? new Date(accesoHasta) : null,
      lanzamientoHasta: finLanzamiento,
    });
    const texto = textoDeAcceso(estado, {
      vigente: vigenteHasta ? new Date(vigenteHasta) : null,
      acceso: accesoHasta ? new Date(accesoHasta) : null,
      lanzamientoHasta: lanzamientoHasta ? new Date(lanzamientoHasta) : null,
    });
    // Lo que manda es la base. Si la función falla, se infiere del estado.
    const respuesta: unknown = puede.data;
    const puedeCotizar =
      !puede.error && typeof respuesta === "boolean"
        ? respuesta
        : !condiciones.exigir || estado === "lanzamiento" || estado === "activa" || estado === "en_gracia";
    if (puede.error && !faltaLaMigracion(puede.error)) dbError("getMiAcceso:puede_cotizar", puede.error);
    return { disponible: true, puedeCotizar, estado, texto, vigenteHasta, accesoHasta, lanzamientoHasta };
  } catch (e) {
    dbError("getMiAcceso", e);
    return ACCESO_SIN_COBRO;
  }
}

export interface MetricasSuscripciones {
  activos: number;
  enGracia: number;
  enLanzamiento: number;
  sinAcceso: number;
  ingresoMesArs: number;
  devolucionesMesArs: number;
  transferenciasARevisar: number;
}

/** Los números del cobro para el admin (`metricas_suscripciones()`, que verifica `es_admin()` adentro). */
export async function getMetricasSuscripciones(): Promise<MetricasSuscripciones | null> {
  if (!SUPA) return null;
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("metricas_suscripciones");
    if (error) {
      if (!faltaLaMigracion(error)) dbError("getMetricasSuscripciones", error);
      return null;
    }
    const fila: unknown = Array.isArray(data) ? data[0] : data;
    if (!fila) return null;
    const f = fila as Record<string, number | string | null>;
    const n = (v: number | string | null | undefined) => Number(v ?? 0);
    return {
      activos: n(f.activos),
      enGracia: n(f.en_gracia),
      enLanzamiento: n(f.en_lanzamiento),
      sinAcceso: n(f.sin_acceso),
      ingresoMesArs: n(f.ingreso_mes_ars),
      devolucionesMesArs: n(f.devoluciones_mes_ars),
      transferenciasARevisar: n(f.transferencias_a_revisar),
    };
  } catch (e) {
    dbError("getMetricasSuscripciones", e);
    return null;
  }
}

export interface CotizacionAdmin {
  id: number;
  venta: number;
  control: number | null;
  estado: "vigente" | "a_confirmar" | "descartada";
  motivo: string | null;
  leidaEn: string;
  confirmadaEn: string | null;
}

/**
 * Las últimas lecturas del dólar, para /admin. La tabla no la lee nadie con su sesión (0027):
 * se lee con la clave de servicio, y por eso esta función la llama SÓLO una página que ya
 * verificó que quien mira es el admin.
 */
export async function getCotizacionesParaAdmin(limite = 15): Promise<CotizacionAdmin[]> {
  if (!SUPA || !process.env.SUPABASE_SERVICE_ROLE_KEY) return [];
  try {
    const { createAdminClient } = await import("@/lib/supabase/admin");
    const { data, error } = await createAdminClient()
      .from("cotizaciones_dolar")
      .select("id, venta, control, estado, motivo, leida_en, confirmada_en")
      .order("leida_en", { ascending: false })
      .limit(limite);
    if (error) {
      if (!faltaLaMigracion(error)) dbError("getCotizacionesParaAdmin", error);
      return [];
    }
    return ((data ?? []) as unknown as Record<string, unknown>[]).map((r) => ({
      id: Number(r.id),
      venta: Number(r.venta),
      control: r.control == null ? null : Number(r.control),
      estado: r.estado as CotizacionAdmin["estado"],
      motivo: (r.motivo as string | null) ?? null,
      leidaEn: String(r.leida_en),
      confirmadaEn: (r.confirmada_en as string | null) ?? null,
    }));
  } catch (e) {
    dbError("getCotizacionesParaAdmin", e);
    return [];
  }
}

export interface CancelacionTrasAceptar {
  jobId: string;
  monto: number | null;
  aceptadoEn: string | null;
  canceladoEn: string | null;
  canceladoPor: string | null;
}

/** H5 a la vista: trabajos cancelados después de aceptar (el teléfono ya se había mostrado). Sólo admin (lo verifica la base). */
export async function getCancelacionesTrasAceptar(limite = 30): Promise<CancelacionTrasAceptar[]> {
  if (!SUPA) return [];
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("cancelaciones_tras_aceptar", { limite } as never);
    if (error) {
      if (!faltaLaMigracion(error)) dbError("getCancelacionesTrasAceptar", error);
      return [];
    }
    const filas: unknown = data;
    return ((Array.isArray(filas) ? filas : []) as Record<string, unknown>[]).map((r) => ({
      jobId: String(r.job_id),
      monto: r.monto == null ? null : Number(r.monto),
      aceptadoEn: (r.aceptado_en as string | null) ?? null,
      canceladoEn: (r.cancelado_en as string | null) ?? null,
      canceladoPor: (r.cancelado_por as string | null) ?? null,
    }));
  } catch (e) {
    dbError("getCancelacionesTrasAceptar", e);
    return [];
  }
}
