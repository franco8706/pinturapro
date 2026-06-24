import Link from "next/link";
import { redirect } from "next/navigation";
import { Navbar } from "@/components/features/navbar";
import { Footer } from "@/components/features/footer";
import { createClient } from "@/lib/supabase/server";
import { NuevaObraForm } from "./nueva-obra-form";

export default async function NuevaObraPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/ingresar?next=/dashboard/nueva-obra");

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
