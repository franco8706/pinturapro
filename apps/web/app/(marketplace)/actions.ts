"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

function slugify(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 60);
}

function toInt(v: FormDataEntryValue | null): number | null {
  const n = parseInt(String(v ?? "").replace(/[^\d]/g, ""), 10);
  return Number.isFinite(n) && n > 0 ? n : null;
}

/**
 * El cliente publica un pedido de trabajo (projects type='service', published).
 * Queda visible para que los pintores coticen.
 */
export async function publicarTrabajo(formData: FormData): Promise<{ error?: string; ok?: boolean }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Tenés que iniciar sesión para publicar un trabajo." };

  const title = String(formData.get("title") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const location = String(formData.get("location") ?? "").trim();
  const budget_min = toInt(formData.get("budget_min"));
  const budget_max = toInt(formData.get("budget_max"));
  if (title.length < 4) return { error: "El título es muy corto." };

  const slug = `${slugify(title) || "trabajo"}-${Math.random().toString(36).slice(2, 7)}`;
  const payload = {
    owner_id: user.id,
    type: "service",
    title,
    slug,
    description: description || null,
    location: location || null,
    budget_min,
    budget_max,
    published: true,
  };

  const { error } = await supabase.from("projects").insert(payload as never);
  if (error) return { error: error.message };

  revalidatePath("/trabajos");
  revalidatePath("/cliente");
  return { ok: true };
}

/**
 * Un pintor envía una cotización (jobs status='quoted') a un pedido de trabajo.
 * RLS valida que painter_id = auth.uid() y que el pedido exista y sea del client_id declarado.
 */
export async function cotizar(formData: FormData): Promise<{ error?: string; ok?: boolean }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Tenés que iniciar sesión para cotizar." };

  const projectId = String(formData.get("project_id") ?? "").trim();
  const clientId = String(formData.get("client_id") ?? "").trim();
  const note = String(formData.get("note") ?? "").trim();
  const amount = toInt(formData.get("amount"));
  if (!projectId || !clientId) return { error: "Faltan datos del pedido." };
  if (!amount) return { error: "Ingresá un monto válido." };
  if (clientId === user.id) return { error: "No podés cotizar tu propio pedido." };

  const commission_amount = Math.round(amount * 0.1);
  const payload = {
    project_id: projectId,
    client_id: clientId,
    painter_id: user.id,
    status: "quoted",
    amount,
    commission_amount,
    note: note || null,
  };

  const { error } = await supabase.from("jobs").insert(payload as never);
  if (error) return { error: error.message };

  revalidatePath("/trabajos");
  revalidatePath("/cotizaciones");
  revalidatePath("/dashboard");
  return { ok: true };
}

/** El cliente acepta una cotización: el job pasa a 'accepted'. */
export async function aceptarCotizacion(jobId: string): Promise<{ error?: string; ok?: boolean }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Tenés que iniciar sesión." };
  if (!jobId) return { error: "Falta la cotización." };

  const { data, error } = await supabase
    .from("jobs")
    .update({ status: "accepted" } as never)
    .eq("id", jobId)
    .eq("client_id", user.id)
    .select("id");
  if (error) return { error: error.message };
  if (((data ?? []) as unknown[]).length === 0) return { error: "No se encontró la cotización o no es tuya." };

  revalidatePath("/cotizaciones");
  revalidatePath("/cliente");
  revalidatePath("/dashboard");
  return { ok: true };
}
