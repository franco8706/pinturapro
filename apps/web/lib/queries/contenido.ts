/**
 * Contenido editorial: preguntas frecuentes, recursos para aprender y novedades.
 * (Parte de lib/queries: ver index.ts.)
 */
import { createPublicClient } from "@/lib/supabase/publico";
import { publico, ETIQUETAS } from "@/lib/cache-publico";
import { dbError, SUPA, monthYear } from "./base";

// ───────────────────────── Contenido dinámico ─────────────────────────

export interface Faq {
  id: string;
  question: string;
  answer: string;
}

/** Preguntas básicas antes de un presupuesto. Fail-safe si la tabla no existe aún. */
async function leer_getFaqs(): Promise<Faq[]> {
  if (!SUPA) return [];
  try {
    const supabase = createPublicClient();
    const { data, error } = await supabase
      .from("faqs")
      .select("id, question, answer")
      .eq("published", true)
      .order("sort_order", { ascending: true })
      .limit(50); // tope: faqs
    if (error || !data) {
      if (error) dbError("getFaqs", error);
      return [];
    }
    return data as unknown as Faq[];
  } catch (e) {
    dbError("getFaqs", e);
    return [];
  }
}

export const getFaqs = publico(leer_getFaqs, "getFaqs", [ETIQUETAS.contenido]);

export type ResourceKind = "guide" | "video" | "course" | "advice";

export interface Resource {
  id: string;
  kind: ResourceKind;
  title: string;
  summary: string | null;
  body: string | null;
  mediaUrl: string | null;
  coverUrl: string | null;
  level: string | null;
  duration: string | null;
}

/** Recursos (guías / videos / cursos / asesoramiento). Filtrable por tipo. */
async function leer_getResources(kind?: ResourceKind): Promise<Resource[]> {
  if (!SUPA) return [];
  try {
    const supabase = createPublicClient();
    let q = supabase
      .from("resources")
      .select("id, kind, title, summary, body, media_url, cover_url, level, duration, sort_order")
      .eq("published", true);
    if (kind) q = q.eq("kind", kind);
    const { data, error } = await q.order("sort_order", { ascending: true }).limit(60);
    if (error || !data) {
      if (error) dbError("getResources", error);
      return [];
    }
    return (data as unknown as {
      id: string;
      kind: ResourceKind;
      title: string;
      summary: string | null;
      body: string | null;
      media_url: string | null;
      cover_url: string | null;
      level: string | null;
      duration: string | null;
    }[]).map((r) => ({
      id: r.id,
      kind: r.kind,
      title: r.title,
      summary: r.summary,
      body: r.body,
      mediaUrl: r.media_url,
      coverUrl: r.cover_url,
      level: r.level,
      duration: r.duration,
    }));
  } catch (e) {
    dbError("getResources", e);
    return [];
  }
}

export const getResources = publico(leer_getResources, "getResources", [ETIQUETAS.contenido]);

export interface NewsItem {
  id: string;
  title: string;
  excerpt: string | null;
  coverUrl: string | null;
  url: string | null;
  date: string;
}

/** Noticias para el carrusel. */
async function leer_getNews(): Promise<NewsItem[]> {
  if (!SUPA) return [];
  try {
    const supabase = createPublicClient();
    const { data, error } = await supabase
      .from("news")
      .select("id, title, excerpt, cover_url, url, published_at")
      .eq("published", true)
      .order("published_at", { ascending: false })
      .limit(30); // tope: carrusel de novedades
    if (error || !data) {
      if (error) dbError("getNews", error);
      return [];
    }
    return (data as unknown as {
      id: string;
      title: string;
      excerpt: string | null;
      cover_url: string | null;
      url: string | null;
      published_at: string;
    }[]).map((n) => ({
      id: n.id,
      title: n.title,
      excerpt: n.excerpt,
      coverUrl: n.cover_url,
      url: n.url,
      date: monthYear(n.published_at),
    }));
  } catch (e) {
    dbError("getNews", e);
    return [];
  }
}

export const getNews = publico(leer_getNews, "getNews", [ETIQUETAS.contenido]);
