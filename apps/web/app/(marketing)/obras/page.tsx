import { Navbar } from "@/components/features/navbar";
import { Footer } from "@/components/features/footer";
import { ProjectCard } from "@/components/features/project-card";
import { MagneticButton } from "@/components/features/magnetic-button";
import { mockProjects } from "@/lib/data";

const categories = ["Todas", "Residencial", "Comercial", "Industrial"];
const colors = ["Todos", "Rojo", "Azul", "Verde", "Negro", "Blanco", "Tierra"];
const zones = ["Todas", "CABA", "Zona Norte", "Zona Oeste", "Zona Sur"];

export default function PortfolioPage() {
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
                {categories.map((cat) => (
                  <button key={cat} className="px-4 py-2 font-body text-body-sm border border-concrete/30 text-ink hover:bg-ink hover:text-bone transition-colors duration-300">{cat}</button>
                ))}
              </div>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 lg:gap-12">
            {mockProjects.map((project, index) => (
              <ProjectCard key={project.id} title={project.title} location={project.location} category={project.category} accentColor={project.accentColor} imageSrc={project.images[0]} slug={project.slug} index={index} />
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
