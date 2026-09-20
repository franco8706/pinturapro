import Link from "next/link";
import { Navbar } from "@/components/features/navbar";
import { Footer } from "@/components/features/footer";
import { ProjectCard } from "@/components/features/project-card";
import { MagneticButton } from "@/components/features/magnetic-button";
import { getProjects } from "@/lib/queries";

import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Obras",
  description: "Portfolio de obras de pintura profesional: residencial, comercial e industrial. Antes y después de cada trabajo.",
  alternates: { canonical: "/obras" },
  openGraph: { title: "Obras", description: "Portfolio de obras de pintura profesional: residencial, comercial e industrial. Antes y después de cada trabajo." },
};

/**
 * Los filtros eran decorativos: `<button>{cat}</button>` sin `onClick` ni estado, así que
 * apretar "Industrial" —una categoría sin ninguna obra— seguía mostrando las tres obras.
 * Había además dos listas más, `colors` y `zones`, declaradas y nunca dibujadas.
 *
 * Ahora la categoría va en la dirección (`/obras?tipo=Comercial`): el filtrado ocurre en el
 * servidor, el link se puede compartir y guardar, funciona sin JavaScript y no obliga a
 * convertir toda la página en componente de cliente para un filtro de cuatro opciones.
 */
const CATEGORIAS = ["Todas", "Residencial", "Comercial", "Industrial"] as const;

export default async function PortfolioPage({
  searchParams,
}: {
  searchParams: Promise<{ tipo?: string }>;
}) {
  const { tipo } = await searchParams;
  // Sólo se acepta un valor de la lista: cualquier otra cosa en la URL se ignora y se
  // muestra todo, en vez de dejar la pantalla vacía sin explicación.
  const activa = CATEGORIAS.find((c) => c === tipo) ?? "Todas";
  const todas = await getProjects();
  const projects = activa === "Todas" ? todas : todas.filter((p) => p.category === activa);

  return (
    <main>
      <Navbar />
      <section className="pt-32 sm:pt-40 pb-section bg-plaster">
        <div className="container-asymmetric">
          <div className="mb-12 sm:mb-16">
            <p className="font-mono text-mono-sm text-concrete uppercase tracking-widest mb-4">Portfolio</p>
            <h1 className="font-display text-display-xl max-w-3xl mb-6">Obras que resisten el tiempo.</h1>
            <p className="font-body text-body-lg text-concrete max-w-xl">
              Cada proyecto tiene su propia paleta, su propia historia.
            </p>
          </div>
          <div className="flex flex-wrap gap-4 mb-16 border-b border-concrete/20 pb-8">
            <div className="flex flex-col gap-2">
              <span className="font-mono text-mono-sm text-concrete uppercase">Tipo</span>
              <div className="flex flex-wrap gap-2">
                {CATEGORIAS.map((cat) => (
                  <Link
                    key={cat}
                    href={cat === "Todas" ? "/obras" : `/obras?tipo=${encodeURIComponent(cat)}`}
                    aria-current={activa === cat ? "page" : undefined}
                    className={
                      activa === cat
                        ? "px-4 py-2 font-body text-body-sm border border-ink bg-ink text-bone transition-colors duration-300"
                        : "px-4 py-2 font-body text-body-sm border border-concrete/30 text-ink hover:bg-ink hover:text-bone transition-colors duration-300"
                    }
                  >
                    {cat}
                  </Link>
                ))}
              </div>
            </div>
          </div>
          {projects.length === 0 && (
            <p className="font-body text-body-lg text-concrete">
              Todavía no hay obras de tipo {activa.toLowerCase()}.{" "}
              <Link href="/obras" className="text-ink underline underline-offset-2">
                Ver todas
              </Link>
            </p>
          )}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 lg:gap-12">
            {projects.map((project, index) => (
              <ProjectCard key={project.id} title={project.title} location={project.location} category={project.category} accentColor={project.accentColor} imageSrc={project.images[0]} slug={project.slug} index={index} priority={index === 0} />
            ))}
          </div>
          <div className="mt-16 text-center">
            <MagneticButton href="/cotizar" variant="primary">Quiero algo así</MagneticButton>
          </div>
        </div>
      </section>
      <Footer />
    </main>
  );
}
