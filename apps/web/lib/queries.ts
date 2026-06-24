import { createClient } from "@/lib/supabase/server";
import { mockPainters, mockProjects, type Painter, type Project } from "@/lib/data";
import type { ProfileType } from "@/lib/supabase/types";

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
      .select("id, full_name, avatar_url, location, verified, rating, rating_count, specialties")
      .eq("type", "painter")
      .order("rating", { ascending: false });
    if (error || !data) return mockPainters;
    const rows = data as unknown as {
      id: string;
      full_name: string | null;
      avatar_url: string | null;
      location: string | null;
      verified: boolean;
      rating: number;
      rating_count: number;
      specialties: string[] | null;
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
    }));
  } catch {
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
      .order("created_at", { ascending: false });
    if (error || !data) return mockProjects;
    return (data as unknown as ProjectRow[]).map(mapProject);
  } catch {
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

export async function getProjectBySlug(slug: string): Promise<Project | null> {
  const all = await getProjects();
  return all.find((p) => p.slug === slug) ?? null;
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
      .eq("type", "painter")
      .maybeSingle();
    if (error || !data) return null;
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
  } catch {
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
      .order("created_at", { ascending: false });
    if (error || !data) return [];
    return (data as unknown as ProjectRow[]).map(mapProject);
  } catch {
    return [];
  }
}

export interface OwnProfile {
  id: string;
  type: ProfileType;
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

/** Perfil de la cuenta logueada, sin filtrar por tipo (sirve para rutear al panel correcto). */
export async function getOwnProfile(id: string): Promise<OwnProfile | null> {
  if (!SUPA) return null;
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("profiles")
      .select("id, type, full_name, avatar_url, location, bio, verified, rating, rating_count, specialties")
      .eq("id", id)
      .maybeSingle();
    if (error || !data) return null;
    const p = data as unknown as {
      id: string;
      type: ProfileType;
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
  } catch {
    return null;
  }
}

/**
 * ¿El usuario ya eligió su rol? Falla seguro: si la columna `onboarded` todavía no existe
 * (migración 0003 sin correr) devuelve true para no bloquear a nadie.
 */
export async function isOnboarded(id: string): Promise<boolean> {
  if (!SUPA) return true;
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.from("profiles").select("onboarded").eq("id", id).maybeSingle();
    if (error || !data) return true;
    return !!(data as unknown as { onboarded: boolean }).onboarded;
  } catch {
    return true;
  }
}

export interface ClientJobView {
  id: string;
  status: string;
  statusLabel: string;
  amount: number | null;
  painter: string | null;
  project: string | null;
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
      .order("created_at", { ascending: false });
    if (error || !data) return [];
    const rows = data as unknown as {
      id: string;
      status: string;
      amount: number | null;
      painter_id: string | null;
      project_id: string | null;
    }[];
    const painterIds = [...new Set(rows.map((r) => r.painter_id).filter(Boolean))] as string[];
    const projectIds = [...new Set(rows.map((r) => r.project_id).filter(Boolean))] as string[];
    const names = new Map<string, string>();
    const titles = new Map<string, string>();
    if (painterIds.length) {
      const { data: ps } = await supabase.from("profiles").select("id, full_name").in("id", painterIds);
      for (const p of (ps ?? []) as unknown as { id: string; full_name: string | null }[])
        names.set(p.id, p.full_name ?? "Pintor");
    }
    if (projectIds.length) {
      const { data: pr } = await supabase.from("projects").select("id, title").in("id", projectIds);
      for (const p of (pr ?? []) as unknown as { id: string; title: string }[]) titles.set(p.id, p.title);
    }
    return rows.map((r) => ({
      id: r.id,
      status: r.status,
      statusLabel: JOB_STATUS_LABEL[r.status] ?? r.status,
      amount: r.amount,
      painter: r.painter_id ? names.get(r.painter_id) ?? "Pintor" : null,
      project: r.project_id ? titles.get(r.project_id) ?? null : null,
    }));
  } catch {
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
    if (error || !data) return null;
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
  } catch {
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
      .order("created_at", { ascending: false });
    if (error || !data) return [];
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
  } catch {
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
      .order("created_at", { ascending: false });
    if (error || !data) return [];
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
  } catch {
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
      .order("created_at", { ascending: false });
    if (error || !data) return [];
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
  } catch {
    return [];
  }
}

export interface QuoteView {
  id: string;
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
      .order("created_at", { ascending: false });
    if (error || !data) return [];
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
  } catch {
    return [];
  }
}

export function formatARS(n: number | null): string {
  if (n == null) return "—";
  return new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 }).format(n);
}
