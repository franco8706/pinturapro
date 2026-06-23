"use client";

import { useMemo, useState } from "react";
import { Navbar } from "@/components/features/navbar";
import { Footer } from "@/components/features/footer";
import { MagneticButton } from "@/components/features/magnetic-button";
import { PhotoSimulator } from "@/components/features/photo-simulator";
import { BrandColorSwatch } from "@/components/features/brand-color-swatch";
import { brands, colorsByUsage } from "@/lib/brands";
import { cn } from "@/lib/utils";

type Target = "interior" | "exterior";

export default function SimuladorPage() {
  const [target, setTarget] = useState<Target>("interior");
  const [brandId, setBrandId] = useState(brands[0].id);
  const [color, setColor] = useState<string | null>(null);
  const [colorName, setColorName] = useState<string>("");

  const brand = useMemo(() => brands.find((b) => b.id === brandId)!, [brandId]);
  const colors = useMemo(() => colorsByUsage(brand, target), [brand, target]);

  return (
    <main>
      <Navbar />
      <section className="pt-32 sm:pt-40 pb-section bg-plaster min-h-screen">
        <div className="container-asymmetric">
          <div className="mb-10">
            <p className="font-mono text-mono-sm text-concrete uppercase tracking-widest mb-4">Simulador con IA (SAM)</p>
            <h1 className="font-display text-display-xl max-w-3xl text-balance mb-6">
              Probá el color en tu propia pared.
            </h1>
            <p className="font-body text-body-lg text-concrete max-w-xl">
              Subí una foto y <strong className="text-ink">hacé clic en la pared</strong>: la IA marca el contorno exacto.
              Después aplicá colores reales de las marcas.
            </p>
          </div>

          {/* Toggle interior / exterior */}
          <div className="inline-flex border border-concrete/30 mb-10">
            {(["interior", "exterior"] as Target[]).map((t) => (
              <button
                key={t}
                onClick={() => {
                  setTarget(t);
                  setColor(null);
                  setColorName("");
                }}
                className={cn(
                  "px-6 py-3 font-body text-body-sm capitalize transition-colors duration-300",
                  target === t ? "bg-ink text-bone" : "hover:bg-mist",
                )}
              >
                {t}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12">
            {/* Lienzo */}
            <div className="lg:col-span-8">
              <PhotoSimulator color={color} />
            </div>

            {/* Selector de marca + colores */}
            <div className="lg:col-span-4 space-y-8">
              <div>
                <h3 className="font-display text-display-md mb-4">Marca</h3>
                <div className="flex flex-wrap gap-2">
                  {brands.map((b) => (
                    <button
                      key={b.id}
                      onClick={() => {
                        setBrandId(b.id);
                        setColor(null);
                        setColorName("");
                      }}
                      className={cn(
                        "px-3 py-2 font-body text-body-sm border transition-colors duration-300 flex items-center gap-2",
                        brandId === b.id ? "border-ink bg-ink text-bone" : "border-concrete/30 hover:border-ink",
                      )}
                    >
                      <span className="w-2 h-2 rounded-full" style={{ backgroundColor: b.accent }} />
                      {b.name}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <div className="flex items-baseline justify-between mb-4">
                  <h3 className="font-display text-display-md">Color</h3>
                  <span className="font-mono text-mono-sm text-concrete capitalize">{target}</span>
                </div>
                <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-3 gap-3">
                  {colors.map((c) => (
                    <BrandColorSwatch
                      key={`${c.name}-${c.code}`}
                      color={c}
                      selected={color === c.hex && colorName === c.name}
                      onClick={() => {
                        setColor(c.hex);
                        setColorName(c.name);
                      }}
                    />
                  ))}
                </div>
              </div>

              {color && (
                <div className="p-4 bg-mist border border-concrete/15">
                  <div className="flex items-center gap-3">
                    <span className="w-10 h-10 border border-black/10" style={{ backgroundColor: color }} />
                    <div>
                      <p className="font-body text-body-md text-ink">{colorName}</p>
                      <p className="font-mono text-mono-sm text-concrete">
                        {brand.name} · {color.toUpperCase()}
                      </p>
                    </div>
                  </div>
                  <MagneticButton href="/cotizar" variant="primary" className="w-full justify-center mt-4">
                    Cotizar con este color
                  </MagneticButton>
                </div>
              )}
            </div>
          </div>

          <p className="font-mono text-mono-sm text-concrete/60 mt-10 max-w-2xl">
            * La detección con IA corre en tu navegador (no subimos tu foto a ningún servidor). El color es una
            referencia digital y puede variar respecto del producto real.
          </p>
        </div>
      </section>
      <Footer />
    </main>
  );
}
