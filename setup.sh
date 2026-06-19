#!/bin/bash
# setup.sh - Script de inicialización para Claude Code en GitHub Codespaces
# Este script crea toda la estructura de directorios y archivos del proyecto Pintura Pro

set -e

echo "🎨 Pintura Pro — Setup de proyecto"
echo "===================================="

# Crear estructura de directorios
echo "📁 Creando estructura de directorios..."

mkdir -p "apps/web/app/(marketing)/obras/[slug]" "apps/web/app/(marketing)/simulador" "apps/web/app/(marketing)/cotizar" "apps/web/app/(marketing)/nosotros" "apps/web/app/(marketing)/contacto"
mkdir -p "apps/web/app/(pro)/pintores" "apps/web/app/(pro)/pintor/[id]" "apps/web/app/(pro)/registro" "apps/web/app/(pro)/mapa" "apps/web/app/(pro)/dashboard"
mkdir -p "apps/web/app/(marketplace)/publicar" "apps/web/app/(marketplace)/trabajos" "apps/web/app/(marketplace)/cotizaciones" "apps/web/app/(marketplace)/checkout" "apps/web/app/(marketplace)/dashboard" "apps/web/app/(marketplace)/admin"
mkdir -p apps/web/components/{features,providers,layouts}
mkdir -p apps/web/hooks
mkdir -p apps/web/lib
mkdir -p apps/web/types
mkdir -p apps/web/public/images
mkdir -p packages/ui/src

# Archivos ya existen del repo (layout.tsx, globals.css, etc.)
# Ahora creamos los archivos de páginas y componentes

echo "📝 Generando archivos de páginas y componentes..."

# ============================================
# FASE 1 — EMPRESA
# ============================================

# Home (ya existe en el repo original, pero incluimos referencia)
echo "  ✅ Home (page.tsx) — ya existe en el repo"

# Portfolio / Obras
cat > "apps/web/app/(marketing)/obras/page.tsx" << 'PAGINA_OBRAS'
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
PAGINA_OBRAS

echo "  ✅ Portfolio (obras/page.tsx)"

# Proyecto Individual
cat > "apps/web/app/(marketing)/obras/[slug]/page.tsx" << 'PAGINA_PROYECTO'
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
PAGINA_PROYECTO

echo "  ✅ Proyecto Individual (obras/[slug]/page.tsx)"

# Simulador
cat > "apps/web/app/(marketing)/simulador/page.tsx" << 'PAGINA_SIMULADOR'
"use client";
import { useState } from "react";
import { Navbar } from "@/components/features/navbar";
import { Footer } from "@/components/features/footer";
import { ColorSwatch } from "@/components/features/color-swatch";
import { MagneticButton } from "@/components/features/magnetic-button";

const environments = [
  { id: "living", name: "Living", image: "env-living.jpg" },
  { id: "dormitorio", name: "Dormitorio", image: "env-dormitorio.jpg" },
  { id: "cocina", name: "Cocina", image: "env-cocina.jpg" },
  { id: "oficina", name: "Oficina", image: "env-oficina.jpg" },
];

const colorPalettes = [
  { name: "Terracota", colors: ["#C41E3A", "#A0522D", "#CD853F", "#D2691E", "#8B4513"] },
  { name: "Océano", colors: ["#1E3A8A", "#2563EB", "#3B82F6", "#60A5FA", "#93C5FD"] },
  { name: "Bosque", colors: ["#2D5A3D", "#3A7D44", "#4ADE80", "#166534", "#14532D"] },
  { name: "Monocromo", colors: ["#141414", "#6B6B6B", "#9CA3AF", "#D1D5DB", "#F5F4F0"] },
  { name: "Dorado", colors: ["#B8860B", "#DAA520", "#FFD700", "#F0E68C", "#BDB76B"] },
];

export default function SimuladorPage() {
  const [selectedEnv, setSelectedEnv] = useState(environments[0]);
  const [selectedColor, setSelectedColor] = useState(colorPalettes[0].colors[0]);
  const [intensity, setIntensity] = useState(50);

  return (
    <main>
      <Navbar />
      <section className="pt-32 sm:pt-40 pb-section bg-plaster min-h-screen">
        <div className="container-asymmetric">
          <div className="mb-12">
            <p className="font-mono text-mono-sm text-concrete uppercase tracking-widest mb-4">Simulador</p>
            <h1 className="font-display text-display-xl max-w-3xl mb-6">Probá el color antes de decidir.</h1>
            <p className="font-body text-body-lg text-concrete max-w-xl">Elegí un ambiente, una paleta y ajustá la intensidad.</p>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12">
            <div className="lg:col-span-8">
              <div className="relative aspect-[4/3] overflow-hidden bg-mist" style={{ backgroundColor: selectedColor, opacity: intensity / 100 }}>
                <div className="absolute inset-0 bg-concrete/10 flex flex-col items-center justify-center">
                  <span className="font-mono text-mono-sm text-concrete mb-2">{selectedEnv.image}</span>
                  <span className="font-body text-body-sm text-concrete">Ambiente: {selectedEnv.name}</span>
                </div>
                <div className="absolute inset-0 mix-blend-multiply" style={{ backgroundColor: selectedColor, opacity: intensity / 100 }} />
              </div>
              <div className="mt-6">
                <label className="font-mono text-mono-sm text-concrete uppercase tracking-widest mb-2 block">Intensidad: {intensity}%</label>
                <input type="range" min="0" max="100" value={intensity} onChange={(e) => setIntensity(Number(e.target.value))} className="w-full h-2 bg-concrete/20 appearance-none cursor-pointer" style={{ backgroundImage: `linear-gradient(to right, ${selectedColor} 0%, ${selectedColor} ${intensity}%, #E5E7EB ${intensity}%, #E5E7EB 100%)` }} />
              </div>
            </div>
            <div className="lg:col-span-4 space-y-8">
              <div>
                <h3 className="font-display text-display-md mb-4">Ambiente</h3>
                <div className="grid grid-cols-2 gap-3">
                  {environments.map((env) => (
                    <button key={env.id} onClick={() => setSelectedEnv(env)} className={`p-4 text-left border transition-colors duration-300 ${selectedEnv.id === env.id ? "border-ink bg-ink text-bone" : "border-concrete/30 text-ink hover:border-ink"}`}>
                      <span className="font-body text-body-sm">{env.name}</span>
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <h3 className="font-display text-display-md mb-4">Paleta</h3>
                <div className="space-y-4">
                  {colorPalettes.map((palette) => (
                    <div key={palette.name}>
                      <p className="font-mono text-mono-sm text-concrete mb-2">{palette.name}</p>
                      <div className="flex gap-2">
                        {palette.colors.map((color) => (
                          <ColorSwatch key={color} color={color} selected={selectedColor === color} onClick={() => setSelectedColor(color)} />
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <MagneticButton href="/cotizar" variant="primary" className="w-full justify-center">Cotizar con este color</MagneticButton>
            </div>
          </div>
        </div>
      </section>
      <Footer />
    </main>
  );
}
PAGINA_SIMULADOR

echo "  ✅ Simulador (simulador/page.tsx)"

echo ""
echo "🎉 Setup completo. Ahora ejecutá:"
echo "   pnpm install"
echo "   pnpm dev"
