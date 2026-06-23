import { createClient } from "@/lib/supabase/server";
import { mockPainters, mockProjects, type Painter, type Project } from "@/lib/data";

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

export function formatARS(n: number | null): string {
  if (n == null) return "—";
  return new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 }).format(n);
}
