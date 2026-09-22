import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * "Descargar mis datos": todo lo que el sitio tiene sobre quien lo pide, en un archivo.
 *
 * Es el derecho de acceso del artículo 14 de la Ley 25.326. Antes se cumplía a mano —la
 * política decía "escribinos y te lo mandamos"—, lo que significaba que alguien tenía que
 * abrir la base, buscar, armar el listado y contestar dentro de los 10 días corridos. Si el
 * pedido llegaba un viernes y se leía el lunes, ya se habían ido tres días. Acá lo hace la
 * persona sola, cuando quiere.
 *
 * Por qué usa service-role y no la sesión de la persona: varias tablas están cerradas por
 * RLS incluso para el propio interesado —`leads`, por ejemplo, sólo la lee un admin— y un
 * pedido de acceso tiene que devolver TODO, no sólo lo que la interfaz deja ver. El riesgo
 * de saltear RLS se acota de la única forma que sirve: cada consulta filtra por el id y el
 * email de la sesión verificada, y no hay ningún parámetro de entrada que pueda cambiar eso.
 */
export const dynamic = "force-dynamic";

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json(
      { error: "Tenés que iniciar sesión para descargar tus datos." },
      { status: 401, headers: { "Cache-Control": "no-store" } },
    );
  }

  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    // Sin la clave de servicio el archivo saldría incompleto y nadie se enteraría. Mejor
    // decir que no se pudo: un derecho de acceso a medias no es un derecho de acceso.
    console.error("[mis-datos] falta SUPABASE_SERVICE_ROLE_KEY");
    return NextResponse.json(
      { error: "No pudimos preparar el archivo. Escribinos y te lo mandamos nosotros." },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }

  const admin = createAdminClient();
  const yo = user.id;
  const email = user.email ?? "";

  try {
    const [perfil, proyectos, trabajos, resenasEscritas, resenasRecibidas, consultas] = await Promise.all([
      admin.from("profiles").select("*").eq("id", yo).maybeSingle(),
      admin.from("projects").select("*").eq("owner_id", yo),
      admin.from("jobs").select("*").or(`client_id.eq.${yo},painter_id.eq.${yo}`),
      admin.from("reviews").select("*").eq("author_id", yo),
      admin.from("reviews").select("*").eq("target_id", yo),
      // Las consultas se dejan por email además de por `user_id`: los formularios públicos
      // (/cotizar, /contacto, /registro) se completan sin sesión, así que la fila no tiene
      // usuario asociado aunque sea de esta misma persona.
      email
        ? admin.from("leads").select("*").or(`user_id.eq.${yo},email.eq.${email}`)
        : admin.from("leads").select("*").eq("user_id", yo),
    ]);

    const datos = {
      generado: new Date().toISOString(),
      aclaracion:
        "Esto es todo lo que Pintura Pro tiene guardado sobre vos. La contraseña no está " +
        "porque no la guardamos: se almacena cifrada de una forma que no se puede revertir, " +
        "ni siquiera por nosotros.",
      cuenta: {
        id: user.id,
        email: user.email,
        creada: user.created_at,
        ultimoIngreso: user.last_sign_in_at,
        formaDeIngreso: user.app_metadata?.provider ?? "email",
      },
      perfil: perfil.data ?? null,
      obrasYPedidosPublicados: proyectos.data ?? [],
      trabajosYCotizaciones: trabajos.data ?? [],
      resenasQueEscribiste: resenasEscritas.data ?? [],
      resenasQueRecibiste: resenasRecibidas.data ?? [],
      consultasYFormularios: consultas.data ?? [],
    };

    const fecha = new Date().toISOString().slice(0, 10);
    return new NextResponse(JSON.stringify(datos, null, 2), {
      status: 200,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": `attachment; filename="mis-datos-pinturapro-${fecha}.json"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (e) {
    console.error("[mis-datos] falló:", e);
    return NextResponse.json(
      { error: "No pudimos preparar el archivo. Probá de nuevo en un momento." },
      { status: 500, headers: { "Cache-Control": "no-store" } },
    );
  }
}
