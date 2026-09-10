import { Navbar } from "@/components/features/navbar";
import { Footer } from "@/components/features/footer";
import { SectionLabel } from "@/components/features/states";
import { getPainters } from "@/lib/queries";
import { PintoresClient } from "./pintores-client";

import type { Metadata } from "next";

// El copy decía "pintores verificados" y prometía "verificación de oficio y antecedentes".
// Ese proceso no existe: `profiles.verified` no lo escribe ninguna parte del código, sólo se
// puede poner a mano por SQL. Lo que SÍ es cierto y distingue al directorio es que una reseña
// exige un trabajo completado (lo hace cumplir la RLS de `reviews`): no se pueden comprar ni
// inventar. La palabra "verificado" queda reservada para el distintivo individual de quien
// efectivamente pasó por un control, y no como promesa general del directorio.
export const metadata: Metadata = {
  title: "Directorio de pintores",
  description: "Pintores profesionales por zona y especialidad, con reseñas de clientes que los contrataron por la plataforma.",
  alternates: { canonical: "/pintores" },
  openGraph: { title: "Directorio de pintores", description: "Pintores profesionales por zona y especialidad, con reseñas de clientes que los contrataron por la plataforma." },
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
              Pintores profesionales, cerca tuyo.
            </h1>
            <p className="font-body text-body-lg text-concrete max-w-xl">
              Elegí por zona, especialidad y reseñas. Cada reseña viene de un cliente que contrató
              ese trabajo por la plataforma: no se pueden comprar ni dejar sin haber contratado.
            </p>
          </div>

          <PintoresClient painters={painters} />
        </div>
      </section>
      <Footer />
    </main>
  );
}
