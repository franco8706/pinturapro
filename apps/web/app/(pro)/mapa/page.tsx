import { Navbar } from "@/components/features/navbar";
import { Footer } from "@/components/features/footer";
import { getPainters } from "@/lib/queries";
import { MapaClient } from "./mapa-client";

export const metadata = {
  title: "Mapa de pintores",
  description: "Encontrá pintores por zona en CABA y el conurbano.",
};

export default async function MapaPage() {
  // Datos reales de Supabase (con fallback a mocks si la consulta falla).
  const painters = await getPainters();

  return (
    <main>
      <Navbar />
      <section className="pt-32 sm:pt-40 pb-section">
        <div className="container-asymmetric">
          <div className="mb-12">
            <p className="font-mono text-mono-sm text-concrete uppercase tracking-widest mb-4">Cobertura</p>
            <h1 className="font-display text-display-xl max-w-3xl text-balance">Encontrá pintores por zona.</h1>
          </div>

          <MapaClient painters={painters} />
        </div>
      </section>
      <Footer />
    </main>
  );
}
