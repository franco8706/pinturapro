import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { Navbar } from "@/components/features/navbar";
import { Footer } from "@/components/features/footer";
import { createClient } from "@/lib/supabase/server";
import { getOwnedProjectBySlug } from "@/lib/queries";
import { NuevaObraForm } from "../../nueva-obra/nueva-obra-form";

export default async function EditarObraPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/ingresar?next=/dashboard/editar/${slug}`);

  const obra = await getOwnedProjectBySlug(user.id, slug);
  if (!obra) notFound();

  return (
    <main>
      <Navbar />
      <section className="pt-32 sm:pt-40 pb-section min-h-screen">
        <div className="container-asymmetric">
          <Link href="/dashboard" className="font-body text-body-sm text-concrete hover:text-ink transition-colors">
            ← Volver al panel
          </Link>
          <h1 className="font-display text-display-xl mt-4 mb-3">Editar obra</h1>
          <p className="font-body text-body-lg text-concrete mb-10 max-w-xl">
            Actualizá los datos de “{obra.title}”. Los cambios se reflejan al instante en tu perfil y en Obras.
          </p>
          <NuevaObraForm initial={obra} />
        </div>
      </section>
      <Footer />
    </main>
  );
}
