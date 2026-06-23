"use client";

import { useState } from "react";
import { Navbar } from "@/components/features/navbar";
import { Footer } from "@/components/features/footer";
import { MagneticButton } from "@/components/features/magnetic-button";
import { BrandColorSwatch } from "@/components/features/brand-color-swatch";
import { Reveal, SectionLabel } from "@/components/features/states";
import { brands } from "@/lib/brands";
import { cn } from "@/lib/utils";

type UsageFilter = "todos" | "interior" | "exterior";

export default function ColoresPage() {
  const [activeBrand, setActiveBrand] = useState<string>("todas");
  const [usage, setUsage] = useState<UsageFilter>("todos");

  const visibleBrands = brands.filter((b) => activeBrand === "todas" || b.id === activeBrand);

  const matchUsage = (u: string) => usage === "todos" || u === usage || u === "ambos";

  return (
    <main>
      <Navbar />
      <section className="pt-32 sm:pt-40 pb-section">
        <div className="container-asymmetric">
          <div className="mb-12 max-w-3xl">
            <SectionLabel className="mb-4">Cartas de color</SectionLabel>
            <h1 className="font-display text-display-xl text-balance mb-6">
              Los colores de las mejores marcas, en un solo lugar.
            </h1>
            <p className="font-body text-body-lg text-concrete">
              Explorá las paletas de Alba, Sherwin Williams, Sinteplast y Plavicon. Elegí tu color y probalo en tu
              propia foto con el simulador.
            </p>
          </div>

          {/* Filtros */}
          <div className="flex flex-col sm:flex-row gap-8 mb-12 pb-8 border-b border-concrete/15">
            <div className="flex flex-col gap-2">
              <span className="font-mono text-mono-sm text-concrete uppercase tracking-widest">Marca</span>
              <div className="flex flex-wrap gap-2">
                {[{ id: "todas", name: "Todas" }, ...brands].map((b) => (
                  <button
                    key={b.id}
                    onClick={() => setActiveBrand(b.id)}
                    className={cn(
                      "px-4 py-2 font-body text-body-sm border transition-colors duration-300",
                      activeBrand === b.id ? "border-ink bg-ink text-bone" : "border-concrete/30 hover:border-ink",
                    )}
                  >
                    {b.name}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <span className="font-mono text-mono-sm text-concrete uppercase tracking-widest">Uso</span>
              <div className="flex flex-wrap gap-2">
                {(["todos", "interior", "exterior"] as UsageFilter[]).map((u) => (
                  <button
                    key={u}
                    onClick={() => setUsage(u)}
                    className={cn(
                      "px-4 py-2 font-body text-body-sm border capitalize transition-colors duration-300",
                      usage === u ? "border-ink bg-ink text-bone" : "border-concrete/30 hover:border-ink",
                    )}
                  >
                    {u}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Marcas y paletas */}
          <div className="space-y-16">
            {visibleBrands.map((brand) => {
              const colors = brand.colors.filter((c) => matchUsage(c.usage));
              if (colors.length === 0) return null;
              return (
                <Reveal key={brand.id} as="section">
                  <div className="flex items-center gap-3 mb-6">
                    <span className="w-3 h-3 rounded-full" style={{ backgroundColor: brand.accent }} />
                    <h2 className="font-display text-display-md">{brand.name}</h2>
                    <span className="font-body text-body-sm text-concrete">· {colors.length} colores</span>
                  </div>
                  <p className="font-body text-body-md text-concrete max-w-xl mb-6">{brand.description}</p>
                  <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-4">
                    {colors.map((color) => (
                      <BrandColorSwatch key={`${brand.id}-${color.name}`} color={color} />
                    ))}
                  </div>
                </Reveal>
              );
            })}
          </div>

          <div className="mt-16 p-8 bg-mist border border-concrete/15 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
            <div>
              <h3 className="font-display text-display-md mb-2">¿Ya tenés tu color?</h3>
              <p className="font-body text-body-md text-concrete">Subí una foto de tu ambiente y probalo en la pared.</p>
            </div>
            <MagneticButton href="/simulador" variant="primary">
              Ir al simulador
            </MagneticButton>
          </div>

          <p className="font-mono text-mono-sm text-concrete/60 mt-8">
            * Los colores son una referencia digital y pueden variar respecto del producto real. Consultá la carta
            física de cada marca antes de comprar.
          </p>
        </div>
      </section>
      <Footer />
    </main>
  );
}
