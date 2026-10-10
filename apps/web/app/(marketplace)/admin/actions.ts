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

/**
 * El dueño confirma una cotización del dólar que saltó más del 10 % (decisión del 6/10/2026:
 * se toca plata, así que un salto así no se usa solo). Desde que se confirma, el precio en pesos
 * de la suscripción se calcula con ella.
 *
 * `cotizaciones_dolar` no la escribe nadie con su sesión (0027): se verifica `es_admin()` con la
 * sesión de quien llama y se escribe con la clave de servicio, como `borrarResena`.
 */
export async function confirmarCotizacion(id: number): Promise<{ error?: string; ok?: boolean }> {
  if (typeof id !== "number" || !Number.isInteger(id) || id <= 0) return { error: "Falta la cotización." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Tenés que iniciar sesión." };
  const { data: esAdmin } = await supabase.rpc("es_admin" as never);
  if (esAdmin !== true) return { error: "Esta acción es sólo para la administración." };
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) return { error: "Falta configurar el servidor." };

  const { data, error } = await createAdminClient()
    .from("cotizaciones_dolar")
    .update({ estado: "vigente", confirmada_por: user.id, confirmada_en: new Date().toISOString() } as never)
    .eq("id", id)
    // También una descartada: en una devaluación el control (BCRA) se atrasa un día y la lectura
    // real quedaba descartada sin forma de usarla (dinero-y-comisiones, 8/10/2026).
    .in("estado", ["a_confirmar", "descartada"])
    .select("id, venta");
  if (error) return { error: "No pudimos confirmar la cotización. Probá de nuevo." };
  const fila = (data as unknown as { id: number; venta: number }[] | null)?.[0];
  if (!fila) return { error: "Esa cotización ya no está para confirmar." };

  console.info("[cotizacion] confirmada por el admin", JSON.stringify({ cotizacion: fila.id, venta: fila.venta, por: user.id }));
  olvidar(ETIQUETAS.cobro);
  revalidatePath("/admin");
  return { ok: true };
}

/** Quién llama, si es el admin. La misma verificación que `borrarResena`: `es_admin()` con su sesión. */
async function adminQueLlama(): Promise<{ id: string } | { error: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Tenés que iniciar sesión." };
  const { data: esAdmin } = await supabase.rpc("es_admin" as never);
  if (esAdmin !== true) return { error: "Esta acción es sólo para la administración." };
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) return { error: "Falta configurar el servidor." };
  return { id: user.id };
}

/**
 * El dueño carga el extracto del banco (CSV) y se confirman solas las transferencias que traen el
 * código de un pintor y un monto que alcanza (6/10/2026). Cargar el mismo extracto dos veces no
 * registra nada dos veces.
 */
export async function cargarExtracto(
  formData: FormData,
): Promise<{ error?: string; resumen?: import("@/lib/pagos/transferencia").ResumenDeExtracto }> {
  if (!(formData instanceof FormData)) return { error: "No pudimos leer el formulario." };
  const quien = await adminQueLlama();
  if ("error" in quien) return { error: quien.error };
  const archivo = formData.get("extracto");
  if (!(archivo instanceof File) || archivo.size === 0) return { error: "Elegí el archivo del extracto (CSV)." };
  if (archivo.size > 2_000_000) return { error: "El archivo es demasiado grande (máximo 2 MB)." };
  // Muchos bancos exportan en Windows-1252 (Latin-1): leído como UTF-8, "Crédito" no se reconocía
  // y el extracto daba 0 créditos sin decir por qué (abuso-marketplace, 8/10/2026).
  const bytes = new Uint8Array(await archivo.arrayBuffer());
  let texto: string;
  try {
    texto = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    texto = new TextDecoder("windows-1252").decode(bytes);
  }
  const { procesarExtracto } = await import("@/lib/pagos/transferencia");
  try {
    const resumen = await procesarExtracto(texto, quien.id);
    console.info("[transferencias] extracto cargado", JSON.stringify({ ...resumen, por: quien.id }));
    revalidatePath("/admin");
    return { resumen };
  } catch (e) {
    console.error("[transferencias] el extracto no se pudo procesar:", e instanceof Error ? e.message : e);
    return { error: "No pudimos procesar el extracto. Probá de nuevo; si sigue, revisá el archivo." };
  }
}

/** Confirmar a mano un aviso de transferencia (el dueño vio la plata en el banco). */
export async function confirmarTransferencia(cobroId: string): Promise<{ error?: string; ok?: boolean }> {
  if (!esTexto(cobroId) || !ES_UUID.test(cobroId)) return { error: "Falta la transferencia." };
  const quien = await adminQueLlama();
  if ("error" in quien) return { error: quien.error };
  const { confirmarTransferenciaAMano } = await import("@/lib/pagos/transferencia");
  const r = await confirmarTransferenciaAMano(cobroId, quien.id);
  if (r === "no_existe") return { error: "Esa transferencia ya no existe." };
  if (r === "anulado") return { error: "Esa transferencia ya se marcó como que no llegó." };
  console.info("[transferencias] confirmada a mano", JSON.stringify({ cobro: cobroId, por: quien.id, resultado: r }));
  revalidatePath("/admin");
  return { ok: true };
}

/** Rechazar un aviso de transferencia que nunca llegó (o no corresponde). No toca el libro. */
export async function rechazarTransferencia(cobroId: string): Promise<{ error?: string; ok?: boolean }> {
  if (!esTexto(cobroId) || !ES_UUID.test(cobroId)) return { error: "Falta la transferencia." };
  const quien = await adminQueLlama();
  if ("error" in quien) return { error: quien.error };
  const { error } = await createAdminClient()
    .from("cobros")
    .update({ estado: "anulado" } as never)
    .eq("id", cobroId)
    .in("estado", ["pendiente", "a_revisar"]);
  if (error) return { error: "No pudimos rechazarla. Probá de nuevo." };
  console.info("[transferencias] rechazada", JSON.stringify({ cobro: cobroId, por: quien.id }));
  revalidatePath("/admin");
  return { ok: true };
}

/**
 * Registrar una devolución: el arrepentimiento que prometen los términos, o un pago que no
 * correspondía. El pago queda anulado en el libro (que no se borra) y el acceso se recalcula sin
 * ese mes. La plata la devuelve el dueño desde el banco.
 */
export async function devolverPago(pagoId: string): Promise<{ error?: string; ok?: boolean }> {
  if (!esTexto(pagoId) || !ES_UUID.test(pagoId)) return { error: "Falta el pago." };
  const quien = await adminQueLlama();
  if ("error" in quien) return { error: quien.error };
  const { registrarDevolucion } = await import("@/lib/pagos/transferencia");
  try {
    const r = await registrarDevolucion(pagoId, quien.id);
    if (r === "no_existe") return { error: "Ese pago no existe." };
    console.info("[transferencias] devolución", JSON.stringify({ pago: pagoId, por: quien.id, resultado: r }));
  } catch (e) {
    console.error("[transferencias] la devolución falló:", e instanceof Error ? e.message : e);
    return { error: "No pudimos registrar la devolución. Probá de nuevo." };
  }
  revalidatePath("/admin");
  return { ok: true };
}
