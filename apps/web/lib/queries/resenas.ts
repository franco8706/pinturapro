/**
 * Reseñas: las de un pintor, los testimonios de la portada, y quién ve el nombre del autor.
 * (Parte de lib/queries: ver index.ts.)
 */
import { unstable_rethrow } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createPublicClient } from "@/lib/supabase/publico";
import { publico, ETIQUETAS } from "@/lib/cache-publico";
import { dbError, BAJA, SUPA, ErrorDeLecturaDeDatos, errorDeLectura, monthYear } from "./base";

export interface ReviewView {
  id: string;
  author: string;
  /** Sólo para completar el nombre con los permisos de quien mira (`conNombresDeAutores`). */
  autorId?: string | null;
  rating: number;
  date: string;
  comment: string;
  project?: string;
}

/** Reseñas dirigidas a un pintor, con el nombre del autor resuelto. */
async function leer_getReviewsForPainter(painterId: string): Promise<ReviewView[]> {
  if (!SUPA) return [];
  try {
    const supabase = createPublicClient();
    const { data, error } = await supabase
      .from("reviews")
      .select("id, rating, comment, created_at, author_id")
      .eq("target_id", painterId)
      .order("created_at", { ascending: false })
      .limit(30); // tope: reseñas de un perfil
    // Falló la lectura: es distinto de "no hay filas" y no se puede mostrar como si fuera lo mismo.
    if (error) errorDeLectura("getReviewsForPainter", error);
    // Sin error y sin filas: el pintor genuinamente no tiene reseñas todavía.
    if (!data) return [];
    const rows = data as unknown as {
      id: string;
      rating: number;
      comment: string | null;
      created_at: string;
      author_id: string;
    }[];
    // `author_id` puede venir en NULL: quien escribió la reseña dio de baja su cuenta y la
    // reseña quedó, sin nombre (migración 0019). Se filtran para no pedirle a la base un id
    // que no existe.
    // El nombre del autor NO se busca acá: esta lectura se guarda en caché como visitante
    // anónimo, que no puede leer perfiles de clientes (0013). Lo completa
    // `conNombresDeAutores` con los permisos de quien mira.
    return rows.map((r) => ({
      id: r.id,
      author: r.author_id ? "Cliente" : BAJA,
      autorId: r.author_id,
      rating: r.rating,
      date: monthYear(r.created_at),
      comment: r.comment ?? "",
    }));
  } catch (e) {
    // Sin esto, el catch se tragaría la excepción de arriba y la volvería a convertir en la
    // lista vacía, que es justo el comportamiento que este cambio viene a sacar.
    if (e instanceof ErrorDeLecturaDeDatos) throw e;
    errorDeLectura("getReviewsForPainter", e);
  }
}

export const getReviewsForPainter = publico(leer_getReviewsForPainter, "getReviewsForPainter", [ETIQUETAS.resenas]);

export interface Testimonial {
  id: string;
  author: string;
  /** Sólo para completar el nombre con los permisos de quien mira (`conNombresDeAutores`). */
  autorId?: string | null;
  rating: number;
  comment: string;
  painter: string;
  painterId: string;
}

/** Reseñas recientes con comentario, para el carrusel de testimonios de la home. */
async function leer_getRecentReviews(limit = 8): Promise<Testimonial[]> {
  if (!SUPA) return [];
  try {
    const supabase = createPublicClient();
    const { data, error } = await supabase
      .from("reviews")
      .select("id, rating, comment, author_id, target_id, created_at")
      .not("comment", "is", null)
      .gte("rating", 4)
      .order("created_at", { ascending: false })
      .limit(limit);
    if (error || !data) {
      if (error) dbError("getRecentReviews", error);
      return [];
    }
    const rows = data as unknown as {
      id: string;
      rating: number;
      comment: string | null;
      author_id: string | null;
      target_id: string;
    }[];
    // `author_id` puede ser NULL desde la migración 0019: la reseña sobrevive a la baja de
    // quien la escribió. Se filtra para no mandarle NULL a la consulta, y más abajo esos
    // casos se muestran como cuenta dada de baja en vez de "Cliente", que haría pensar que
    // hay alguien ahí.
    // Sólo los pintores: son públicos. El autor lo completa `conNombresDeAutores` (ver arriba).
    const ids = [...new Set(rows.map((r) => r.target_id).filter(Boolean))] as string[];
    const names = new Map<string, string>();
    if (ids.length) {
      const { data: ps } = await supabase.from("profiles").select("id, full_name").in("id", ids);
      for (const p of (ps ?? []) as unknown as { id: string; full_name: string | null }[])
        names.set(p.id, p.full_name ?? "");
    }
    return rows
      .filter((r) => (r.comment ?? "").trim().length > 0)
      .map((r) => ({
        id: r.id,
        author: r.author_id ? "Cliente" : BAJA,
        autorId: r.author_id,
        rating: r.rating,
        comment: (r.comment ?? "").trim(),
        painter: names.get(r.target_id) || "un pintor",
        painterId: r.target_id,
      }));
  } catch (e) {
    dbError("getRecentReviews", e);
    return [];
  }
}

export const getRecentReviews = publico(leer_getRecentReviews, "getRecentReviews", [ETIQUETAS.resenas]);

/**
 * Completa el nombre del autor de cada reseña con los permisos de QUIEN MIRA, y saca el id del
 * autor antes de que nada llegue al navegador.
 *
 * Las reseñas salen de la caché pública, que lee como visitante anónimo, y un anónimo no
 * puede leer el perfil de un cliente (0013): para él, el autor es "Cliente". Pero quien tiene
 * cuenta sí ve el nombre —lo prometen /privacidad y el formulario de reseña—. La caché lo
 * había roto para todos (lo encontró `recorrido-web` cliente, 29/9): una reseña recién escrita
 * aparecía como "Cliente" hasta para su autora. Sin sesión no se consulta nada.
 */
export async function conNombresDeAutores<T extends { author: string; autorId?: string | null }>(
  items: T[],
): Promise<Omit<T, "autorId">[]> {
  const sinId = ({ autorId: _autorId, ...resto }: T) => resto;
  const ids = [...new Set(items.map((i) => i.autorId).filter(Boolean))] as string[];
  if (!SUPA || !ids.length) return items.map(sinId);
  try {
    const supabase = await createClient();
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session) return items.map(sinId);
    const { data } = await supabase.from("profiles").select("id, full_name").in("id", ids);
    const nombres = new Map<string, string>();
    for (const p of (data ?? []) as unknown as { id: string; full_name: string | null }[])
      if (p.full_name) nombres.set(p.id, p.full_name);
    return items.map((i) => sinId({ ...i, author: (i.autorId && nombres.get(i.autorId)) || i.author }));
  } catch (e) {
    unstable_rethrow(e);
    return items.map(sinId);
  }
}
