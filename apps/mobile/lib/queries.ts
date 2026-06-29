import { supabase, SUPABASE_READY } from "./supabase";
import type { Painter, PainterDetail, Project, ServiceRequest, Level } from "./types";

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
