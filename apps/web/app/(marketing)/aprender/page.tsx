import Link from "next/link";
import { Navbar } from "@/components/features/navbar";
import { Footer } from "@/components/features/footer";
import { SectionLabel } from "@/components/features/states";
import { getResources } from "@/lib/queries";
import { AprenderClient } from "./aprender-client";

export default async function AprenderPage() {
  // Guías, videos y cursos (el asesoramiento tiene su propia página).
  const resources = (await getResources()).filter((r) => r.kind !== "advice");

  return (
    <main>
      <Navbar />
      <section className="pt-32 sm:pt-40 pb-section min-h-screen">
        <div className="container-asymmetric">
          <SectionLabel className="mb-4">Aprender</SectionLabel>
          <h1 className="font-display text-display-xl max-w-3xl text-balance mb-4">
            Guías, videos y cursos para crecer como profesional.
          </h1>
          <p className="font-body text-body-lg text-concrete max-w-xl mb-12">
            Todo lo que necesitás para arrancar, mejorar tu técnica y conseguir más y mejores trabajos.
          </p>

          {resources.length === 0 ? (
            <div className="border border-concrete/15 p-8 sm:p-12">
              <p className="font-display text-body-lg text-ink mb-2">El contenido se está cargando</p>
              <p className="font-body text-body-md text-concrete">
                Muy pronto vas a encontrar acá nuestras guías, videos y cursos.
              </p>
            </div>
          ) : (
            <AprenderClient resources={resources} />
          )}

          <div className="mt-16 border-t border-concrete/15 pt-10">
            <h2 className="font-display text-display-md mb-3">¿Tenés un proyecto en mente?</h2>
            <p className="font-body text-body-md text-concrete mb-5 max-w-xl">
              Si no sabés por dónde empezar, nuestro asesor te orienta en 1 minuto según lo que necesitás.
            </p>
            <Link
              href="/asesoramiento"
              className="inline-block px-5 py-3 bg-ink text-bone font-body text-body-sm hover:bg-ink/90 transition-colors"
            >
              Ir al asesoramiento →
            </Link>
          </div>
        </div>
      </section>
      <Footer />
    </main>
  );
}
