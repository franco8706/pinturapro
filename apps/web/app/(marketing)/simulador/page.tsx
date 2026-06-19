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
