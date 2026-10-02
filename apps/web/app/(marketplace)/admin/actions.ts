"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { olvidar, ETIQUETAS } from "@/lib/cache-publico";
import { esTexto } from "@pinturapro/dominio";

const ES_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * El dueño da de baja una reseña.
 *
 * Por qué existe: una reseña de una estrella con una amenaza adentro se publicaba al instante
 * y no había forma de sacarla sin entrar a la base — /terminos promete "si el contenido
 * incumple estas reglas, lo damos de baja", y el panel no tenía con qué (abuso-marketplace,
 * 2/10/2026).
 *
 * Quién puede: sólo quien tiene `is_admin`, preguntado a la base (`es_admin()`, 0023) con la
 * sesión de quien llama. La tabla `reviews` no tiene permiso de borrado para nadie, a
 * propósito (ni el autor puede arrepentirse y bajarle el promedio a un pintor): por eso, una
 * vez confirmado que es el administrador, se borra con la clave de servicio. Al borrar, el
 * trigger recalcula el promedio del pintor.
 */
export async function borrarResena(id: string): Promise<{ error?: string; ok?: boolean }> {
  // Una Server Action es un endpoint: llega lo que el que llama quiera mandar.
  if (!esTexto(id) || !ES_UUID.test(id)) return { error: "Falta la reseña." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Tenés que iniciar sesión." };
  const { data: esAdmin } = await supabase.rpc("es_admin" as never);
  if (esAdmin !== true) return { error: "Esta acción es sólo para la administración." };
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) return { error: "Falta configurar el servidor para poder borrar." };

  const { data, error } = await createAdminClient().from("reviews").delete().eq("id", id).select("id, target_id, rating");
  if (error) return { error: "No pudimos borrar la reseña. Probá de nuevo." };
  const borrada = (data as unknown as { id: string; target_id: string; rating: number }[] | null)?.[0];
  if (!borrada) return { error: "Esa reseña ya no existe." };

  // Queda en los registros quién borró qué, sin el texto ni nombres (Cloud Logging lo guarda).
  console.info(
    "[moderacion] reseña dada de baja",
    JSON.stringify({ resena: borrada.id, pintor: borrada.target_id, estrellas: borrada.rating, por: user.id }),
  );

  olvidar(ETIQUETAS.resenas, ETIQUETAS.pintores);
  revalidatePath("/admin");
  revalidatePath(`/pintor/${borrada.target_id}`);
  return { ok: true };
}
