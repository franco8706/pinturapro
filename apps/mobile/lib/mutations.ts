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
  // 23514: los topes de largo de la migración 0017. Sin esta rama, escribir de más caía en
  // el mensaje genérico y la persona no sabía qué corregir.
  if (code === "23514" || /violates check constraint/i.test(m)) {
    if (/title_largo/.test(m)) return "El título es demasiado largo (máximo 120 caracteres).";
    if (/description_largo/.test(m)) return "La descripción es demasiado larga (máximo 2000 caracteres).";
    if (/location_largo/.test(m)) return "La ubicación es demasiado larga (máximo 120 caracteres).";
    if (/bio_largo/.test(m)) return "La descripción del perfil es demasiado larga (máximo 1200 caracteres).";
    if (/note_largo/.test(m)) return "El mensaje de la cotización es demasiado largo (máximo 1200 caracteres).";
    if (/comment_largo/.test(m)) return "El comentario es demasiado largo (máximo 1200 caracteres).";
    return "Alguno de los datos es demasiado largo. Revisalo y probá de nuevo.";
  }
  // El trigger de 0015: alguien se quedó con el pedido mientras mirabas la pantalla.
  if (/ya tiene un pintor asignado/i.test(m)) {
    return "Este pedido ya tiene un pintor asignado.";
  }
  // 40P01: dos personas operando sobre el mismo pedido a la vez.
  if (code === "40P01" || /deadlock detected/i.test(m)) {
    return "Alguien más estaba operando sobre este pedido. Actualizá la pantalla y probá de nuevo.";
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

/**
 * Convierte lo que escribió una persona en un monto en pesos.
 *
 * Esta función era `parseInt(v.replace(/[^\d]/g, ""))`, la versión que la web ya había
 * corregido, y acá se quedó. Rompía de dos formas, las dos silenciosas:
 *
 *  · "150.000,50" → 15.000.050. Escribir el monto como se escribe en Argentina lo
 *    multiplicaba por cien, y ese número viajaba a una cotización que el cliente aceptaba.
 *  · "-99999" → 99999. El signo desaparecía y la cotización salía positiva: el pintor creía
 *    haber mandado una cosa y llegaba otra.
 *
 * La versión buena vive en `packages/dominio` (`montoDesdeTexto`), compartida con la web.
 * Todavía no se importa desde acá porque Metro, el empaquetador de Expo, necesita
 * configuración extra para resolver paquetes del monorepo y eso no se puede probar sin
 * levantar la app. Mientras tanto esta copia tiene que decir exactamente lo mismo, y hay una
 * prueba que lo verifica (`tools/auditoria/regresiones/reglas-compartidas.prueba.cjs`).
 */
function toInt(v: string): number | null {
  const crudo = String(v ?? "").trim();
  if (!crudo) return null;
  if (/^-/.test(crudo)) return null; // negativo: se rechaza, no se "arregla" solo

  const soloNumero = crudo.replace(/[^\d.,]/g, ""); // saca "$", espacios y letras
  const sinMiles = soloNumero.replace(/\./g, ""); // el punto es separador de miles
  const entero = sinMiles.split(",")[0]; // la coma abre los centavos: se descartan
  if (!entero) return null;

  const n = parseInt(entero, 10);
  // Más de mil millones en un trabajo de pintura es un error de tipeo, y `amount` es int4.
  if (!Number.isFinite(n) || n <= 0 || n > 1_000_000_000) return null;
  return n;
}

/**
 * Topes de largo, espejo de los check constraints de la migración 0017.
 *
 * Sin esto, la persona escribía una nota de 2.000 caracteres, enviaba, y leía "No pudimos
 * completar la acción" sin enterarse de que el problema era el largo.
 */
const TOPES = {
  titulo: 120,
  descripcion: 2000,
  ubicacion: 120,
  bio: 1200,
  nombre: 120,
  notaCotizacion: 1200,
  comentarioResena: 1200,
} as const;

const NOMBRE_DEL_CAMPO: Record<keyof typeof TOPES, string> = {
  titulo: "El título",
  descripcion: "La descripción",
  ubicacion: "La ubicación",
  bio: "La descripción del perfil",
  nombre: "El nombre",
  notaCotizacion: "El mensaje de la cotización",
  comentarioResena: "El comentario",
};

function revisarLargos(campos: Partial<Record<keyof typeof TOPES, string | null | undefined>>): string | null {
  for (const campo of Object.keys(campos) as (keyof typeof TOPES)[]) {
    const largo = (campos[campo] ?? "").length;
    if (largo > TOPES[campo]) {
      return `${NOMBRE_DEL_CAMPO[campo]} no puede superar los ${TOPES[campo]} caracteres.`;
    }
  }
  return null;
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
  const largoMal = revisarLargos({
    titulo: title,
    descripcion: input.description,
    ubicacion: input.location,
  });
  if (largoMal) return { error: largoMal };

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

  // Rol, antes de tocar la base. La pantalla de trabajos ya oculta el botón a un cliente,
  // pero a esta pantalla se puede llegar por un link directo (`pinturapro://cotizar/<id>`),
  // y ahí el único freno era la policy de la base, que contesta un permiso denegado genérico.
  const { data: perfil } = await supabase.from("profiles").select("type").eq("id", user.id).maybeSingle();
  if ((perfil as { type?: string } | null)?.type === "client") {
    return { error: "Las cotizaciones las envían los pintores. Tu cuenta es de cliente." };
  }

  const notaMal = revisarLargos({ notaCotizacion: input.note });
  if (notaMal) return { error: notaMal };

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
