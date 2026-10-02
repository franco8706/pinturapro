import { supabase } from "./supabase";
import {
  montoDesdeTexto as toInt,
  mensajeDeError,
  motivoCotizacionInvalida,
  contactoEnTexto,
  comisionDe,
  revisarLargos,
  puedeCotizar,
  MOTIVO_NO_PUEDE_COTIZAR,
  type TipoDePerfil,
} from "@pinturapro/dominio";

/**
 * Mutaciones del marketplace, ejecutadas con la sesión del usuario (anon key).
 * Las Row Level Security de Supabase hacen cumplir los permisos — las mismas
 * políticas que usa la web. Los emails de aviso no se envían desde el cliente
 * (requieren service-role); se disparan desde la web / un edge function.
 */

type Result = { ok?: boolean; error?: string };

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
 * Las reglas (el monto que escribe una persona, la comisión, los topes de largo, quién puede
 * cotizar, cómo se traduce un error de la base) vienen de `@pinturapro/dominio`, el mismo
 * paquete que usa la web. Antes el móvil tenía su copia de cada una, y ya se había
 * desincronizado: el parser de montos convertía "150.000,50" en $15.000.050 meses después de
 * que la web lo arreglara, y al traductor de errores le faltaban cuatro topes de largo. La
 * copia existía porque "Metro no resuelve paquetes del monorepo"; con Expo 52 sí los resuelve
 * (lo verificaron `arquitectura-modular` y `app-movil`, 29/9). `file:` y no `workspace:*`:
 * `workspace:*` rompe `npm install`, que es como se instala el móvil (medido).
 */
export { toInt };

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
  const largoMal = revisarLargos({
    titulo: title,
    descripcion: input.description,
    ubicacion: input.location,
  });
  if (largoMal) return { error: largoMal };

  // El presupuesto se validaba en `cotizar` pero no acá: un monto que el parser no entiende
  // ("1,500,000", "1500.50") se guardaba como NULL sin avisar. La pantalla decía "publicado",
  // volvía atrás, y el pedido salía con "A definir" en lugar del presupuesto que la persona
  // escribió. Vacío sigue siendo válido (es opcional); escrito y no entendido, no.
  const budgetMin = toInt(input.budgetMin);
  const budgetMax = toInt(input.budgetMax);
  if (input.budgetMin.trim() && budgetMin === null) {
    return { error: "No entendemos el presupuesto mínimo. Escribilo así: 320000 o 320.000." };
  }
  if (input.budgetMax.trim() && budgetMax === null) {
    return { error: "No entendemos el presupuesto máximo. Escribilo así: 320000 o 320.000." };
  }
  if (budgetMin !== null && budgetMax !== null && budgetMin > budgetMax) {
    return { error: "El presupuesto mínimo es mayor que el máximo." };
  }

  const slug = `${slugify(title) || "trabajo"}-${Math.random().toString(36).slice(2, 7)}`;
  const payload = {
    owner_id: user.id,
    type: "service",
    title,
    slug,
    description: input.description.trim() || null,
    location: input.location.trim() || null,
    budget_min: budgetMin,
    budget_max: budgetMax,
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
  const montoMal = motivoCotizacionInvalida(input.amount);
  if (!amount || montoMal) return { error: montoMal ?? "Ingresá un monto válido." };
  const contacto = contactoEnTexto(input.note);
  if (contacto) {
    return { error: `La nota trae ${contacto}. Sacalo: tu contacto se le comparte al cliente cuando acepta tu cotización.` };
  }
  if (input.clientId === user.id) return { error: "No podés cotizar tu propio pedido." };

  // Rol, antes de tocar la base. La pantalla de trabajos ya oculta el botón a un cliente,
  // pero a esta pantalla se puede llegar por un link directo (`pinturapro://cotizar/<id>`),
  // y ahí el único freno era la policy de la base, que contesta un permiso denegado genérico.
  const { data: perfil } = await supabase.from("profiles").select("type").eq("id", user.id).maybeSingle();
  if (!puedeCotizar((perfil as { type?: TipoDePerfil } | null)?.type)) {
    return { error: MOTIVO_NO_PUEDE_COTIZAR };
  }

  const notaMal = revisarLargos({ notaCotizacion: input.note });
  if (notaMal) return { error: notaMal };

  const payload = {
    project_id: input.projectId,
    client_id: input.clientId,
    painter_id: user.id,
    status: "quoted",
    amount,
    commission_amount: comisionDe(amount),
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

/**
 * Cancelar un trabajo o retirar una cotización. Espejo de `cancelarTrabajo` de la web.
 *
 * No existía en la app. Sin esto, un pintor que aceptaba y desaparecía dejaba al cliente
 * trabado para siempre desde el celular: sin poder reseñar, sin poder contratar a otro y sin
 * forma de liberar el pedido. Cualquiera de las dos partes puede cancelar mientras el trabajo
 * no esté terminado; si ya estaba aceptado, el trigger `on_job_cancelled` (0009) vuelve a
 * publicar el pedido. Es lo que dicen los términos.
 *
 * Diferencia con la web: desde acá no sale el mail de aviso a la otra parte, porque mandarlo
 * requiere la clave de servicio, que nunca va en una app. La otra parte lo ve en su panel.
 */
export async function cancelarTrabajo(jobId: string): Promise<Result> {
  const { data: auth } = await supabase.auth.getUser();
  const user = auth.user;
  if (!user) return { error: "Tenés que iniciar sesión." };
  if (!jobId) return { error: "Falta el trabajo." };

  const { data, error } = await supabase
    .from("jobs")
    .update({ status: "cancelled" } as never)
    .eq("id", jobId)
    .or(`client_id.eq.${user.id},painter_id.eq.${user.id}`)
    .in("status", ["quoted", "accepted", "in_progress"])
    .select("id");
  if (error) return { error: mensajeDeError(error) };
  if (((data ?? []) as unknown[]).length === 0) return { error: "Este trabajo ya no se puede cancelar." };
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
  const comentarioMal = revisarLargos({ comentarioResena: input.comment });
  if (comentarioMal) return { error: comentarioMal };

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
  const perfilMal = revisarLargos({ nombre: input.fullName, bio: input.bio, ubicacion: input.location });
  if (perfilMal) return { error: perfilMal };

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
