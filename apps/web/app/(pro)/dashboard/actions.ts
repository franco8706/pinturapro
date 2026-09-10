"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

function slugify(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // saca acentos
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 60);
}

const CATEGORIES = ["Residencial", "Comercial", "Industrial"];

interface ObraFields {
  title: string;
  description: string | null;
  category: string;
  location: string | null;
  accent_color: string;
  cover_url: string;
}

/** Lee y valida los campos comunes del form. Devuelve { error } o { fields }. */
function readFields(formData: FormData): { error: string } | { fields: ObraFields } {
  const title = String(formData.get("title") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const category = String(formData.get("category") ?? "Residencial");
  const location = String(formData.get("location") ?? "").trim();
  const accent_color = String(formData.get("accent_color") ?? "#3F3F46").trim();
  const cover_url = String(formData.get("cover_url") ?? "").trim();

  if (title.length < 3) return { error: "El título es muy corto." };
  if (!CATEGORIES.includes(category)) return { error: "Categoría inválida." };
  if (cover_url && !/^https?:\/\//i.test(cover_url)) return { error: "La URL de imagen debe empezar con http(s)." };

  return {
    fields: { title, description: description || null, category, location: location || null, accent_color, cover_url },
  };
}

/**
 * Tipos de imagen aceptados. Los buckets son PÚBLICOS: si dejáramos pasar el `file.type`
 * del cliente, alguien podría subir un `image/svg+xml` con un <script> adentro y quedaría
 * JavaScript ejecutable alojado en el dominio de nuestro Storage.
 */
const IMAGE_TYPES = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
} as const;

/** Firma real del archivo (magic bytes). El `file.type` lo pone el cliente y se puede mentir. */
function sniffImageType(bytes: ArrayBuffer): keyof typeof IMAGE_TYPES | null {
  const b = new Uint8Array(bytes.slice(0, 12));
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "image/jpeg";
  if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return "image/png";
  // RIFF....WEBP
  if (b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 && b[8] === 0x57 && b[9] === 0x45)
    return "image/webp";
  return null;
}

/** Sube el archivo a un bucket de Storage con service-role y devuelve la URL pública (o un error). */
async function uploadImage(
  bucket: "projects" | "avatars",
  userId: string,
  file: File,
): Promise<{ url: string } | { error: string }> {
  if (file.size > 6_000_000) return { error: "La imagen es muy pesada (máx 6MB)." };
  if (file.size === 0) return { error: "El archivo está vacío." };

  const bytes = await file.arrayBuffer();
  const sniffed = sniffImageType(bytes);
  if (!sniffed) return { error: "El archivo no es una imagen JPG, PNG o WEBP válida." };

  // El content-type sale de la firma del archivo, nunca de lo que declara el cliente.
  const contentType = sniffed;
  const ext = IMAGE_TYPES[sniffed];
  const path = `${userId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;

  const admin = createAdminClient();
  const { error } = await admin.storage.from(bucket).upload(path, bytes, { contentType, upsert: false });
  if (error) return { error: "No se pudo subir la imagen: " + error.message };
  return { url: admin.storage.from(bucket).getPublicUrl(path).data.publicUrl };
}

/**
 * Borra la portada del Storage, sólo si es un archivo NUESTRO y DEL PROPIO usuario.
 *
 * `cover_url` puede venir de un campo de texto libre del formulario. Antes se buscaba el
 * marcador en cualquier parte del string y se borraba lo que siguiera, con service-role:
 * bastaba con guardar una URL con la ruta de otro usuario para borrarle sus fotos.
 * Ahora se exige prefijo exacto de nuestro proyecto y que la ruta empiece con su user id.
 */
async function deleteCoverIfOwn(coverUrl: string | null, userId: string) {
  if (!coverUrl) return;
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!base) return;

  const prefix = `${base.replace(/\/+$/, "")}/storage/v1/object/public/projects/`;
  if (!coverUrl.startsWith(prefix)) return;

  const path = decodeURIComponent(coverUrl.slice(prefix.length).split("?")[0]);
  // Sólo archivos dentro de la carpeta del propio usuario, sin escapar hacia arriba.
  if (!path.startsWith(`${userId}/`) || path.includes("..")) return;

  try {
    await createAdminClient().storage.from("projects").remove([path]);
  } catch {
    // best-effort: si falla, la fila ya se borró igual.
  }
}

/**
 * Crea una obra (project type=portfolio) del pintor logueado.
 * RLS exige owner_id = auth.uid(), así que un usuario solo puede crear obras propias.
 */
export async function createObra(formData: FormData): Promise<{ error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Tenés que iniciar sesión." };

  const parsed = readFields(formData);
  if ("error" in parsed) return parsed;
  const f = parsed.fields;

  let cover_url = f.cover_url;
  const file = formData.get("cover_file");
  if (file instanceof File && file.size > 0) {
    const up = await uploadImage("projects", user.id, file);
    if ("error" in up) return up;
    cover_url = up.url;
  }

  const slug = `${slugify(f.title) || "obra"}-${Math.random().toString(36).slice(2, 7)}`;

  const payload = {
    owner_id: user.id,
    type: "portfolio",
    title: f.title,
    slug,
    description: f.description,
    category: f.category,
    accent_color: f.accent_color,
    cover_url: cover_url || null,
    images: cover_url ? [cover_url] : [],
    location: f.location,
    published: true,
  };

  // Cast: la inferencia del insert con el Database hecho a mano colapsa a `never`.
  const { error } = await supabase.from("projects").insert(payload as never);
  if (error) return { error: error.message };

  revalidatePath("/dashboard");
  revalidatePath("/obras");
  redirect("/dashboard");
}

/**
 * Actualiza una obra propia. La RLS + el filtro owner_id garantizan que solo el dueño edite.
 * Si no se sube foto nueva ni se pega URL, conserva la portada actual.
 */
export async function updateObra(formData: FormData): Promise<{ error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Tenés que iniciar sesión." };

  const id = String(formData.get("id") ?? "").trim();
  if (!id) return { error: "Falta el identificador de la obra." };

  const parsed = readFields(formData);
  if ("error" in parsed) return parsed;
  const f = parsed.fields;

  const update: Record<string, unknown> = {
    title: f.title,
    description: f.description,
    category: f.category,
    accent_color: f.accent_color,
    location: f.location,
  };

  // Portada: prioridad foto subida > URL pegada > sin cambios.
  let newCover = "";
  const file = formData.get("cover_file");
  if (file instanceof File && file.size > 0) {
    const up = await uploadImage("projects", user.id, file);
    if ("error" in up) return up;
    newCover = up.url;
  } else if (f.cover_url) {
    newCover = f.cover_url;
  }
  if (newCover) {
    update.cover_url = newCover;
    update.images = [newCover];
  }

  const { data, error } = await supabase
    .from("projects")
    .update(update as never)
    .eq("id", id)
    .eq("owner_id", user.id)
    .select("id, slug");
  if (error) return { error: error.message };
  const rows = (data ?? []) as unknown as { id: string; slug: string | null }[];
  if (rows.length === 0) return { error: "No se encontró la obra o no es tuya." };

  revalidatePath("/dashboard");
  revalidatePath("/obras");
  if (rows[0].slug) revalidatePath(`/obras/${rows[0].slug}`);
  redirect("/dashboard");
}

/** Borra una obra propia (RLS + filtro owner_id) y limpia su foto del Storage. */
export async function deleteObra(id: string): Promise<{ error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Tenés que iniciar sesión." };
  if (!id) return { error: "Falta el identificador de la obra." };

  // Traemos la portada (con la sesión, RLS solo deja ver lo permitido) para limpiar el Storage.
  const { data: pre } = await supabase
    .from("projects")
    .select("cover_url")
    .eq("id", id)
    .eq("owner_id", user.id)
    .maybeSingle();

  const { error } = await supabase.from("projects").delete().eq("id", id).eq("owner_id", user.id);
  if (error) return { error: error.message };

  const cover = (pre as unknown as { cover_url: string | null } | null)?.cover_url ?? null;
  await deleteCoverIfOwn(cover, user.id);

  revalidatePath("/dashboard");
  revalidatePath("/obras");
  return {};
}

/**
 * Actualiza el perfil público del usuario logueado (nombre, bio, zona, especialidades, avatar).
 * RLS profiles_update_own exige id = auth.uid(). Es el "registro real" del pintor.
 */
export async function updateProfile(formData: FormData): Promise<{ error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Tenés que iniciar sesión." };

  const full_name = String(formData.get("full_name") ?? "").trim();
  const bio = String(formData.get("bio") ?? "").trim();
  const location = String(formData.get("location") ?? "").trim();
  const specialtiesRaw = String(formData.get("specialties") ?? "[]");
  if (full_name.length < 2) return { error: "Ingresá tu nombre." };

  let specialties: string[] = [];
  try {
    const parsed = JSON.parse(specialtiesRaw);
    if (Array.isArray(parsed)) specialties = parsed.filter((s) => typeof s === "string").slice(0, 12);
  } catch {
    // si viene mal, lo dejamos vacío en vez de romper
  }

  // El teléfono nunca sale en el directorio público: 0006 le revocó la columna a
  // authenticated y sólo lo entrega `contacto_del_trabajo` a la contraparte de un trabajo
  // ya adjudicado. Vacío lo deja en null en vez de guardar "".
  const phone = String(formData.get("phone") ?? "").trim().slice(0, 40);

  const update: Record<string, unknown> = {
    full_name,
    bio: bio || null,
    location: location || null,
    phone: phone || null,
    specialties,
  };

  const file = formData.get("avatar_file");
  if (file instanceof File && file.size > 0) {
    const up = await uploadImage("avatars", user.id, file);
    if ("error" in up) return up;
    update.avatar_url = up.url;
  }

  const { error } = await supabase.from("profiles").update(update as never).eq("id", user.id);
  if (error) return { error: error.message };

  // Pros/cons en una escritura aparte: si las columnas todavía no existen (migración 0005
  // sin aplicar), el error se ignora para no romper la edición del resto del perfil.
  const toLines = (s: string) =>
    s
      .split("\n")
      .map((x) => x.trim())
      .filter(Boolean)
      .slice(0, 8);
  const pros = toLines(String(formData.get("pros") ?? ""));
  const cons = toLines(String(formData.get("cons") ?? ""));
  await supabase.from("profiles").update({ pros, cons } as never).eq("id", user.id);

  revalidatePath("/dashboard");
  revalidatePath("/pintores");
  revalidatePath(`/pintor/${user.id}`);
  redirect("/dashboard");
}

/**
 * Guardar el teléfono de contacto propio.
 *
 * Vive aparte de `updateProfile` porque se usa desde los paneles, sobre la tarjeta del
 * trabajo ya adjudicado: pedirlo ahí, cuando la persona lo necesita para coordinar, funciona
 * mejor que esconderlo en un formulario de perfil al que el cliente ni siquiera entra
 * (/dashboard/perfil es sólo para pintores y empresas).
 *
 * Escribir `phone` sí está permitido por RLS (`profiles_update_own`) y el trigger de
 * campos congelados no lo toca. Leerlo es lo que necesita la función `mi_telefono()`.
 */
export async function guardarTelefono(telefono: string): Promise<{ error?: string; ok?: boolean }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Tenés que iniciar sesión." };

  const limpio = telefono.trim().slice(0, 40);
  // Laxo a propósito: acá entran celulares con 0 y 15, fijos con característica, y gente que
  // escribe "+54 9 11". Validar el formato argentino de verdad rechazaría números válidos.
  if (limpio.replace(/\D/g, "").length < 8) {
    return { error: "Ingresá un teléfono con al menos 8 dígitos." };
  }

  const { error } = await supabase.from("profiles").update({ phone: limpio } as never).eq("id", user.id);
  if (error) {
    console.error("[guardarTelefono] error:", error.message);
    return { error: "No pudimos guardar el teléfono. Probá de nuevo." };
  }

  revalidatePath("/cliente");
  revalidatePath("/dashboard");
  return { ok: true };
}
