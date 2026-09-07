import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getOwnProfile } from "@/lib/queries";

/**
 * Dispatcher: manda a cada usuario a su panel según el rol.
 *  - sin sesión      → /ingresar
 *  - sin rol elegido → /bienvenida (primer login social)
 *  - cliente         → /cliente
 *  - pintor / empresa → /dashboard (panel profesional)
 */
export default async function MiPanelPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/ingresar?next=/mi-panel");

  // UNA sola lectura del perfil: antes eran dos consultas que fallaban en direcciones
  // opuestas y armaban un bucle de redirects con /bienvenida.
  const profile = await getOwnProfile(user.id);
  if (!profile || !profile.onboarded) redirect("/bienvenida");

  if (profile.type === "client") redirect("/cliente");
  redirect("/dashboard");
}
