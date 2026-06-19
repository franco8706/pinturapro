import { Navbar } from "@/components/features/navbar";
import { Footer } from "@/components/features/footer";
import { HeroFluid } from "@/components/features/hero-fluid";
import { MagneticButton } from "@/components/features/magnetic-button";
import { ProjectCard } from "@/components/features/project-card";
import { ProcessStep } from "@/components/features/process-step";
import { Reveal, SectionLabel } from "@/components/features/states";
import { mockProjects } from "@/lib/data";

const steps = [
  { title: "Diagnóstico", description: "Visitamos la obra, medimos superficies y entendemos qué querés lograr. Sin compromiso." },
  { title: "Paleta y propuesta", description: "Definimos colores, terminaciones y un presupuesto cerrado. Sin sorpresas a mitad de obra." },
  { title: "Ejecución", description: "Equipo propio, materiales premium y protección total del espacio. Trabajamos prolijo." },
  { title: "Entrega", description: "Revisión final junto a vos. Garantía escrita sobre la mano de obra y los materiales." },
];

const stats = [
  { value: "+340", label: "Obras entregadas" },
  { value: "12", label: "Años de oficio" },
  { value: "4.9★", label: "Promedio de clientes" },
  { value: "100%", label: "Garantía escrita" },
];

export default function HomePage() {
  return (
    <main>
      <Navbar />

      {/* HERO */}
      <section className="relative min-h-screen flex items-center overflow-hidden">
        <div className="absolute inset-0 -z-10 opacity-70">
          <HeroFluid />
        </div>
        <div className="container-asymmetric w-full pt-32 pb-20">
          <p className="font-mono text-mono-sm text-concrete uppercase tracking-widest mb-6">
            Pintura profesional de obra · Buenos Aires
          </p>
          <h1 className="font-display text-display-xl max-w-4xl text-balance mb-8">
            Transformamos espacios con color.
          </h1>
          <p className="font-body text-body-lg text-concrete max-w-xl mb-10">
            Para dueños de casa, arquitectos y constructoras que no negocian la terminación.
            Precisión, materiales premium y un resultado que se siente.
          </p>
          <div className="flex flex-wrap gap-4">
            <MagneticButton href="/cotizar" variant="primary">
              Cotizar mi obra
            </MagneticButton>
            <MagneticButton href="/obras" variant="ghost">
              Ver obras
            </MagneticButton>
          </div>
        </div>
      </section>

      {/* STATS */}
      <section className="border-y border-concrete/15 bg-mist">
        <div className="container-asymmetric grid grid-cols-2 lg:grid-cols-4">
          {stats.map((stat, i) => (
            <Reveal
              key={stat.label}
              delay={i * 0.06}
              className="py-10 lg:py-14 px-2 border-r border-concrete/10 last:border-0"
            >
              <p className="font-display text-display-lg leading-none">{stat.value}</p>
              <p className="font-body text-body-sm text-concrete mt-2">{stat.label}</p>
            </Reveal>
          ))}
        </div>
      </section>

      {/* OBRAS DESTACADAS */}
      <section className="py-section">
        <div className="container-asymmetric">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-6 mb-12 sm:mb-16">
            <div>
              <SectionLabel className="mb-4">Obras seleccionadas</SectionLabel>
              <h2 className="font-display text-display-lg max-w-2xl text-balance">
                Cada proyecto, su propia paleta.
              </h2>
            </div>
            <MagneticButton href="/obras" variant="ghost">
              Ver portfolio completo
            </MagneticButton>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 lg:gap-12">
            {mockProjects.map((project, index) => (
              <Reveal key={project.id} delay={index * 0.06}>
                <ProjectCard
                  title={project.title}
                  location={project.location}
                  category={project.category}
                  accentColor={project.accentColor}
                  imageSrc={project.images[0]}
                  slug={project.slug}
                  index={index}
                />
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* PROCESO */}
      <section className="py-section bg-ink text-bone">
        <div className="container-asymmetric grid grid-cols-1 lg:grid-cols-12 gap-12">
          <div className="lg:col-span-4">
            <SectionLabel className="text-bone/50 mb-4">Cómo trabajamos</SectionLabel>
            <h2 className="font-display text-display-lg text-balance">
              Un proceso disciplinado, de principio a fin.
            </h2>
          </div>
          <div className="lg:col-span-7 lg:col-start-6">
            {steps.map((step, i) => (
              <div key={step.title} className="flex gap-6 group">
                <div className="shrink-0 flex flex-col items-center">
                  <span className="font-mono text-mono-sm text-bone/50 tabular-nums">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  {i < steps.length - 1 && <div className="w-px flex-1 mt-3 bg-bone/15" />}
                </div>
                <div className="pb-12 group-last:pb-0">
                  <h3 className="font-display text-display-md mb-3">{step.title}</h3>
                  <p className="font-body text-body-md text-bone/60 max-w-md leading-relaxed">{step.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-section">
        <div className="container-asymmetric text-center">
          <h2 className="font-display text-display-xl max-w-3xl mx-auto text-balance mb-8">
            ¿Listos para empezar tu obra?
          </h2>
          <p className="font-body text-body-lg text-concrete max-w-xl mx-auto mb-10">
            Pedí tu cotización online en minutos. Sin compromiso, con presupuesto cerrado.
          </p>
          <div className="flex justify-center">
            <MagneticButton href="/cotizar" variant="primary">
              Cotizar mi obra
            </MagneticButton>
          </div>
        </div>
      </section>

      <Footer />
    </main>
  );
}
