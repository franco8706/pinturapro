import { supabase } from "./supabase";

/**
 * Mutaciones del marketplace, ejecutadas con la sesión del usuario (anon key).
 * Las Row Level Security de Supabase hacen cumplir los permisos — las mismas
 * políticas que usa la web. Los emails de aviso no se envían desde el cliente
 * (requieren service-role); se disparan desde la web / un edge function.
 */

type Result = { ok?: boolean; error?: string };

/**
 * Traduce el error de la base a algo que una persona pueda entender.
 *
 * Espejo de `mensajeDeError` en la web (`app/(marketplace)/actions.ts`). Sin esto la app
 * mostraba el texto crudo de Postgres —"new row violates row-level security policy for
 * table \"jobs\"" o el nombre de un índice—: incomprensible, en inglés, y filtrando nombres
 * de tablas y constraints. Importa especialmente acá, donde los triggers de la migración
 * 0009 rechazan transiciones con mensajes pensados para el log, no para la pantalla.
 */
function mensajeDeError(error: { message?: string; code?: string }): string {
  const m = error?.message ?? "";
  const code = error?.code ?? "";

  if (code === "23505" || /duplicate key/i.test(m)) {
    if (/uniq_jobs_quote_viva/.test(m)) return "Ya enviaste una cotización para este pedido.";
    return "Ese registro ya existe.";
  }
  if (code === "42501" || /row-level security/i.test(m)) {
    return "No podés hacer esa acción sobre este trabajo.";
  }
  if (/Transición no permitida/i.test(m)) {
    return "Ese cambio de estado no está permitido para este trabajo.";
  }
  // Los `raise` de los triggers ya están escritos para el usuario final.
  if (/monto|comisión/i.test(m) && /no puede|no corresponde|fuera de rango/i.test(m)) {
    return m;
  }
  if (/fetch failed|network|Failed to fetch|ENOTFOUND/i.test(m)) {
    return "No pudimos conectar. Revisá tu conexión y probá de nuevo.";
  }
  console.error("[mutations] error sin traducir:", m);
  return "No pudimos completar la acción. Probá de nuevo.";
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

function toInt(v: string): number | null {
  const n = parseInt(String(v ?? "").replace(/[^\d]/g, ""), 10);
  return Number.isFinite(n) && n > 0 ? n : null;
}

/** El cliente publica un pedido de trabajo (projects type='service'). */
export async function publicarTrabajo(input: {
  title: string;
  description: string;
  location: string;
  budgetMin: string;
  budgetMax: string;
}): Promise<Result> {
  const { data: auth } = await supabase.auth.getUser();
  const user = auth.user;
  if (!user) return { error: "Tenés que iniciar sesión para publicar un trabajo." };

  const title = input.title.trim();
  if (title.length < 4) return { error: "El título es muy corto." };

  const slug = `${slugify(title) || "trabajo"}-${Math.random().toString(36).slice(2, 7)}`;
  const payload = {
    owner_id: user.id,
    type: "service",
    title,
    slug,
    description: input.description.trim() || null,
    location: input.location.trim() || null,
    budget_min: toInt(input.budgetMin),
    budget_max: toInt(input.budgetMax),
    published: true,
  };

  const { error } = await supabase.from("projects").insert(payload as never);
  if (error) return { error: mensajeDeError(error) };
  return { ok: true };
}

/** Un pintor cotiza un pedido de trabajo (jobs status='quoted'). */
export async function cotizar(input: {
  projectId: string;
  clientId: string;
  amount: string;
  note: string;
}): Promise<Result> {
  const { data: auth } = await supabase.auth.getUser();
  const user = auth.user;
  if (!user) return { error: "Tenés que iniciar sesión para cotizar." };

  const amount = toInt(input.amount);
  if (!input.projectId || !input.clientId) return { error: "Faltan datos del pedido." };
  if (!amount) return { error: "Ingresá un monto válido." };
  if (input.clientId === user.id) return { error: "No podés cotizar tu propio pedido." };

  const payload = {
    project_id: input.projectId,
    client_id: input.clientId,
    painter_id: user.id,
    status: "quoted",
    amount,
    commission_amount: Math.round(amount * 0.1),
    note: input.note.trim() || null,
  };

  const { error } = await supabase.from("jobs").insert(payload as never);
  if (error) {
    if (/duplicate key/i.test(error.message)) return { error: "Ya cotizaste este trabajo." };
    return { error: mensajeDeError(error) };
  }
  return { ok: true };
}

/** El cliente acepta una cotización: el job pasa a 'accepted'. */
export async function aceptarCotizacion(jobId: string): Promise<Result> {
  const { data: auth } = await supabase.auth.getUser();
  const user = auth.user;
  if (!user) return { error: "Tenés que iniciar sesión." };

  const { data, error } = await supabase
    .from("jobs")
    .update({ status: "accepted" } as never)
    .eq("id", jobId)
    .eq("client_id", user.id)
    // El filtro por estado es parte del arreglo, igual que en la web: sin él, una pantalla
    // desactualizada podía intentar aceptar una cotización ya cancelada por el trigger
    // `trg_job_accepted` (0009), y el usuario veía el error crudo de la máquina de estados.
    .eq("status", "quoted")
    .select("id");
  if (error) return { error: mensajeDeError(error) };
  if (((data ?? []) as unknown[]).length === 0) return { error: "Esta cotización ya no está disponible para aceptar." };
  return { ok: true };
}

/** El pintor marca un trabajo aceptado como completado. */
export async function marcarCompletado(jobId: string): Promise<Result> {
  const { data: auth } = await supabase.auth.getUser();
  const user = auth.user;
  if (!user) return { error: "Tenés que iniciar sesión." };

  const { data, error } = await supabase
    .from("jobs")
    .update({ status: "completed" } as never)
    .eq("id", jobId)
    .eq("painter_id", user.id)
    .eq("status", "accepted")
    .select("id");
  if (error) return { error: mensajeDeError(error) };
  if (((data ?? []) as unknown[]).length === 0) return { error: "No se encontró el trabajo o no está en curso." };
  return { ok: true };
}

/** El cliente deja una reseña de un trabajo completado. */
export async function dejarResena(input: {
  jobId: string;
  painterId: string;
  rating: number;
  comment: string;
}): Promise<Result> {
  const { data: auth } = await supabase.auth.getUser();
  const user = auth.user;
  if (!user) return { error: "Tenés que iniciar sesión." };
  if (!(input.rating >= 1 && input.rating <= 5)) return { error: "Elegí de 1 a 5 estrellas." };

  const payload = {
    job_id: input.jobId,
    author_id: user.id,
    target_id: input.painterId,
    rating: input.rating,
    comment: input.comment.trim() || null,
  };
  const { error } = await supabase.from("reviews").insert(payload as never);
  if (error) {
    if (/duplicate key/i.test(error.message)) return { error: "Ya dejaste una reseña para este trabajo." };
    return { error: mensajeDeError(error) };
  }
  return { ok: true };
}

/** Editar mi perfil (pintor / empresa). pros/cons se escriben aparte por compatibilidad. */
export async function updateMyProfile(
  id: string,
  input: { fullName: string; bio: string; location: string; specialties: string[]; pros: string[]; cons: string[] },
): Promise<Result> {
  const core = {
    full_name: input.fullName.trim() || null,
    bio: input.bio.trim() || null,
    location: input.location.trim() || null,
    specialties: input.specialties,
  };
  const { error } = await supabase.from("profiles").update(core as never).eq("id", id);
  if (error) return { error: mensajeDeError(error) };

  // pros/cons en update separado: si las columnas no existieran, no rompe el guardado base.
  await supabase.from("profiles").update({ pros: input.pros, cons: input.cons } as never).eq("id", id);
  return { ok: true };
}
