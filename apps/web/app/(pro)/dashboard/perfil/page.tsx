import Link from "next/link";
import { redirect } from "next/navigation";
import { Navbar } from "@/components/features/navbar";
import { Footer } from "@/components/features/footer";
import { createClient } from "@/lib/supabase/server";
import { getOwnProfile, getPainterExtras, getMiTelefono } from "@/lib/queries";
import { PerfilForm } from "./perfil-form";

export default async function PerfilPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/ingresar?next=/dashboard/perfil");

  const profile = await getOwnProfile(user.id);
  if (!profile || !profile.onboarded) redirect("/bienvenida");
  if (profile.type === "client") redirect("/cliente");

  const [extras, telefono] = await Promise.all([getPainterExtras(user.id), getMiTelefono()]);

  return (
    <main>
      <Navbar />
      <section className="pt-32 sm:pt-40 pb-section min-h-screen">
        <div className="container-asymmetric">
          <Link href="/dashboard" className="font-body text-body-sm text-concrete hover:text-ink transition-colors">
            ← Volver al panel
          </Link>
          <h1 className="font-display text-display-xl mt-4 mb-3">Tu perfil profesional</h1>
          <p className="font-body text-body-lg text-concrete mb-10 max-w-xl">
            Así te ven los clientes en el directorio. Completá tu bio, zona y especialidades para
            recibir mejores trabajos.
          </p>
          <PerfilForm
            initial={{
              name: profile.name,
              bio: profile.bio,
              zone: profile.zone,
              phone: telefono,
              avatar: profile.image,
              specialty: profile.specialty,
              pros: extras.pros,
              cons: extras.cons,
            }}
          />
        </div>
      </section>
      <Footer />
    </main>
  );
}
