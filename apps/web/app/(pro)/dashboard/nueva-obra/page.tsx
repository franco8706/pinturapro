import Link from "next/link";
import { redirect } from "next/navigation";
import { Navbar } from "@/components/features/navbar";
import { Footer } from "@/components/features/footer";
import { createClient } from "@/lib/supabase/server";
import { getOwnProfile } from "@/lib/queries";
import { NuevaObraForm } from "./nueva-obra-form";

export default async function NuevaObraPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/ingresar?next=/dashboard/nueva-obra");

  // El portfolio es de quien pinta. La base ya lo impide (policy `projects_insert_own`,
  // migración 0016), pero sin este control una cuenta de cliente completaba el formulario
  // entero —título, descripción, foto— y recién al enviar leía "No podés hacer esa acción
  // sobre este trabajo". Que la pantalla no ofrezca lo que el servidor va a rechazar.
  // Si el perfil no se puede leer, se deja pasar: decide la base, no una lectura fallida.
  //
  // El redirect va FUERA del try: `redirect()` funciona lanzando una excepción, así que
  // dentro del try el catch se la comería y la página seguiría renderizando.
  let esCliente = false;
  try {
    esCliente = (await getOwnProfile(user.id))?.type === "client";
  } catch {
    esCliente = false;
  }
  if (esCliente) redirect("/cliente");

  return (
    <main>
      <Navbar />
      <section className="pt-32 sm:pt-40 pb-section min-h-screen">
        <div className="container-asymmetric">
          <Link href="/dashboard" className="font-body text-body-sm text-concrete hover:text-ink transition-colors">
            ← Volver al panel
          </Link>
          <h1 className="font-display text-display-xl mt-4 mb-3">Nueva obra</h1>
          <p className="font-body text-body-lg text-concrete mb-10 max-w-xl">
            Sumá un proyecto a tu portfolio. Se publica al instante en tu perfil y en Obras.
          </p>
          <NuevaObraForm />
        </div>
      </section>
      <Footer />
    </main>
  );
}
