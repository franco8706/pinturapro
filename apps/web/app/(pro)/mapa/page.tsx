import { Navbar } from "@/components/features/navbar";
import { Footer } from "@/components/features/footer";
import { getPainters } from "@/lib/queries";
import { MapaClient } from "./mapa-client";
import type { Metadata } from "next";
import { tarjeta } from "@/lib/tarjeta";

// Se arma en cada visita, pero sus datos salen de la caché pública (lib/cache-publico.ts): la
// base se consulta como mucho una vez por minuto. Dinámica a propósito, para que el despliegue
// no necesite la base al compilar.
export const dynamic = "force-dynamic";

// Sin canónica ni tarjeta propias, /mapa heredaba las de la portada: Google lo veía como un
// duplicado de "/" y WhatsApp lo mostraba con la tarjeta de la portada (`buscadores`, 28/9).
export const metadata: Metadata = {
  title: "Mapa de pintores",
  description: "Encontrá pintores independientes por zona en CABA y el conurbano, con sus reseñas.",
  alternates: { canonical: "/mapa" },
  ...tarjeta({
    titulo: "Mapa de pintores",
    descripcion: "Encontrá pintores independientes por zona en CABA y el conurbano, con sus reseñas.",
    ruta: "/mapa",
  }),
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
