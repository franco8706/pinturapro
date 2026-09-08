import { unstable_rethrow } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { mockPainters, mockProjects, type Painter, type Project } from "@/lib/data";


import type { ProfileType, LeadKind, LeadStatus } from "@/lib/supabase/types";

/**
 * Un fallo de base no puede ser invisible.
 *
 * Antes cada catch de este archivo estaba vacío y varias funciones caían a los mocks sin
 * registrar nada. Con el proyecto de Supabase caído, el sitio devolvía 200 y mostraba
 * pintores de mentira: no había forma de enterarse de que la base no respondía.
 */
function dbError(fn: string, e: unknown): void {
  // Next señaliza con excepciones: redirect(), notFound(), la detección de render dinámico.
  // Los catch de este archivo se las estaban tragando. `unstable_rethrow` las relanza todas
  // —incluso envueltas en `cause`— y es la lista que mantiene Next, no una nuestra a mano:
  // la versión anterior chequeaba "NEXT_NOT_FOUND", un digest que ya no existe en Next 15.5.
  unstable_rethrow(e);

  // Los errores de PostgREST no son `Error`: son objetos { message, code, details, hint }.
  // Sin este desarmado el log terminaba siendo "[object Object]", que no sirve para nada.
  // `details` trae el stack completo en varias líneas; nos quedamos con la causa raíz
  // (la línea "Caused by:") para que el log sea una sola línea y siga siendo accionable.
  const firstLine = (v: unknown) => String(v).split("\n").find((l) => l.trim()) ?? "";
  const cause = (v: unknown) =>
    String(v)
      .split("\n")
      .map((l) => l.trim())
      .find((l) => l.startsWith("Caused by:"));

  let msg: string;
  if (e instanceof Error) {
    msg = e.message;
  } else if (e && typeof e === "object") {
    const o = e as { message?: unknown; code?: unknown; details?: unknown };
    const parts = [
      o.message ? firstLine(o.message) : "",
      o.code ? `code=${o.code}` : "",
      o.details ? cause(o.details) ?? "" : "",
    ].filter(Boolean);
    msg = [...new Set(parts)].join(" · ") || JSON.stringify(e);
  } else {
    msg = String(e);
  }
  console.error(`[db] ${fn} falló: ${msg}`);
}

// Si no hay Supabase configurado (o falla una query), caemos a los mocks → la web nunca se rompe.
const SUPA = !!process.env.NEXT_PUBLIC_SUPABASE_URL;

function levelFromRating(rating: number, verified: boolean): Painter["level"] {
  if (rating >= 4.8 && verified) return "Master";
  if (rating >= 4.5) return "Gold";
  return "Silver";
}

// Color de acento estable por proyecto (la BD todavía no guarda accent_color).
const PALETTE = ["#C41E3A", "#1E3A8A", "#2D5A3D", "#B45309", "#3F3F46", "#0F766E"];
function colorFor(seed: string): string {
  let h = 0;
  for (const ch of seed) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return PALETTE[h % PALETTE.length];
}

/** Pintores verificados (profiles type=painter), ordenados por rating. */
export async function getPainters(): Promise<Painter[]> {
  if (!SUPA) return mockPainters;
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("profiles")
      .select("id, full_name, avatar_url, location, verified, rating, rating_count, specialties, lat, lng")
      .eq("type", "painter")
      .order("rating", { ascending: false })
      .limit(60); // tope: el directorio se sirve entero a un Client Component
    if (error || !data) {
      if (error) dbError("getPainters", error);
      return mockPainters;
    }
    const rows = data as unknown as {
      id: string;
      full_name: string | null;
      avatar_url: string | null;
      location: string | null;
      verified: boolean;
      rating: number;
      rating_count: number;
      specialties: string[] | null;
      lat: number | null;
      lng: number | null;
    }[];
    return rows.map((p) => ({
      id: p.id,
      name: p.full_name ?? "Pintor",
      level: levelFromRating(Number(p.rating), p.verified),
      rating: Number(p.rating),
      reviews: p.rating_count,
      specialty: p.specialties ?? [],
      zone: p.location ?? "",
      image: p.avatar_url ?? "",
      portfolio: [],
      lat: p.lat,
      lng: p.lng,
    }));
  } catch (e) {
    dbError("getPainters", e);
    return mockPainters;
  }
}

/** Obras del portfolio publicadas (projects type=portfolio, published=true). */
export async function getProjects(): Promise<Project[]> {
  if (!SUPA) return mockProjects;
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("projects")
      .select("id, slug, title, description, cover_url, images, location, created_at, category, accent_color")
      .eq("type", "portfolio")
      .eq("published", true)
      .order("created_at", { ascending: false })
      .limit(60); // tope: el portfolio se sirve entero
    if (error || !data) {
      if (error) dbError("getProjects", error);
      return mockProjects;
    }
    return (data as unknown as ProjectRow[]).map(mapProject);
  } catch (e) {
    dbError("getProjects", e);
    return mockProjects;
  }
}

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
export async function getProjectBySlug(slug: string): Promise<Project | null> {
  if (!SUPA) return mockProjects.find((p) => p.slug === slug) ?? null;
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("projects")
      .select("id, slug, title, description, cover_url, images, location, created_at, category, accent_color")
      .eq("slug", slug)
      .eq("published", true)
      .maybeSingle();
    if (error || !data) {
      if (error) dbError("getProjectBySlug", error);
      return null;
    }
    return mapProject(data as unknown as ProjectRow);
  } catch (e) {
    dbError("getProjectBySlug", e);
    return null;
  }
}

export interface PainterDetail extends Painter {
  bio: string;
}

export interface ReviewView {
  id: string;
  author: string;
  rating: number;
  date: string;
  comment: string;
  project?: string;
}

/** Un pintor por id (perfil público). */
export async function getPainterById(id: string): Promise<PainterDetail | null> {
  if (!SUPA) {
    const m = mockPainters.find((p) => p.id === id);
    return m ? { ...m, bio: "" } : null;
  }
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("profiles")
      .select("id, full_name, avatar_url, location, bio, verified, rating, rating_count, specialties")
      .eq("id", id)
      .in("type", ["painter", "company"])
      .maybeSingle();
    if (error || !data) {
      if (error) dbError("getPainterById", error);
      return null;
    }
    const p = data as unknown as {
      id: string;
      full_name: string | null;
      avatar_url: string | null;
      location: string | null;
      bio: string | null;
      verified: boolean;
      rating: number;
      rating_count: number;
      specialties: string[] | null;
    };
    return {
      id: p.id,
      name: p.full_name ?? "Pintor",
      level: levelFromRating(Number(p.rating), p.verified),
      rating: Number(p.rating),
      reviews: p.rating_count,
      specialty: p.specialties ?? [],
      zone: p.location ?? "",
      image: p.avatar_url ?? "",
      portfolio: [],
      bio: p.bio ?? "",
    };
  } catch (e) {
    dbError("getPainterById", e);
    return null;
  }
}

/** Obras publicadas de un dueño (portfolio del pintor/empresa). */
export async function getProjectsByOwner(ownerId: string): Promise<Project[]> {
  if (!SUPA) return [];
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("projects")
      .select("id, slug, title, description, cover_url, images, location, created_at, category, accent_color")
      .eq("type", "portfolio")
      .eq("published", true)
      .eq("owner_id", ownerId)
      .order("created_at", { ascending: false })
      .limit(24); // tope: portfolio de un pintor
    if (error || !data) {
      if (error) dbError("getProjectsByOwner", error);
      return [];
    }
    return (data as unknown as ProjectRow[]).map(mapProject);
  } catch (e) {
    dbError("getProjectsByOwner", e);
    return [];
  }
}

export interface OwnProfile {
  id: string;
  type: ProfileType;
  /** false = llegó por OAuth y todavía no eligió rol (va a /bienvenida). */
  onboarded: boolean;
  /** Acceso al panel de administración. Nada que ver con type='company': ese es un rol
   *  de negocio que cualquiera elige al registrarse. Este flag sólo se activa por SQL. */
  isAdmin: boolean;
  name: string;
  image: string;
  verified: boolean;
  rating: number;
  ratingCount: number;
  level: Painter["level"];
  bio: string;
  specialty: string[];
  zone: string;
}

/**
 * El perfil no se pudo LEER (permisos, red, base caída). Distinto de "no hay perfil".
 *
 * Existe porque confundir las dos cosas hacía daño real: cuando `profiles` no se podía leer,
 * `getOwnProfile` devolvía `null` igual que si la fila no existiera, y las cuatro páginas que
 * hacen `if (!profile || !profile.onboarded) redirect("/bienvenida")` mandaban a elegir rol a
 * gente que ya lo tenía elegido, sin decirle nada. Pasó de verdad: la migración 0008 agregó
 * `profiles.is_admin` sin sumarla al grant por columna de 0006, y todo usuario logueado
 * quedó rebotando a /bienvenida. El propio 0006 avisa que esto se repite con cada columna
 * nueva, así que el modo de falla necesita ser ruidoso, no silencioso.
 */
export class ErrorDeLecturaDePerfil extends Error {
  constructor(causa: string) {
    super(`No se pudo leer el perfil: ${causa}`);
    this.name = "ErrorDeLecturaDePerfil";
  }
}

/**
 * Perfil de la cuenta logueada, sin filtrar por tipo (sirve para rutear al panel correcto).
 *
 * Devuelve `null` SÓLO si la cuenta todavía no tiene fila en `profiles` (alta a medias).
 * Si la lectura falla, tira `ErrorDeLecturaDePerfil` y la ataja `app/error.tsx`: es preferible
 * decir "algo se rompió" que rutear a la persona a un lugar equivocado como si fuera normal.
 */
export async function getOwnProfile(id: string): Promise<OwnProfile | null> {
  if (!SUPA) return null;
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("profiles")
      .select("id, type, onboarded, is_admin, full_name, avatar_url, location, bio, verified, rating, rating_count, specialties")
      .eq("id", id)
      .maybeSingle();
    if (error) {
      dbError("getOwnProfile", error);
      throw new ErrorDeLecturaDePerfil(error.message ?? "error de la base");
    }
    // Sin error y sin fila: la cuenta existe en auth pero no en profiles. El llamador la
    // manda a /bienvenida, que es exactamente lo que corresponde.
    if (!data) return null;
    const p = data as unknown as {
      id: string;
      type: ProfileType;
      onboarded: boolean | null;
      is_admin: boolean | null;
      full_name: string | null;
      avatar_url: string | null;
      location: string | null;
      bio: string | null;
      verified: boolean;
      rating: number;
      rating_count: number;
      specialties: string[] | null;
    };
    return {
      id: p.id,
      type: p.type,
      // Si la columna todavía no existe (migración 0003 sin correr) asumimos onboarded:
      // es preferible dejar entrar que trabar a todos en /bienvenida.
      onboarded: p.onboarded ?? true,
      // Si la columna todavía no existe (migración 0008 sin correr) nadie es admin:
      // acá se falla CERRADO, al revés que onboarded — es un privilegio, no un paso de alta.
      isAdmin: p.is_admin ?? false,
      name: p.full_name ?? "",
      image: p.avatar_url ?? "",
      verified: p.verified,
      rating: Number(p.rating),
      ratingCount: p.rating_count,
      level: levelFromRating(Number(p.rating), p.verified),
      bio: p.bio ?? "",
      specialty: p.specialties ?? [],
      zone: p.location ?? "",
    };
  } catch (e) {
    // Sin esto el catch se tragaba la excepción de arriba y la volvía a convertir en null,
    // que es justo el comportamiento que este cambio viene a sacar.
    if (e instanceof ErrorDeLecturaDePerfil) throw e;
    dbError("getOwnProfile", e);
    throw new ErrorDeLecturaDePerfil(e instanceof Error ? e.message : String(e));
  }
}


export interface ClientJobView {
  id: string;
  status: string;
  statusLabel: string;
  amount: number | null;
  painter: string | null;
  painterId: string | null;
  project: string | null;
  reviewed: boolean;
}

/** Trabajos del cliente, con el pintor y la obra resueltos (respeta RLS con sesión). */
export async function getJobsForClient(clientId: string): Promise<ClientJobView[]> {
  if (!SUPA) return [];
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("jobs")
      .select("id, status, amount, painter_id, project_id, created_at")
      .eq("client_id", clientId)
      .order("created_at", { ascending: false })
      .limit(50); // tope: los ids alimentan .in() derivados
    if (error || !data) {
      if (error) dbError("getJobsForClient", error);
      return [];
    }
    const rows = data as unknown as {
      id: string;
      status: string;
      amount: number | null;
      painter_id: string | null;
      project_id: string | null;
    }[];
    const painterIds = [...new Set(rows.map((r) => r.painter_id).filter(Boolean))] as string[];
    const projectIds = [...new Set(rows.map((r) => r.project_id).filter(Boolean))] as string[];
    const jobIds = rows.map((r) => r.id);

    // Las tres consultas derivadas dependen sólo de `rows`, no entre sí: iban encadenadas
    // con await y pagaban 4 idas y vueltas donde alcanzan 2.
    const [ps, pr, rv] = await Promise.all([
      painterIds.length
        ? supabase.from("profiles").select("id, full_name").in("id", painterIds)
        : Promise.resolve({ data: [], error: null }),
      projectIds.length
        ? supabase.from("projects").select("id, title").in("id", projectIds)
        : Promise.resolve({ data: [], error: null }),
      jobIds.length
        ? supabase.from("reviews").select("job_id").eq("author_id", clientId).in("job_id", jobIds)
        : Promise.resolve({ data: [], error: null }),
    ]);

    const names = new Map<string, string>();
    for (const p of (ps.data ?? []) as unknown as { id: string; full_name: string | null }[])
      names.set(p.id, p.full_name ?? "Pintor");

    const titles = new Map<string, string>();
    for (const p of (pr.data ?? []) as unknown as { id: string; title: string }[]) titles.set(p.id, p.title);

    // Qué trabajos ya tienen reseña de este cliente (para no ofrecer reseñar dos veces).
    const reviewed = new Set<string>();
    for (const r of (rv.data ?? []) as unknown as { job_id: string }[]) reviewed.add(r.job_id);
    return rows.map((r) => ({
      id: r.id,
      status: r.status,
      statusLabel: JOB_STATUS_LABEL[r.status] ?? r.status,
      amount: r.amount,
      painter: r.painter_id ? names.get(r.painter_id) ?? "Pintor" : null,
      painterId: r.painter_id,
      project: r.project_id ? titles.get(r.project_id) ?? null : null,
      reviewed: reviewed.has(r.id),
    }));
  } catch (e) {
    dbError("getJobsForClient", e);
    return [];
  }
}

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

/** Reseñas dirigidas a un pintor, con el nombre del autor resuelto. */
export async function getReviewsForPainter(painterId: string): Promise<ReviewView[]> {
  if (!SUPA) return [];
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("reviews")
      .select("id, rating, comment, created_at, author_id")
      .eq("target_id", painterId)
      .order("created_at", { ascending: false })
      .limit(30); // tope: reseñas de un perfil
    if (error || !data) {
      if (error) dbError("getReviewsForPainter", error);
      return [];
    }
    const rows = data as unknown as {
      id: string;
      rating: number;
      comment: string | null;
      created_at: string;
      author_id: string;
    }[];
    const authorIds = [...new Set(rows.map((r) => r.author_id))];
    const names = new Map<string, string>();
    if (authorIds.length) {
      const { data: authors } = await supabase.from("profiles").select("id, full_name").in("id", authorIds);
      for (const a of (authors ?? []) as unknown as { id: string; full_name: string | null }[]) {
        names.set(a.id, a.full_name ?? "Cliente");
      }
    }
    return rows.map((r) => ({
      id: r.id,
      author: names.get(r.author_id) ?? "Cliente",
      rating: r.rating,
      date: monthYear(r.created_at),
      comment: r.comment ?? "",
    }));
  } catch (e) {
    dbError("getReviewsForPainter", e);
    return [];
  }
}

const MESES = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
function monthYear(iso: string): string {
  const d = new Date(iso);
  return `${MESES[d.getMonth()]} ${d.getFullYear()}`;
}

export interface JobView {
  id: string;
  status: string;
  statusLabel: string;
  amount: number | null;
  client: string;
  project: string | null;
}

const JOB_STATUS_LABEL: Record<string, string> = {
  draft: "Borrador",
  published: "Publicado",
  quoted: "Cotizado",
  accepted: "Aceptado",
  in_progress: "En curso",
  completed: "Completado",
  cancelled: "Cancelado",
};

/** Trabajos donde el pintor participa, con cliente y obra resueltos (respeta RLS con sesión). */
export async function getJobsForPainter(painterId: string): Promise<JobView[]> {
  if (!SUPA) return [];
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("jobs")
      .select("id, status, amount, client_id, project_id, created_at")
      .eq("painter_id", painterId)
      .order("created_at", { ascending: false })
      .limit(50); // tope: los ids alimentan .in() derivados
    if (error || !data) {
      if (error) dbError("getJobsForPainter", error);
      return [];
    }
    const rows = data as unknown as {
      id: string;
      status: string;
      amount: number | null;
      client_id: string;
      project_id: string | null;
    }[];
    const clientIds = [...new Set(rows.map((r) => r.client_id))];
    const projectIds = [...new Set(rows.map((r) => r.project_id).filter(Boolean))] as string[];
    const names = new Map<string, string>();
    const titles = new Map<string, string>();
    if (clientIds.length) {
      const { data: cs } = await supabase.from("profiles").select("id, full_name").in("id", clientIds);
      for (const c of (cs ?? []) as unknown as { id: string; full_name: string | null }[])
        names.set(c.id, c.full_name ?? "Cliente");
    }
    if (projectIds.length) {
      const { data: ps } = await supabase.from("projects").select("id, title").in("id", projectIds);
      for (const p of (ps ?? []) as unknown as { id: string; title: string }[]) titles.set(p.id, p.title);
    }
    return rows.map((r) => ({
      id: r.id,
      status: r.status,
      statusLabel: JOB_STATUS_LABEL[r.status] ?? r.status,
      amount: r.amount,
      client: names.get(r.client_id) ?? "Cliente",
      project: r.project_id ? titles.get(r.project_id) ?? null : null,
    }));
  } catch (e) {
    dbError("getJobsForPainter", e);
    return [];
  }
}

// ───────────────────────── Marketplace ─────────────────────────

export interface ServiceRequest {
  id: string;
  title: string;
  description: string;
  location: string;
  budgetMin: number | null;
  budgetMax: number | null;
  ownerId: string;
  ownerName: string;
  date: string;
}

/** Pedidos de trabajo abiertos (projects type=service, published) para que los pintores coticen. */
export async function getOpenServiceRequests(): Promise<ServiceRequest[]> {
  if (!SUPA) return [];
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("projects")
      .select("id, title, description, location, budget_min, budget_max, owner_id, created_at")
      .eq("type", "service")
      .eq("published", true)
      .order("created_at", { ascending: false })
      .limit(50); // tope: tablero de trabajos
    if (error || !data) {
      if (error) dbError("getOpenServiceRequests", error);
      return [];
    }
    const rows = data as unknown as {
      id: string;
      title: string;
      description: string | null;
      location: string | null;
      budget_min: number | null;
      budget_max: number | null;
      owner_id: string;
      created_at: string;
    }[];
    const ownerIds = [...new Set(rows.map((r) => r.owner_id))];
    const names = new Map<string, string>();
    if (ownerIds.length) {
      const { data: os } = await supabase.from("profiles").select("id, full_name").in("id", ownerIds);
      for (const o of (os ?? []) as unknown as { id: string; full_name: string | null }[])
        names.set(o.id, o.full_name ?? "Cliente");
    }
    return rows.map((r) => ({
      id: r.id,
      title: r.title,
      description: r.description ?? "",
      location: r.location ?? "",
      budgetMin: r.budget_min,
      budgetMax: r.budget_max,
      ownerId: r.owner_id,
      ownerName: names.get(r.owner_id) ?? "Cliente",
      date: monthYear(r.created_at),
    }));
  } catch (e) {
    dbError("getOpenServiceRequests", e);
    return [];
  }
}

export interface QuoteView {
  id: string;
  /** El pedido al que pertenece. Necesario para no mezclar cotizaciones de
   *  trabajos distintos al decidir cuál ya fue adjudicado. */
  projectId: string | null;
  amount: number | null;
  note: string | null;
  status: string;
  statusLabel: string;
  painterId: string;
  painter: string;
  painterLevel: Painter["level"];
  painterRating: number;
  request: string | null;
}

/** Cotizaciones recibidas por el cliente, con el pintor y el pedido resueltos. */
export async function getQuotesForClient(clientId: string): Promise<QuoteView[]> {
  if (!SUPA) return [];
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("jobs")
      .select("id, amount, note, status, painter_id, project_id, created_at")
      .eq("client_id", clientId)
      .in("status", ["quoted", "accepted"])
      .order("created_at", { ascending: false })
      .limit(50); // tope: los ids alimentan .in() derivados
    if (error || !data) {
      if (error) dbError("getQuotesForClient", error);
      return [];
    }
    const rows = data as unknown as {
      id: string;
      amount: number | null;
      note: string | null;
      status: string;
      painter_id: string | null;
      project_id: string | null;
    }[];
    const painterIds = [...new Set(rows.map((r) => r.painter_id).filter(Boolean))] as string[];
    const projectIds = [...new Set(rows.map((r) => r.project_id).filter(Boolean))] as string[];
    const painters = new Map<string, { name: string; level: Painter["level"]; rating: number }>();
    const titles = new Map<string, string>();
    if (painterIds.length) {
      const { data: ps } = await supabase
        .from("profiles")
        .select("id, full_name, verified, rating")
        .in("id", painterIds);
      for (const p of (ps ?? []) as unknown as {
        id: string;
        full_name: string | null;
        verified: boolean;
        rating: number;
      }[])
        painters.set(p.id, {
          name: p.full_name ?? "Pintor",
          level: levelFromRating(Number(p.rating), p.verified),
          rating: Number(p.rating),
        });
    }
    if (projectIds.length) {
      const { data: pr } = await supabase.from("projects").select("id, title").in("id", projectIds);
      for (const p of (pr ?? []) as unknown as { id: string; title: string }[]) titles.set(p.id, p.title);
    }
    return rows.map((r) => {
      const p = r.painter_id ? painters.get(r.painter_id) : undefined;
      return {
        id: r.id,
        projectId: r.project_id,
        amount: r.amount,
        note: r.note,
        status: r.status,
        statusLabel: JOB_STATUS_LABEL[r.status] ?? r.status,
        painterId: r.painter_id ?? "",
        painter: p?.name ?? "Pintor",
        painterLevel: p?.level ?? "Silver",
        painterRating: p?.rating ?? 0,
        request: r.project_id ? titles.get(r.project_id) ?? null : null,
      };
    });
  } catch (e) {
    dbError("getQuotesForClient", e);
    return [];
  }
}

// ───────────────────────── Contenido dinámico ─────────────────────────

export interface Faq {
  id: string;
  question: string;
  answer: string;
}

/** Preguntas básicas antes de un presupuesto. Fail-safe si la tabla no existe aún. */
export async function getFaqs(): Promise<Faq[]> {
  if (!SUPA) return [];
  try {
    const supabase = await createClient();
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
export async function getResources(kind?: ResourceKind): Promise<Resource[]> {
  if (!SUPA) return [];
  try {
    const supabase = await createClient();
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

export interface NewsItem {
  id: string;
  title: string;
  excerpt: string | null;
  coverUrl: string | null;
  url: string | null;
  date: string;
}

/** Noticias para el carrusel. */
export async function getNews(): Promise<NewsItem[]> {
  if (!SUPA) return [];
  try {
    const supabase = await createClient();
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

export interface Testimonial {
  id: string;
  author: string;
  rating: number;
  comment: string;
  painter: string;
  painterId: string;
}

/** Reseñas recientes con comentario, para el carrusel de testimonios de la home. */
export async function getRecentReviews(limit = 8): Promise<Testimonial[]> {
  if (!SUPA) return [];
  try {
    const supabase = await createClient();
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
      author_id: string;
      target_id: string;
    }[];
    const ids = [...new Set([...rows.map((r) => r.author_id), ...rows.map((r) => r.target_id)])];
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
        author: names.get(r.author_id) || "Cliente",
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

/** Puntos a favor / a considerar del pintor. Fail-safe si las columnas no existen aún. */
export async function getPainterExtras(id: string): Promise<{ pros: string[]; cons: string[] }> {
  if (!SUPA) return { pros: [], cons: [] };
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.from("profiles").select("pros, cons").eq("id", id).maybeSingle();
    if (error || !data) {
      if (error) dbError("getPainterExtras", error);
      return { pros: [], cons: [] };
    }
    const p = data as unknown as { pros: string[] | null; cons: string[] | null };
    return { pros: p.pros ?? [], cons: p.cons ?? [] };
  } catch (e) {
    dbError("getPainterExtras", e);
    return { pros: [], cons: [] };
  }
}

export function formatARS(n: number | null): string {
  if (n == null) return "—";
  return new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 }).format(n);
}

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

export interface PedidoPropio {
  id: string;
  title: string;
  location: string;
  budgetMin: number | null;
  budgetMax: number | null;
  published: boolean;
  /** Cotizaciones VIVAS (status='quoted'), las únicas que el cliente todavía puede aceptar. */
  cotizaciones: number;
  /**
   * En qué anda el pedido, mirando los trabajos que salieron de él.
   *
   * Hace falta porque `cotizaciones` sólo cuenta las vivas: al aceptar una, el resto se
   * cancela y la aceptada deja de ser 'quoted', así que el contador vuelve a cero. El panel
   * entonces mostraba "Cerrado · Sin cotizaciones aún" en un pedido que en realidad se
   * adjudicó y se terminó — el cartel decía lo contrario de lo que había pasado.
   */
  estado: "abierto" | "adjudicado" | "terminado" | "cerrado";
  date: string;
}

/**
 * Los pedidos de servicio que publicó un cliente.
 *
 * Existe porque /cliente listaba sólo `jobs`, que se pueblan cuando un PINTOR cotiza. Un
 * pedido sin cotizaciones no existía para el panel: el cliente publicaba, veía "Tu trabajo
 * está publicado", entraba a su panel y leía "Todavía no pediste ningún trabajo". Varios
 * terminaban publicando de nuevo y duplicando el pedido.
 */
export async function getPedidosDelCliente(clientId: string): Promise<PedidoPropio[]> {
  if (!SUPA) return [];
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("projects")
      .select("id, title, location, budget_min, budget_max, published, created_at")
      .eq("owner_id", clientId)
      .eq("type", "service")
      .order("created_at", { ascending: false })
      .limit(50);
    if (error || !data) {
      if (error) dbError("getPedidosDelCliente", error);
      return [];
    }
    const rows = data as unknown as {
      id: string;
      title: string;
      location: string | null;
      budget_min: number | null;
      budget_max: number | null;
      published: boolean;
      created_at: string;
    }[];
    if (rows.length === 0) return [];

    // Todos los trabajos de estos pedidos, no sólo los 'quoted': con el estado de cada uno
    // se sabe si el pedido sigue esperando ofertas, ya se adjudicó, o terminó.
    const conteo = new Map<string, number>();
    const estados = new Map<string, Set<string>>();
    const { data: js, error: errJobs } = await supabase
      .from("jobs")
      .select("project_id, status")
      .in("project_id", rows.map((r) => r.id));
    if (errJobs) dbError("getPedidosDelCliente/jobs", errJobs);
    for (const j of (js ?? []) as unknown as { project_id: string | null; status: string }[]) {
      if (!j.project_id) continue;
      if (j.status === "quoted") conteo.set(j.project_id, (conteo.get(j.project_id) ?? 0) + 1);
      const set = estados.get(j.project_id) ?? new Set<string>();
      set.add(j.status);
      estados.set(j.project_id, set);
    }

    return rows.map((r) => {
      const s = estados.get(r.id) ?? new Set<string>();
      // El orden importa: un pedido terminado pudo tener antes cotizaciones perdedoras
      // canceladas, y lo que hay que contar es cómo terminó, no por dónde pasó.
      const estado: PedidoPropio["estado"] = s.has("completed")
        ? "terminado"
        : s.has("accepted") || s.has("in_progress")
          ? "adjudicado"
          : r.published
            ? "abierto"
            : "cerrado";
      return {
        id: r.id,
        title: r.title,
        location: r.location ?? "",
        budgetMin: r.budget_min,
        budgetMax: r.budget_max,
        published: r.published,
        cotizaciones: conteo.get(r.id) ?? 0,
        estado,
        date: monthYear(r.created_at),
      };
    });
  } catch (e) {
    dbError("getPedidosDelCliente", e);
    return [];
  }
}
