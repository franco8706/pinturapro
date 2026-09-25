"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { mensajeDeError } from "@/lib/errores-db";

/**
 * Borrar la propia cuenta, sin depender de que alguien lea un correo.
 *
 * Es el derecho de supresión de la Ley 25.326. La política decía "escribinos y lo hacemos",
 * lo cual cumple, pero deja el plazo de 5 días hábiles en manos de que alguien atienda a
 * tiempo. Acá lo hace la persona sola.
 *
 * Qué se borra y qué queda, y por qué:
 *
 *  · **Se borra la cuenta** (email, contraseña, sesión) y el perfil entero: nombre,
 *    teléfono, foto, zona, descripción. Con eso desaparece el dato personal.
 *  · **Se borran las obras y los pedidos publicados**, y sus fotos del almacenamiento: son
 *    contenido propio.
 *  · **Se borran las consultas** enviadas por los formularios con ese email.
 *  · **Quedan los trabajos ya acordados con otra persona**, sin el nombre. Son el registro de
 *    trabajo del pintor —lo que acordó y lo que cobró—, y el derecho de uno a borrar lo suyo
 *    no llega hasta borrar lo del otro. Del lado del pintor se ve "Cliente dado de baja".
 *  · **Quedan las reseñas escritas**, sin autor. Son la reputación del pintor: si se fueran
 *    con la cuenta, cualquiera podría bajarle el promedio a un pintor dándose de baja.
 *
 * Esto último es posible gracias a la migración 0019: antes la base borraba en cascada los
 * trabajos y las reseñas junto con el perfil.
 *
 * **Un trabajo en marcha frena la baja.** Si hay un trabajo aceptado o en curso, hay alguien
 * del otro lado esperando que se haga: primero se cierra o se cancela, y después se da de
 * baja. Se explica en pantalla en vez de dejarlo pasar en silencio.
 */
export async function eliminarMiCuenta(confirmacion: string): Promise<{ error?: string; ok?: boolean }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Tenés que iniciar sesión." };

  // Se pide escribir la palabra a mano: un borrado que no se puede deshacer no puede
  // depender de un solo clic mal dado.
  if (confirmacion.trim().toUpperCase() !== "ELIMINAR") {
    return { error: 'Para confirmar, escribí ELIMINAR en el campo.' };
  }

  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.error("[eliminar-cuenta] falta SUPABASE_SERVICE_ROLE_KEY");
    return { error: "No pudimos completar la baja. Escribinos y la hacemos nosotros." };
  }

  const admin = createAdminClient();
  const yo = user.id;

  // ── 1. ¿Hay algo en marcha con otra persona? ──
  const { data: vivos, error: errorVivos } = await admin
    .from("jobs")
    .select("id, status")
    .or(`client_id.eq.${yo},painter_id.eq.${yo}`)
    .in("status", ["accepted", "in_progress"]);
  if (errorVivos) return { error: mensajeDeError(errorVivos) };
  if (((vivos ?? []) as unknown[]).length > 0) {
    return {
      error:
        "Tenés un trabajo en marcha con otra persona. Cerralo o cancelalo desde tu panel y " +
        "después vas a poder dar de baja la cuenta.",
    };
  }

  // ── 2. Las cotizaciones a medio camino se van con la persona ──
  //
  // Las claves foráneas dejan el trabajo en pie con las partes en NULL (0019), que es lo
  // correcto para un trabajo YA HECHO: es el registro del otro. Pero una cotización todavía
  // sin aceptar no es registro de nada, y dejarla huérfana hace daño de los dos lados:
  //
  //  · Si se va el cliente, su pedido desaparece y al pintor le queda una cotización colgada
  //    de un pedido que ya no existe, sin título y sin nadie.
  //  · Si se va el pintor, al cliente le queda una cotización de "Cuenta dada de baja" que
  //    todavía puede aceptar, y aceptarla crearía un trabajo sin pintor.
  //
  // Se borran las suyas en estado 'quoted' y 'cancelled'. Las completadas quedan.
  const { error: errorCotizaciones } = await admin
    .from("jobs")
    .delete()
    .or(`client_id.eq.${yo},painter_id.eq.${yo}`)
    .in("status", ["quoted", "cancelled"]);
  if (errorCotizaciones) {
    console.error("[eliminar-cuenta] cotizaciones a medio camino:", errorCotizaciones.message);
  }

  // ── 3. Las fotos del almacenamiento ──
  // Van antes que la fila: si se borra la fila primero y después falla el almacenamiento,
  // quedan archivos sin dueño y sin forma de encontrarlos. Al revés, si falla acá, la cuenta
  // sigue en pie y se puede reintentar.
  for (const bucket of ["projects", "avatars"] as const) {
    try {
      const { data: archivos } = await admin.storage.from(bucket).list(yo);
      if (archivos?.length) {
        await admin.storage.from(bucket).remove(archivos.map((a) => `${yo}/${a.name}`));
      }
    } catch (e) {
      console.error(`[eliminar-cuenta] no se pudieron borrar las fotos de ${bucket}:`, e);
      // Se sigue igual: dejar la cuenta viva por una foto que no se pudo borrar sería peor
      // para la persona que pidió irse. Queda en el log para limpiarlo a mano.
    }
  }

  // ── 4. Las consultas enviadas por los formularios ──
  if (user.email) {
    const { error } = await admin.from("leads").delete().eq("email", user.email);
    if (error) console.error("[eliminar-cuenta] consultas:", error.message);
  }
  await admin.from("leads").delete().eq("user_id", yo);

  // ── 5. La cuenta ──
  // Borrar el usuario de autenticación arrastra el perfil (`profiles.id` referencia
  // `auth.users` en cascada), y con el perfil se van las obras y los pedidos. Los trabajos y
  // las reseñas quedan sin nombre, que es lo que arregló la migración 0019.
  const { error: errorBaja } = await admin.auth.admin.deleteUser(yo);
  if (errorBaja) {
    console.error("[eliminar-cuenta] falló la baja:", errorBaja.message);
    return { error: "No pudimos completar la baja. Probá de nuevo en un momento." };
  }

  // La sesión del navegador queda apuntando a un usuario que ya no existe: se cierra acá
  // para que no quede una pantalla a medias.
  await supabase.auth.signOut({ scope: "local" }).catch(() => {});

  return { ok: true };
}
