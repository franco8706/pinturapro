import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getOwnProfile, getLeads, getPainters } from "@/lib/queries";
import { AdminClient } from "./admin-client";

/**
 * Gate del panel de moderación.
 *
 * Antes esta ruta compilaba como página estática, sin ninguna verificación: se anunciaba
 * como "Acceso restringido" pero la abría cualquiera sin login. Hoy sólo muestra mocks, así
 * que no había fuga de datos — pero quedaba lista para convertirse en un agujero el día que
 * se conectara a datos reales.
 *
 * OJO: el esquema todavía no tiene un rol de administrador. Acá se usa `type = 'company'`
 * como aproximación (la empresa es la dueña de la plataforma). Antes de cablear acciones
 * reales de moderación —suspender pintores, aprobar verificaciones— hace falta un rol
 * admin de verdad, chequeado también por RLS y no sólo en la página.
 */
export default async function AdminPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/ingresar?next=/admin");

  const profile = await getOwnProfile(user.id);
  if (!profile || profile.type !== "company") redirect("/mi-panel");

  // Datos REALES. Antes esta página renderizaba mocks: mostraba pintores inventados y
  // botones "Suspender" que no hacían nada, bajo un cartel de "Acceso restringido".
  const [leads, painters] = await Promise.all([getLeads(), getPainters()]);

  return <AdminClient leads={leads} painters={painters} />;
}
