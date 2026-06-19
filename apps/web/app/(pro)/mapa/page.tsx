"use client";

import { useState } from "react";
import Link from "next/link";
import { Navbar } from "@/components/features/navbar";
import { Footer } from "@/components/features/footer";
import { LevelBadge } from "@/components/features/level-badge";
import { mockPainters } from "@/lib/data";
import { cn } from "@/lib/utils";

const zones = [
  { id: "CABA", label: "CABA", x: 52, y: 58 },
  { id: "Zona Norte", label: "Zona Norte", x: 48, y: 32 },
  { id: "Zona Oeste", label: "Zona Oeste", x: 28, y: 56 },
  { id: "Zona Sur", label: "Zona Sur", x: 56, y: 80 },
];

export default function MapaPage() {
  const [activeZone, setActiveZone] = useState<string | null>("CABA");
  const painters = mockPainters.filter((p) => !activeZone || p.zone === activeZone);

  return (
    <main>
      <Navbar />
      <section className="pt-32 sm:pt-40 pb-section">
        <div className="container-asymmetric">
          <div className="mb-12">
            <p className="font-mono text-mono-sm text-concrete uppercase tracking-widest mb-4">Cobertura</p>
            <h1 className="font-display text-display-xl max-w-3xl text-balance">Encontrá pintores por zona.</h1>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12">
            {/* Mapa esquemático */}
            <div className="lg:col-span-7">
              <div className="relative aspect-[4/3] bg-mist border border-concrete/15 overflow-hidden">
                {/* INTEGRACIÓN: reemplazar por mapa real (Mapbox / Google Maps) con geodata */}
                <div className="absolute inset-0 opacity-[0.06] [background-image:linear-gradient(#141414_1px,transparent_1px),linear-gradient(90deg,#141414_1px,transparent_1px)] [background-size:32px_32px]" />
                {zones.map((zone) => {
                  const count = mockPainters.filter((p) => p.zone === zone.id).length;
                  const active = activeZone === zone.id;
                  return (
                    <button
                      key={zone.id}
                      onClick={() => setActiveZone(zone.id)}
                      style={{ left: `${zone.x}%`, top: `${zone.y}%` }}
                      className="absolute -translate-x-1/2 -translate-y-1/2 group"
                    >
                      <span
                        className={cn(
                          "block rounded-full transition-all duration-300",
                          active ? "bg-ink" : "bg-concrete/40 group-hover:bg-ink/70",
                        )}
                        style={{ width: 16 + count * 8, height: 16 + count * 8 }}
                      />
                      <span
                        className={cn(
                          "absolute top-full mt-2 left-1/2 -translate-x-1/2 whitespace-nowrap font-mono text-mono-sm",
                          active ? "text-ink" : "text-concrete",
                        )}
                      >
                        {zone.label} · {count}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Lista */}
            <div className="lg:col-span-5">
              <div className="flex items-center justify-between mb-6">
                <h2 className="font-display text-display-md">{activeZone ?? "Todas las zonas"}</h2>
                <button
                  onClick={() => setActiveZone(null)}
                  className="font-mono text-mono-sm text-concrete hover:text-ink transition-colors"
                >
                  Ver todas
                </button>
              </div>
              <div className="space-y-3">
                {painters.map((p) => (
                  <Link
                    key={p.id}
                    href={`/pintor/${p.id}`}
                    className="flex items-center justify-between gap-4 p-4 border border-concrete/15 hover:border-ink transition-colors duration-300"
                  >
                    <div>
                      <p className="font-display text-body-lg">{p.name}</p>
                      <p className="font-body text-body-sm text-concrete">★ {p.rating.toFixed(1)} · {p.zone}</p>
                    </div>
                    <LevelBadge level={p.level} />
                  </Link>
                ))}
                {painters.length === 0 && (
                  <p className="font-body text-body-md text-concrete py-8 text-center">
                    Todavía no hay pintores en esta zona.
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>
      <Footer />
    </main>
  );
}
