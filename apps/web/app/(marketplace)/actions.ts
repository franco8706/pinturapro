"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { notifyUser, emailLayout } from "@/lib/email";

const SITE = process.env.NEXT_PUBLIC_SITE_URL ?? "";
const ars = (n: number) => "$" + n.toLocaleString("es-AR");
function cta(path: string, label: string) {
  return SITE ? { label, href: `${SITE}${path}` } : undefined;
}

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

  // Avisar al cliente que recibió una cotización (no-op si Resend no está configurado).
  await notifyUser(
    clientId,
    "Recibiste una nueva cotización en Pintura Pro",
    emailLayout(
      "Tenés una cotización nueva",
      `Un pintor cotizó tu trabajo por <strong>${ars(amount)}</strong>.${note ? ` Te dejó un mensaje: “${note}”.` : ""} Entrá para compararla y aceptarla.`,
      cta("/cotizaciones", "Ver cotizaciones"),
    ),
  );

  revalidatePath("/trabajos");
  revalidatePath("/cotizaciones");
  revalidatePath("/dashboard");
  return { ok: true };
}

/** El pintor marca un trabajo aceptado como completado: el job pasa a 'completed'. */
export async function marcarCompletado(jobId: string): Promise<{ error?: string; ok?: boolean }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Tenés que iniciar sesión." };
  if (!jobId) return { error: "Falta el trabajo." };

  const { data, error } = await supabase
    .from("jobs")
    .update({ status: "completed" } as never)
    .eq("id", jobId)
    .eq("painter_id", user.id)
    .eq("status", "accepted")
    .select("id");
  if (error) return { error: error.message };
  if (((data ?? []) as unknown[]).length === 0) return { error: "No se encontró el trabajo o no está en curso." };

  revalidatePath("/dashboard");
  revalidatePath("/cliente");
  return { ok: true };
}

/**
 * El cliente deja una reseña de un trabajo completado. RLS reviews_insert_author exige
 * author_id = auth.uid(); un trigger recalcula el rating del pintor.
 */
export async function dejarResena(formData: FormData): Promise<{ error?: string; ok?: boolean }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Tenés que iniciar sesión." };

  const jobId = String(formData.get("job_id") ?? "").trim();
  const painterId = String(formData.get("painter_id") ?? "").trim();
  const comment = String(formData.get("comment") ?? "").trim();
  const rating = parseInt(String(formData.get("rating") ?? ""), 10);
  if (!jobId || !painterId) return { error: "Faltan datos del trabajo." };
  if (!(rating >= 1 && rating <= 5)) return { error: "Elegí una calificación de 1 a 5 estrellas." };

  const payload = {
    job_id: jobId,
    author_id: user.id,
    target_id: painterId,
    rating,
    comment: comment || null,
  };

  const { error } = await supabase.from("reviews").insert(payload as never);
  if (error) {
    if (/duplicate key/i.test(error.message)) return { error: "Ya dejaste una reseña para este trabajo." };
    return { error: error.message };
  }

  revalidatePath("/cliente");
  revalidatePath(`/pintor/${painterId}`);
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
    .select("id, painter_id, amount");
  if (error) return { error: error.message };
  const rows = (data ?? []) as unknown as { id: string; painter_id: string | null; amount: number | null }[];
  if (rows.length === 0) return { error: "No se encontró la cotización o no es tuya." };

  // Avisar al pintor que le aceptaron la cotización.
  const accepted = rows[0];
  if (accepted.painter_id) {
    await notifyUser(
      accepted.painter_id,
      "¡Te aceptaron una cotización en Pintura Pro!",
      emailLayout(
        "Ganaste un trabajo",
        `Un cliente aceptó tu cotización${accepted.amount ? ` de <strong>${ars(accepted.amount)}</strong>` : ""}. Coordiná con el cliente y, al terminar, marcá el trabajo como completado.`,
        cta("/dashboard", "Ir a mi panel"),
      ),
    );
  }

  revalidatePath("/cotizaciones");
  revalidatePath("/cliente");
  revalidatePath("/dashboard");
  return { ok: true };
}
