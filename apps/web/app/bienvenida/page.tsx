import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getOwnProfile } from "@/lib/queries";
import { RolePicker } from "./role-picker";

/**
 * Primer ingreso (típicamente con Google/Microsoft/Facebook): elegir el rol.
 * Si el usuario ya eligió, lo mandamos a su panel.
 */
export default async function BienvenidaPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/ingresar?next=/mi-panel");

  // Sólo rebota si el perfil se leyó Y dice que ya eligió rol. Si la lectura falla,
  // `getOwnProfile` tira y lo atrapa app/error.tsx: mostrarle el selector de rol a alguien
  // que ya lo eligió sólo sirve para que la elección vuelva a fallar contra la misma base.
  const perfil = await getOwnProfile(user.id);
  if (perfil?.onboarded) redirect("/mi-panel");

  const firstName = (user.user_metadata?.full_name as string | undefined)?.split(" ")[0] ?? "";

  return (
    <main className="min-h-screen flex flex-col items-center justify-center bg-plaster px-6 py-16">
      <div className="w-full max-w-lg">
        <h1 className="font-display text-display-md text-ink mb-2">
          {firstName ? `Bienvenido, ${firstName}` : "Bienvenido a Pintura Pro"}
        </h1>
        <p className="font-body text-body-md text-concrete mb-8">
          Para armar tu espacio, contanos cómo vas a usar Pintura Pro. Vas a poder cambiarlo más adelante.
        </p>
        <RolePicker userId={user.id} />
      </div>
    </main>
  );
}
