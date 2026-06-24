import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getOwnProfile, isOnboarded } from "@/lib/queries";

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

  if (!(await isOnboarded(user.id))) redirect("/bienvenida");

  const profile = await getOwnProfile(user.id);
  if (!profile) redirect("/bienvenida");

  if (profile.type === "client") redirect("/cliente");
  redirect("/dashboard");
}
