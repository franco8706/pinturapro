"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { notifyUser, emailLayout, html } from "@/lib/email";
import { commissionFor } from "@/lib/utils";
import { mensajeDeError } from "@/lib/errores-db";
import { getOwnProfile } from "@/lib/queries";
import { montoDesdeTexto, revisarLargos, puedeCotizar, MOTIVO_NO_PUEDE_COTIZAR } from "@pinturapro/dominio";

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

/**
 * El parser de montos vive en `@pinturapro/dominio`, compartido con la app móvil: la copia
 * del móvil se había quedado con la versión vieja, la que convertía "150.000,50" en
 * $15.000.050. Una regla de plata en dos archivos termina diciendo dos cosas distintas.
 */
function toInt(v: FormDataEntryValue | null): number | null {
  return montoDesdeTexto(v);
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
  // Topes de largo (espejo de los checks de la migración 0017, que es la barrera real).
  // No es cosmético: /trabajos es PÚBLICA y muestra el título de cada pedido. Medido con un
  // título de 10.000 caracteres sin espacios, la página quedó de 254.443 px de ancho, para
  // todo el mundo y no sólo para quien lo publicó.
  const largoMal = revisarLargos({ titulo: title, descripcion: description, ubicacion: location });
  if (largoMal) return { error: largoMal };

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
  if (error) return { error: mensajeDeError(error) };

  revalidatePath("/trabajos");
  revalidatePath("/cliente");
  return { ok: true };
}

/**
 * Un pintor envía una cotización (jobs status='quoted') a un pedido de trabajo.
 * RLS valida que painter_id = auth.uid(), que sea pintor (0016) y que el pedido
 * exista y sea del client_id declarado.
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
  const notaMal = revisarLargos({ notaCotizacion: note });
  if (notaMal) return { error: notaMal };

  // El rol también se verifica acá, no sólo en la base: la policy devuelve un error
  // de permisos genérico y quien lo lea tiene que entender qué pasó. Medido: una
  // cuenta de cliente podía cotizar el pedido de otro cliente y el trabajo se creaba.
  // Si la lectura del perfil falla, no se bloquea por las dudas: la policy de la base
  // ya rechaza al que no es pintor, y ésta es sólo la capa que explica el motivo.
  let perfil = null;
  try {
    perfil = await getOwnProfile(user.id);
  } catch {
    perfil = null;
  }
  if (perfil && !puedeCotizar(perfil.type)) {
    return { error: MOTIVO_NO_PUEDE_COTIZAR };
  }

  const commission_amount = commissionFor(amount);
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
  if (error) return { error: mensajeDeError(error) };

  // Avisar al cliente que recibió una cotización (no-op si Resend no está configurado).
  // `note` la escribe el pintor: va por `html` para que se escape y no pueda inyectar markup.
  await notifyUser(
    clientId,
    "Recibiste una nueva cotización en Pintura Pro",
    emailLayout(
      "Tenés una cotización nueva",
      html`Un pintor cotizó tu trabajo por <strong>${ars(amount)}</strong>.${note
        ? html` Te dejó un mensaje: “${note}”.`
        : html``} Entrá para compararla y aceptarla.`,
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
    // `in_progress` también: filtrando sólo por 'accepted', un trabajo puesto en curso
    // quedaba en un callejón sin salida — la acción afectaba 0 filas y no había forma de
    // completarlo nunca más.
    .in("status", ["accepted", "in_progress"])
    .select("id");
  if (error) return { error: mensajeDeError(error) };
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
  // Tope de largo: una reseña de 3.000 caracteres tapaba las otras siete en el perfil
  // público del pintor y se colaba en el carrusel de la home. El `maxLength` del textarea es
  // una comodidad del navegador; el corte de verdad va acá, que es lo que no se puede saltear
  // mandando el POST a mano. Los formularios de leads ya cortaban así.
  const comment = String(formData.get("comment") ?? "").trim().slice(0, 1000);
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
    return { error: mensajeDeError(error) };
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

  // El filtro por status es parte del arreglo: sin él, un cliente podía "re-aceptar" un
  // trabajo ya completado (volviéndolo atrás) y disparar otro email al pintor en cada clic.
  const { data, error } = await supabase
    .from("jobs")
    .update({ status: "accepted" } as never)
    .eq("id", jobId)
    .eq("client_id", user.id)
    .eq("status", "quoted")
    .select("id, painter_id, amount");
  if (error) return { error: mensajeDeError(error) };
  const rows = (data ?? []) as unknown as { id: string; painter_id: string | null; amount: number | null }[];
  if (rows.length === 0) return { error: "Esta cotización ya no está disponible para aceptar." };

  // Avisar al pintor que le aceptaron la cotización.
  const accepted = rows[0];
  if (accepted.painter_id) {
    await notifyUser(
      accepted.painter_id,
      "¡Te aceptaron una cotización en Pintura Pro!",
      emailLayout(
        "Ganaste un trabajo",
        html`Un cliente aceptó tu cotización${accepted.amount
          ? html` de <strong>${ars(accepted.amount)}</strong>`
          : html``}. Coordiná con el cliente y, al terminar, marcá el trabajo como completado.`,
        cta("/dashboard", "Ir a mi panel"),
      ),
    );
  }

  revalidatePath("/cotizaciones");
  revalidatePath("/cliente");
  revalidatePath("/dashboard");
  return { ok: true };
}


/**
 * Cancelar un trabajo. Lo puede hacer cualquiera de las dos partes.
 *
 * Sin esto no había ninguna salida: si el pintor aceptaba y después desaparecía, el trabajo
 * quedaba en 'accepted' para siempre — el cliente no podía reseñar (la reseña exige
 * 'completed'), no podía aceptar otra cotización para ese pedido, y no tenía forma de
 * liberarlo. El único camino era escribir por mail y que alguien lo arreglara a mano.
 *
 * El trigger de la migración 0009 se encarga de reabrir el pedido en el tablero cuando el
 * trabajo cancelado era el adjudicado.
 */
export async function cancelarTrabajo(jobId: string): Promise<{ error?: string; ok?: boolean }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Tenés que iniciar sesión." };
  if (!jobId) return { error: "Falta el trabajo." };

  const { data, error } = await supabase
    .from("jobs")
    .update({ status: "cancelled" } as never)
    .eq("id", jobId)
    .or(`client_id.eq.${user.id},painter_id.eq.${user.id}`)
    .in("status", ["quoted", "accepted", "in_progress"])
    .select("id, client_id, painter_id");
  if (error) return { error: mensajeDeError(error) };
  const filas = (data ?? []) as unknown as { id: string; client_id: string; painter_id: string | null }[];
  if (filas.length === 0) return { error: "Este trabajo ya no se puede cancelar." };

  // Avisar a la otra parte.
  const fila = filas[0];
  const otra = fila.client_id === user.id ? fila.painter_id : fila.client_id;
  if (otra) {
    await notifyUser(
      otra,
      "Se canceló un trabajo en Pintura Pro",
      emailLayout(
        "Trabajo cancelado",
        html`La otra parte canceló el trabajo. Si era un pedido tuyo, volvió a quedar publicado para recibir cotizaciones nuevas.`,
        cta("/mi-panel", "Ir a mi panel"),
      ),
    );
  }

  revalidatePath("/cotizaciones");
  revalidatePath("/cliente");
  revalidatePath("/dashboard");
  revalidatePath("/trabajos");
  return { ok: true };
}
