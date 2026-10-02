/**
 * Lo que mira el dueño: consultas recibidas, métricas de la plataforma y los números de la portada.
 * (Parte de lib/queries: ver index.ts.)
 */
import { createClient } from "@/lib/supabase/server";
import { createPublicClient } from "@/lib/supabase/publico";
import { publico, ETIQUETAS } from "@/lib/cache-publico";
import type { LeadKind, LeadStatus } from "@/lib/supabase/types";
import { dbError, SUPA, monthYear } from "./base";

export interface LeadView {
  id: string;
  kind: LeadKind;
  kindLabel: string;
  status: LeadStatus;
  name: string;
  email: string | null;
  phone: string | null;
  message: string | null;
  details: Record<string, unknown>;
  date: string;
}

const LEAD_KIND_LABEL: Record<LeadKind, string> = {
  quote: "Presupuesto",
  contact: "Contacto",
  painter_application: "Postulación",
};

/**
 * Consultas recibidas por los formularios públicos.
 *
 * Sólo las lee la empresa: la policy `leads_select_company` (migración 0007) lo garantiza
 * a nivel de base, no sólo por el gate de la página. Si la migración todavía no corrió,
 * la query falla, se loguea y la vista muestra la lista vacía en vez de romperse.
 */
export async function getLeads(kind?: LeadKind): Promise<LeadView[]> {
  if (!SUPA) return [];
  try {
    const supabase = await createClient();
    let q = supabase
      .from("leads")
      .select("id, kind, status, name, email, phone, message, details, created_at");
    if (kind) q = q.eq("kind", kind);
    const { data, error } = await q.order("created_at", { ascending: false }).limit(100);
    if (error || !data) {
      if (error) dbError("getLeads", error);
      return [];
    }
    const rows = data as unknown as {
      id: string;
      kind: LeadKind;
      status: LeadStatus;
      name: string;
      email: string | null;
      phone: string | null;
      message: string | null;
      details: Record<string, unknown> | null;
      created_at: string;
    }[];
    return rows.map((r) => ({
      id: r.id,
      kind: r.kind,
      kindLabel: LEAD_KIND_LABEL[r.kind] ?? r.kind,
      status: r.status,
      name: r.name,
      email: r.email,
      phone: r.phone,
      message: r.message,
      details: r.details ?? {},
      date: monthYear(r.created_at),
    }));
  } catch (e) {
    dbError("getLeads", e);
    return [];
  }
}

export interface MetricasPlataforma {
  pedidosPublicados: number;
  cotizaciones: number;
  trabajosCompletados: number;
  volumen: number;
  comision: number;
}

export interface MesVolumen {
  mes: string;
  /** Inicial del mes en español, para el eje del gráfico. */
  inicial: string;
  total: number;
}

export interface ActividadItem {
  titulo: string;
  fecha: string;
  cotizaciones: number;
}

const INICIAL_MES = ["E", "F", "M", "A", "M", "J", "J", "A", "S", "O", "N", "D"];

/**
 * Los números del panel analítico.
 *
 * Van por `metricas_plataforma` (migración 0012) porque la RLS de `jobs` sólo muestra los
 * trabajos propios: ni el admin puede contar los de toda la plataforma con su sesión. La
 * función chequea `is_admin` adentro, así que un no-admin recibe cero filas y acá se traduce
 * a null — la página muestra el panel vacío en vez de ceros, que parecerían datos reales.
 */
export async function getMetricasPlataforma(): Promise<MetricasPlataforma | null> {
  if (!SUPA) return null;
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("metricas_plataforma" as never);
    if (error) {
      dbError("getMetricasPlataforma", error);
      return null;
    }
    const filas = (data ?? []) as unknown as {
      pedidos_publicados: number;
      cotizaciones: number;
      trabajos_completados: number;
      volumen: number;
      comision: number;
    }[];
    if (filas.length === 0) return null;
    const m = filas[0];
    return {
      pedidosPublicados: Number(m.pedidos_publicados),
      cotizaciones: Number(m.cotizaciones),
      trabajosCompletados: Number(m.trabajos_completados),
      volumen: Number(m.volumen),
      comision: Number(m.comision),
    };
  } catch (e) {
    dbError("getMetricasPlataforma", e);
    return null;
  }
}

/** Los 12 meses del gráfico de volumen, ceros incluidos. */
export async function getVolumenMensual(): Promise<MesVolumen[]> {
  if (!SUPA) return [];
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("volumen_mensual" as never);
    if (error) {
      dbError("getVolumenMensual", error);
      return [];
    }
    return ((data ?? []) as unknown as { mes: string; total: number }[]).map((r) => ({
      mes: r.mes,
      inicial: INICIAL_MES[new Date(`${r.mes}T00:00:00`).getMonth()],
      total: Number(r.total),
    }));
  } catch (e) {
    dbError("getVolumenMensual", e);
    return [];
  }
}

/** Últimos pedidos publicados en la plataforma, con cuántas cotizaciones recibió cada uno. */
export async function getActividadReciente(limite = 6): Promise<ActividadItem[]> {
  if (!SUPA) return [];
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("actividad_reciente", { limite } as never);
    if (error) {
      dbError("getActividadReciente", error);
      return [];
    }
    return ((data ?? []) as unknown as { titulo: string; creado: string; cotizaciones: number }[]).map((r) => ({
      titulo: r.titulo,
      fecha: monthYear(r.creado),
      cotizaciones: Number(r.cotizaciones),
    }));
  } catch (e) {
    dbError("getActividadReciente", e);
    return [];
  }
}

export interface NumerosReales {
  /** Obras publicadas en el portfolio. */
  obras: number;
  /** Trabajos cerrados por la plataforma. */
  trabajosCompletados: number;
  /** Promedio de todas las reseñas, o null si todavía no hay ninguna. */
  promedio: number | null;
  resenias: number;
}

/**
 * Los números que la home puede afirmar porque salen de la base.
 *
 * Las cifras de la portada eran constantes escritas a mano ("+340 obras entregadas", "4,9★")
 * que no se correspondían con nada: el portfolio tiene 3 obras. Lo que se puede contar, se
 * cuenta; lo que no (años de oficio, obras hechas fuera de la plataforma) vive en
 * `lib/empresa.ts` esperando el dato real del dueño, y hasta entonces no se muestra.
 */
async function leer_getNumerosReales(): Promise<NumerosReales> {
  const vacio: NumerosReales = { obras: 0, trabajosCompletados: 0, promedio: null, resenias: 0 };
  if (!SUPA) return vacio;
  try {
    const supabase = createPublicClient();
    const [obras, trabajos, resenias] = await Promise.all([
      supabase.from("projects").select("id", { count: "exact", head: true }).eq("type", "portfolio").eq("published", true),
      supabase.from("jobs").select("id", { count: "exact", head: true }).eq("status", "completed"),
      supabase.from("reviews").select("rating"),
    ]);
    if (obras.error) dbError("getNumerosReales/obras", obras.error);
    if (trabajos.error) dbError("getNumerosReales/trabajos", trabajos.error);
    if (resenias.error) dbError("getNumerosReales/resenias", resenias.error);

    const notas = ((resenias.data ?? []) as unknown as { rating: number }[]).map((r) => Number(r.rating));
    const promedio = notas.length ? Math.round((notas.reduce((a, b) => a + b, 0) / notas.length) * 10) / 10 : null;
    return {
      obras: obras.count ?? 0,
      trabajosCompletados: trabajos.count ?? 0,
      promedio,
      resenias: notas.length,
    };
  } catch (e) {
    dbError("getNumerosReales", e);
    return vacio;
  }
}

export const getNumerosReales = publico(leer_getNumerosReales, "getNumerosReales", [ETIQUETAS.obras, ETIQUETAS.resenas, ETIQUETAS.trabajos]);
