/**
 * Obras del portfolio: el listado, una obra y las de un pintor.
 * (Parte de lib/queries: ver index.ts.)
 */
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { createPublicClient } from "@/lib/supabase/publico";
import { publico, ETIQUETAS } from "@/lib/cache-publico";
import { mockProjects, type Project } from "@/lib/data";
import { dbError, SUPA, colorFor, ErrorDeLecturaDeDatos, errorDeLectura } from "./base";

/** Obras del portfolio publicadas (projects type=portfolio, published=true). */
async function leer_getProjects(): Promise<Project[]> {
  if (!SUPA) return mockProjects;
  try {
    const supabase = createPublicClient();
    const { data, error } = await supabase
      .from("projects")
      .select("id, slug, title, description, cover_url, images, location, created_at, category, accent_color")
      .eq("type", "portfolio")
      .eq("published", true)
      .order("created_at", { ascending: false })
      .limit(60); // tope: el portfolio se sirve entero
    if (error || !data) {
      if (error) dbError("getProjects", error);
      throw new ErrorDeLecturaDeDatos("obras", error?.message ?? "sin datos");
    }
    return (data as unknown as ProjectRow[]).map(mapProject);
  } catch (e) {
    if (e instanceof ErrorDeLecturaDeDatos) throw e;
    dbError("getProjects", e);
    throw new ErrorDeLecturaDeDatos("obras", String(e));
  }
}

export const getProjects = publico(leer_getProjects, "getProjects", [ETIQUETAS.obras]);

interface ProjectRow {
  id: string;
  slug: string | null;
  title: string;
  description: string | null;
  cover_url: string | null;
  images: string[] | null;
  location: string | null;
  created_at: string | null;
  category: Project["category"] | null;
  accent_color: string | null;
}

function mapProject(p: ProjectRow): Project {
  return {
    id: p.id,
    slug: p.slug ?? p.id,
    title: p.title,
    location: p.location ?? "",
    category: p.category ?? "Residencial",
    accentColor: p.accent_color ?? colorFor(p.slug ?? p.id),
    year: p.created_at ? new Date(p.created_at).getFullYear() : new Date().getFullYear(),
    description: p.description ?? "",
    images: p.images?.length ? p.images : p.cover_url ? [p.cover_url] : [],
  };
}

/**
 * Una obra por su slug.
 *
 * Consulta por la clave en vez de bajar el portfolio entero y filtrar en memoria: `slug`
 * tiene índice UNIQUE desde 0001. Con el filtrado en JS, una obra que quedara fuera del
 * tope de filas de PostgREST (1000 por defecto) daba 404 aunque existiera y estuviera
 * publicada — y con la base caída servía una obra falsa con 200.
 */
/**
 * `cache()` de React: `generateMetadata` y el cuerpo de la página piden la MISMA obra, así
 * que sin esto cada visita a /obras/[slug] pegaba dos veces a la base para lo mismo. El
 * cache dura lo que dura el render de ese request, no filtra entre usuarios.
 */
export const getProjectBySlug = cache(
  publico(async (slug: string): Promise<Project | null> => {
  if (!SUPA) return mockProjects.find((p) => p.slug === slug) ?? null;
  try {
    const supabase = createPublicClient();
    const { data, error } = await supabase
      .from("projects")
      .select("id, slug, title, description, cover_url, images, location, created_at, category, accent_color")
      .eq("slug", slug)
      .eq("published", true)
      .maybeSingle();
    // `null` significa "esta obra no existe" y la página responde 404. Un fallo de lectura NO
    // es eso: decirle a la persona —y a Google— que la obra no existe porque la base tuvo un
    // problema es mentira, y encima saca la página del buscador. Los dos casos se separan.
    if (error) {
      dbError("getProjectBySlug", error);
      throw new ErrorDeLecturaDeDatos("la obra", error.message ?? "error de la base");
    }
    if (!data) return null;
    return mapProject(data as unknown as ProjectRow);
  } catch (e) {
    if (e instanceof ErrorDeLecturaDeDatos) throw e;
    dbError("getProjectBySlug", e);
    throw new ErrorDeLecturaDeDatos("la obra", String(e));
  }
  }, "getProjectBySlug", [ETIQUETAS.obras]),
);

/** Obras publicadas de un dueño (portfolio del pintor/empresa). */
async function leer_getProjectsByOwner(ownerId: string): Promise<Project[]> {
  if (!SUPA) return [];
  try {
    const supabase = createPublicClient();
    const { data, error } = await supabase
      .from("projects")
      .select("id, slug, title, description, cover_url, images, location, created_at, category, accent_color")
      .eq("type", "portfolio")
      .eq("published", true)
      .eq("owner_id", ownerId)
      .order("created_at", { ascending: false })
      .limit(24); // tope: portfolio de un pintor
    // Falló la lectura: es distinto de "no hay filas" y no se puede mostrar como si fuera lo mismo.
    if (error) errorDeLectura("getProjectsByOwner", error);
    // Sin error y sin filas: genuinamente no hay nada todavía. La lista vacía es correcta.
    if (!data) return [];
    return (data as unknown as ProjectRow[]).map(mapProject);
  } catch (e) {
    // Sin esto, el catch se tragaría la excepción de arriba y la volvería a convertir en la
    // lista vacía, que es justo el comportamiento que este cambio viene a sacar.
    if (e instanceof ErrorDeLecturaDeDatos) throw e;
    errorDeLectura("getProjectsByOwner", e);
  }
}

export const getProjectsByOwner = publico(leer_getProjectsByOwner, "getProjectsByOwner", [ETIQUETAS.obras]);

export interface OwnedProjectForm {
  id: string;
  title: string;
  description: string;
  category: string;
  location: string;
  accent: string;
  cover: string;
}

/** Una obra propia por slug, con los campos crudos para precargar el form de edición. */
export async function getOwnedProjectBySlug(ownerId: string, slug: string): Promise<OwnedProjectForm | null> {
  if (!SUPA) return null;
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("projects")
      .select("id, title, description, category, location, accent_color, cover_url")
      .eq("owner_id", ownerId)
      .eq("slug", slug)
      .maybeSingle();
    if (error || !data) {
      if (error) dbError("getOwnedProjectBySlug", error);
      return null;
    }
    const p = data as unknown as {
      id: string;
      title: string;
      description: string | null;
      category: string | null;
      location: string | null;
      accent_color: string | null;
      cover_url: string | null;
    };
    return {
      id: p.id,
      title: p.title,
      description: p.description ?? "",
      category: p.category ?? "Residencial",
      location: p.location ?? "",
      accent: p.accent_color ?? "#3F3F46",
      cover: p.cover_url ?? "",
    };
  } catch (e) {
    dbError("getOwnedProjectBySlug", e);
    return null;
  }
}
