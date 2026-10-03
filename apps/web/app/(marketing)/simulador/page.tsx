"use client";

import { useMemo, useState } from "react";
import { Navbar } from "@/components/features/navbar";
import { Footer } from "@/components/features/footer";
import { MagneticButton } from "@/components/features/magnetic-button";
import { PhotoSimulator } from "@/components/features/photo-simulator";
import { BrandColorSwatch } from "@/components/features/brand-color-swatch";
import { brands, colorsByUsage, PALETA_DEMO } from "@/lib/brands";
import { cn } from "@/lib/utils";

type Target = "interior" | "exterior";

export default function SimuladorPage() {
  const [target, setTarget] = useState<Target>("interior");
  const [brandId, setBrandId] = useState(brands[0].id);
  const [color, setColor] = useState<string | null>(null);
  const [colorName, setColorName] = useState<string>("");
  // Intensidad del color sobre la foto (0,4 a 1). Vive acá para dibujar su control junto al
  // color elegido; el simulador la recibe como prop.
  //
  // Arranca en 100 %. Arrancaba en 90 %, y ese 10 % que faltaba lo ponía la pared VIEJA:
  // Blanco Puro sobre una pared roja se veía rosado (ΔE 7,4 contra la muestra), Negro Mate
  // sobre una blanca, gris carbón (ΔE 4,7). La textura y la luz de la foto no dependen de esto:
  // salen de la luminosidad, con cualquier Intensidad. Prueba: `simulador-color-fiel`.
  const [intensidad, setIntensidad] = useState(1);

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
              Después probá colores sobre tu propia pared.
            </p>
          </div>

          {/* Toggle interior / exterior */}
          {/* `flex-wrap` + `max-w-full`: con el texto agrandado al 200 % los dos botones no entraban y
              estiraban la página (mismo efecto que el carrusel de la portada). */}
          <div className="inline-flex flex-wrap max-w-full border border-concrete/30 mb-10">
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
              <PhotoSimulator color={color} strength={intensidad} />
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
                      {/* "Alba · #FAFAF7" le atribuía a la marca un color de muestra. */}
                      <p className="font-mono text-mono-sm text-concrete">
                        {PALETA_DEMO ? `Color de muestra · ${color.toUpperCase()}` : `${brand.name} · ${color.toUpperCase()}`}
                      </p>
                    </div>
                  </div>
                  {/* Intensidad: acá, al lado del color recién elegido, y no dentro del lienzo
                      (que en el orden del teclado queda antes de la grilla de colores). */}
                  <label className="mt-4 flex items-center gap-3 font-mono text-mono-sm text-concrete">
                    Intensidad
                    <input
                      type="range"
                      min={40}
                      max={100}
                      value={Math.round(intensidad * 100)}
                      onChange={(e) => setIntensidad(Number(e.target.value) / 100)}
                      className="flex-1 min-w-0"
                    />
                    <span className="tabular-nums w-10 text-right">{Math.round(intensidad * 100)}%</span>
                  </label>
                  <MagneticButton href="/publicar" variant="primary" className="w-full justify-center mt-4">
                    Pedir cotizaciones
                  </MagneticButton>
                </div>
              )}
            </div>
          </div>

          {/* Este texto decía "la detección con IA corre en tu navegador (no subimos tu foto a
              ningún servidor)". Fue cierto mientras el modelo corría en el cliente, pero esa
              versión se retiró por precisión y lag: hoy la detección con IA manda la foto a
              /api/segment y de ahí a un servicio externo. La frase quedó sin actualizar y pasó
              a ser una afirmación falsa sobre fotos del interior de la casa de la persona. */}
          <p className="font-body text-body-sm text-concrete mt-10 max-w-2xl">
            * El pincel y la varita mágica trabajan enteros en tu navegador: la foto no sale de tu
            equipo. La <strong>detección automática con IA</strong> sí la envía a un servicio de
            procesamiento para analizarla; no la guardamos ni la usamos para nada más. Si preferís
            que la foto no salga de tu dispositivo, usá el pincel o la varita. El color es una
            referencia digital y puede variar respecto del producto real.
            {PALETA_DEMO && (
              <>
                {" "}
                <strong className="text-ink">
                  Los colores son de muestra: no son las cartas oficiales de ninguna marca.
                </strong>{" "}
                Para comprar, elegí el color en la carta física de la pinturería.
              </>
            )}
          </p>
        </div>
      </section>
      <Footer />
    </main>
  );
}
