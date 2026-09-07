import { Navbar } from "@/components/features/navbar";
import { Footer } from "@/components/features/footer";
import { SectionLabel } from "@/components/features/states";
import { getPainters } from "@/lib/queries";
import { PintoresClient } from "./pintores-client";

import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Pintores verificados",
  description: "Directorio de pintores profesionales verificados, con reseñas reales, especialidades y zona de trabajo.",
  alternates: { canonical: "/pintores" },
  openGraph: { title: "Pintores verificados", description: "Directorio de pintores profesionales verificados, con reseñas reales, especialidades y zona de trabajo." },
};

export default async function PintoresPage() {
  const painters = await getPainters();

  return (
    <main>
      <Navbar />
      <section className="pt-32 sm:pt-40 pb-section">
        <div className="container-asymmetric">
          <div className="mb-12">
            <SectionLabel className="mb-4">Pro Partners</SectionLabel>
            <h1 className="font-display text-display-xl max-w-3xl text-balance mb-6">
              Pintores verificados, cerca tuyo.
            </h1>
            <p className="font-body text-body-lg text-concrete max-w-xl">
              Cada profesional pasa por verificación de oficio, antecedentes y reseñas reales de clientes.
            </p>
          </div>

          <PintoresClient painters={painters} />
        </div>
      </section>
      <Footer />
    </main>
  );
}
