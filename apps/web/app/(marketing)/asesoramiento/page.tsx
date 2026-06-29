import { Navbar } from "@/components/features/navbar";
import { Footer } from "@/components/features/footer";
import { SectionLabel } from "@/components/features/states";
import { getResources } from "@/lib/queries";
import { AdvisorClient } from "./advisor-client";

export default async function AsesoramientoPage() {
  const advice = await getResources("advice");

  return (
    <main>
      <Navbar />
      <section className="pt-32 sm:pt-40 pb-section min-h-screen">
        <div className="container-asymmetric">
          <SectionLabel className="mb-4">Asesoramiento</SectionLabel>
          <h1 className="font-display text-display-xl max-w-3xl text-balance mb-4">
            Asesoramiento para tu proyecto.
          </h1>
          <p className="font-body text-body-lg text-concrete max-w-xl mb-12">
            Respondé tres preguntas y te orientamos sobre materiales, preparación y el mejor camino para tu obra.
          </p>

          <div className="max-w-3xl">
            <AdvisorClient />
          </div>

          {advice.length > 0 && (
            <div className="mt-16">
              <h2 className="font-display text-display-md mb-6">Consejos rápidos</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                {advice.map((r) => (
                  <article key={r.id} className="border border-concrete/15 p-6">
                    <h3 className="font-display text-display-md leading-tight mb-2">{r.title}</h3>
                    {r.summary && <p className="font-body text-body-sm text-concrete mb-2">{r.summary}</p>}
                    {r.body && <p className="font-body text-body-sm text-concrete/80">{r.body}</p>}
                  </article>
                ))}
              </div>
            </div>
          )}
        </div>
      </section>
      <Footer />
    </main>
  );
}
