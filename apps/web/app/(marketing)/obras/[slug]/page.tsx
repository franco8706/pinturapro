"use client";
import { useParams } from "next/navigation";
import { Navbar } from "@/components/features/navbar";
import { Footer } from "@/components/features/footer";
import { MagneticButton } from "@/components/features/magnetic-button";
import { BeforeAfterSlider } from "@/components/features/before-after-slider";
import { mockProjects } from "@/lib/data";
import { notFound } from "next/navigation";

export default function ProjectPage() {
  const params = useParams();
  const slug = params.slug as string;
  const project = mockProjects.find((p) => p.slug === slug);
  if (!project) { notFound(); }

  return (
    <main style={{ ["--project-accent" as string]: project.accentColor }}>
      <Navbar />
      <section className="pt-32 sm:pt-40 pb-section bg-plaster">
        <div className="container-asymmetric">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-16">
            <div className="lg:col-span-7">
              <div className="relative aspect-[16/10] overflow-hidden bg-mist">
                <div className="absolute inset-0 bg-concrete/10 flex items-center justify-center">
                  <span className="font-mono text-mono-sm text-concrete">{project.images[0]}</span>
                </div>
              </div>
            </div>
            <div className="lg:col-span-5 flex flex-col justify-center">
              <div className="flex items-center gap-3 mb-6">
                <span className="w-3 h-3 rounded-full" style={{ backgroundColor: project.accentColor }} />
                <span className="font-mono text-mono-sm text-concrete uppercase tracking-widest">{project.category} · {project.year}</span>
              </div>
              <h1 className="font-display text-display-xl mb-4">{project.title}</h1>
              <p className="font-body text-body-lg text-concrete mb-8">{project.location}</p>
              <p className="font-body text-body-lg leading-relaxed mb-10">{project.description}</p>
              <MagneticButton href="/cotizar" variant="primary">Cotizar proyecto similar</MagneticButton>
            </div>
          </div>
        </div>
      </section>
      {project.beforeAfter && (
        <section className="py-section bg-plaster">
          <div className="container-asymmetric">
            <p className="font-mono text-mono-sm text-concrete uppercase tracking-widest mb-8">Antes / Después</p>
            <BeforeAfterSlider beforeImage={project.beforeAfter.before} afterImage={project.beforeAfter.after} accentColor={project.accentColor} />
          </div>
        </section>
      )}
      <section className="py-section" style={{ backgroundColor: project.accentColor }}>
        <div className="container-asymmetric">
          <p className="font-mono text-mono-sm text-bone/70 uppercase tracking-widest mb-8">Paleta de la obra</p>
          <div className="flex flex-wrap gap-6">
            <div className="flex items-center gap-3"><div className="w-16 h-16 bg-bone" /><div><p className="font-display text-body-lg text-bone">Base</p><p className="font-mono text-mono-sm text-bone/70">#FFFFFF</p></div></div>
            <div className="flex items-center gap-3"><div className="w-16 h-16" style={{ backgroundColor: project.accentColor, filter: 'brightness(1.3)' }} /><div><p className="font-display text-body-lg text-bone">Principal</p><p className="font-mono text-mono-sm text-bone/70">{project.accentColor}</p></div></div>
            <div className="flex items-center gap-3"><div className="w-16 h-16 bg-ink" /><div><p className="font-display text-body-lg text-bone">Contraste</p><p className="font-mono text-mono-sm text-bone/70">#141414</p></div></div>
          </div>
        </div>
      </section>
      <Footer />
    </main>
  );
}
