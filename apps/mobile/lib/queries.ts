import { supabase, SUPABASE_READY } from "./supabase";
import type {
  Painter,
  PainterDetail,
  Project,
  ServiceRequest,
  Level,
  Quote,
  PainterJob,
  Resource,
  ResourceKind,
  NewsItem,
  Faq,
  MyProfile,
} from "./types";

function levelFromRating(rating: number, verified: boolean): Level {
  if (rating >= 4.8 && verified) return "Master";
  if (rating >= 4.5) return "Gold";
  return "Silver";
}

export function formatARS(n: number | null): string {
  if (n == null) return "—";
  return "$" + Math.round(n).toLocaleString("es-AR");
}

/** Pintores verificados, ordenados por rating. */
export async function getPainters(): Promise<Painter[]> {
  if (!SUPABASE_READY) return [];
  const { data, error } = await supabase
    .from("profiles")
    .select("id, full_name, avatar_url, location, verified, rating, rating_count, specialties")
    .eq("type", "painter")
    .order("rating", { ascending: false });
  if (error || !data) return [];
  return data.map((p: any) => ({
    id: p.id,
    name: p.full_name ?? "Pintor",
    level: levelFromRating(Number(p.rating), p.verified),
    rating: Number(p.rating),
    reviews: p.rating_count ?? 0,
    zone: p.location ?? "",
    specialty: p.specialties ?? [],
    image: p.avatar_url ?? "",
  }));
}

/** Un pintor por id, con bio y pros/cons. */
export async function getPainterById(id: string): Promise<PainterDetail | null> {
  if (!SUPABASE_READY) return null;
  const { data, error } = await supabase
    .from("profiles")
    .select("id, full_name, avatar_url, location, bio, verified, rating, rating_count, specialties, pros, cons")
    .eq("id", id)
    .eq("type", "painter")
    .maybeSingle();
  if (error || !data) return null;
  const p: any = data;
  return {
    id: p.id,
    name: p.full_name ?? "Pintor",
    level: levelFromRating(Number(p.rating), p.verified),
    rating: Number(p.rating),
    reviews: p.rating_count ?? 0,
    zone: p.location ?? "",
    specialty: p.specialties ?? [],
    image: p.avatar_url ?? "",
    bio: p.bio ?? "",
    pros: p.pros ?? [],
    cons: p.cons ?? [],
  };
}

/** Obras del portfolio de un dueño. */
export async function getProjectsByOwner(ownerId: string): Promise<Project[]> {
  if (!SUPABASE_READY) return [];
  const { data, error } = await supabase
    .from("projects")
    .select("id, slug, title, location, cover_url, images")
    .eq("type", "portfolio")
    .eq("published", true)
    .eq("owner_id", ownerId)
    .order("created_at", { ascending: false });
  if (error || !data) return [];
  return data.map((p: any) => ({
    id: p.id,
    slug: p.slug ?? p.id,
    title: p.title,
    location: p.location ?? "",
    cover: p.cover_url ?? (p.images?.[0] ?? ""),
  }));
}

/** Pedidos de trabajo abiertos (para que los pintores coticen). */
export async function getOpenServiceRequests(): Promise<ServiceRequest[]> {
  if (!SUPABASE_READY) return [];
  const { data, error } = await supabase
    .from("projects")
    .select("id, title, description, location, budget_min, budget_max, owner_id, created_at")
    .eq("type", "service")
    .eq("published", true)
    .order("created_at", { ascending: false });
  if (error || !data) return [];
  const ownerIds = [...new Set(data.map((r: any) => r.owner_id))];
  const names = new Map<string, string>();
  if (ownerIds.length) {
    const { data: os } = await supabase.from("profiles").select("id, full_name").in("id", ownerIds);
    for (const o of (os ?? []) as any[]) names.set(o.id, o.full_name ?? "Cliente");
  }
  return data.map((r: any) => ({
    id: r.id,
    title: r.title,
    description: r.description ?? "",
    location: r.location ?? "",
    budgetMin: r.budget_min,
    budgetMax: r.budget_max,
    ownerId: r.owner_id,
    ownerName: names.get(r.owner_id) ?? "Cliente",
  }));
}

/** Cotizaciones recibidas por el cliente (jobs donde client_id = uid). */
export async function getQuotesForClient(clientId: string): Promise<Quote[]> {
  if (!SUPABASE_READY) return [];
  const { data, error } = await supabase
    .from("jobs")
    .select("id, project_id, status, amount, note, painter_id")
    .eq("client_id", clientId)
    .order("created_at", { ascending: false });
  if (error || !data) return [];

  const painterIds = [...new Set(data.map((j: any) => j.painter_id).filter(Boolean))];
  const projectIds = [...new Set(data.map((j: any) => j.project_id).filter(Boolean))];
  const painters = new Map<string, { name: string; image: string; rating: number }>();
  const projects = new Map<string, string>();
  const reviewed = new Set<string>();

  if (painterIds.length) {
    const { data: ps } = await supabase
      .from("profiles")
      .select("id, full_name, avatar_url, rating")
      .in("id", painterIds);
    for (const p of (ps ?? []) as any[])
      painters.set(p.id, { name: p.full_name ?? "Pintor", image: p.avatar_url ?? "", rating: Number(p.rating) });
  }
  if (projectIds.length) {
    const { data: prj } = await supabase.from("projects").select("id, title").in("id", projectIds);
    for (const p of (prj ?? []) as any[]) projects.set(p.id, p.title);
  }
  // Reseñas que el cliente ya dejó (para ocultar el botón de reseñar).
  const { data: revs } = await supabase.from("reviews").select("job_id").eq("author_id", clientId);
  for (const r of (revs ?? []) as any[]) reviewed.add(r.job_id);

  return data.map((j: any) => {
    const p = painters.get(j.painter_id) ?? { name: "Pintor", image: "", rating: 0 };
    return {
      id: j.id,
      projectId: j.project_id,
      projectTitle: projects.get(j.project_id) ?? "Trabajo",
      status: j.status,
      amount: j.amount,
      note: j.note ?? "",
      painterId: j.painter_id,
      painterName: p.name,
      painterImage: p.image,
      painterRating: p.rating,
      reviewed: reviewed.has(j.id),
    };
  });
}

/** Trabajos del pintor (sus cotizaciones y trabajos aceptados/completados). */
export async function getJobsForPainter(painterId: string): Promise<PainterJob[]> {
  if (!SUPABASE_READY) return [];
  const { data, error } = await supabase
    .from("jobs")
    .select("id, project_id, status, amount, note, client_id")
    .eq("painter_id", painterId)
    .order("created_at", { ascending: false });
  if (error || !data) return [];

  const clientIds = [...new Set(data.map((j: any) => j.client_id).filter(Boolean))];
  const projectIds = [...new Set(data.map((j: any) => j.project_id).filter(Boolean))];
  const clients = new Map<string, string>();
  const projects = new Map<string, string>();
  if (clientIds.length) {
    const { data: cs } = await supabase.from("profiles").select("id, full_name").in("id", clientIds);
    for (const c of (cs ?? []) as any[]) clients.set(c.id, c.full_name ?? "Cliente");
  }
  if (projectIds.length) {
    const { data: prj } = await supabase.from("projects").select("id, title").in("id", projectIds);
    for (const p of (prj ?? []) as any[]) projects.set(p.id, p.title);
  }

  return data.map((j: any) => ({
    id: j.id,
    projectId: j.project_id,
    projectTitle: projects.get(j.project_id) ?? "Trabajo",
    status: j.status,
    amount: j.amount,
    note: j.note ?? "",
    clientId: j.client_id,
    clientName: clients.get(j.client_id) ?? "Cliente",
  }));
}

/** Recursos de aprendizaje (guías / videos / cursos / asesoramiento). */
export async function getResources(kind?: ResourceKind): Promise<Resource[]> {
  if (!SUPABASE_READY) return [];
  let q = supabase
    .from("resources")
    .select("id, kind, title, summary, body, media_url, level, duration, sort_order")
    .eq("published", true);
  if (kind) q = q.eq("kind", kind);
  const { data, error } = await q.order("sort_order", { ascending: true });
  if (error || !data) return [];
  return data.map((r: any) => ({
    id: r.id,
    kind: r.kind,
    title: r.title,
    summary: r.summary ?? "",
    body: r.body ?? "",
    mediaUrl: r.media_url ?? "",
    level: r.level ?? "",
    duration: r.duration ?? "",
  }));
}

/** Noticias publicadas (carrusel / lista). */
export async function getNews(): Promise<NewsItem[]> {
  if (!SUPABASE_READY) return [];
  const { data, error } = await supabase
    .from("news")
    .select("id, title, excerpt, url, published_at")
    .eq("published", true)
    .order("published_at", { ascending: false });
  if (error || !data) return [];
  return data.map((n: any) => ({
    id: n.id,
    title: n.title,
    excerpt: n.excerpt ?? "",
    url: n.url ?? "",
    publishedAt: n.published_at,
  }));
}

/** Preguntas frecuentes antes de pedir un presupuesto. */
export async function getFaqs(): Promise<Faq[]> {
  if (!SUPABASE_READY) return [];
  const { data, error } = await supabase
    .from("faqs")
    .select("id, question, answer, sort_order")
    .eq("published", true)
    .order("sort_order", { ascending: true });
  if (error || !data) return [];
  return data.map((f: any) => ({ id: f.id, question: f.question, answer: f.answer }));
}

/** Mi perfil editable. */
export async function getMyProfile(id: string): Promise<MyProfile | null> {
  if (!SUPABASE_READY) return null;
  const { data, error } = await supabase
    .from("profiles")
    .select("id, full_name, bio, location, specialties, pros, cons, avatar_url")
    .eq("id", id)
    .maybeSingle();
  if (error || !data) return null;
  const p: any = data;
  return {
    id: p.id,
    fullName: p.full_name ?? "",
    bio: p.bio ?? "",
    location: p.location ?? "",
    specialties: p.specialties ?? [],
    pros: p.pros ?? [],
    cons: p.cons ?? [],
    avatarUrl: p.avatar_url ?? "",
  };
}
