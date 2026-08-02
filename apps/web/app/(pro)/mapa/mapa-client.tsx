"use client";

import { useMemo, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { LevelBadge } from "@/components/features/level-badge";
import type { Painter } from "@/lib/data";
import { cn } from "@/lib/utils";

// Leaflet toca `window` al importarse → fuera del render del servidor.
const PainterMap = dynamic(() => import("@/components/features/painter-map").then((m) => m.PainterMap), {
  ssr: false,
  loading: () => <div className="aspect-[4/3] w-full bg-mist border border-concrete/15 animate-pulse" />,
});

/**
 * Deriva la zona macro del texto libre de `profiles.location`.
 * "San Isidro, Zona Norte" → "Zona Norte" · "Palermo, CABA" → "CABA"
 */
function zoneOf(location: string): string {
  const parts = location.split(",").map((s) => s.trim());
  return parts[parts.length - 1] || location;
}

export function MapaClient({ painters }: { painters: Painter[] }) {
  const [zone, setZone] = useState<string | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);

  // Las zonas salen de los datos, no de una lista fija: si mañana entra un pintor de
  // La Plata, el filtro aparece solo.
  const zones = useMemo(() => {
    const counts = new Map<string, number>();
    for (const p of painters) {
      if (!p.zone) continue;
      const z = zoneOf(p.zone);
      counts.set(z, (counts.get(z) ?? 0) + 1);
    }
    return [...counts.entries()].sort((a, b) => b[1] - a[1]);
  }, [painters]);

  const visible = useMemo(
    () => (zone ? painters.filter((p) => zoneOf(p.zone) === zone) : painters),
    [painters, zone],
  );

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12">
      <div className="lg:col-span-7">
        <PainterMap painters={visible} activeId={activeId} onSelect={setActiveId} />

        {zones.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-4">
            <button
              onClick={() => setZone(null)}
              className={cn(
                "px-3 py-1.5 font-mono text-mono-sm uppercase tracking-widest border transition-colors",
                zone === null ? "bg-ink text-bone border-ink" : "border-concrete/30 text-concrete hover:border-ink hover:text-ink",
              )}
            >
              Todas · {painters.length}
            </button>
            {zones.map(([z, count]) => (
              <button
                key={z}
                onClick={() => setZone(z)}
                className={cn(
                  "px-3 py-1.5 font-mono text-mono-sm uppercase tracking-widest border transition-colors",
                  zone === z ? "bg-ink text-bone border-ink" : "border-concrete/30 text-concrete hover:border-ink hover:text-ink",
                )}
              >
                {z} · {count}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="lg:col-span-5">
        <h2 className="font-display text-display-md mb-6">{zone ?? "Todas las zonas"}</h2>
        <div className="space-y-3">
          {visible.map((p) => (
            <Link
              key={p.id}
              href={`/pintor/${p.id}`}
              onMouseEnter={() => setActiveId(p.id)}
              onMouseLeave={() => setActiveId(null)}
              className={cn(
                "flex items-center justify-between gap-4 p-4 border transition-colors duration-300",
                activeId === p.id ? "border-ink" : "border-concrete/15 hover:border-ink",
              )}
            >
              <div>
                <p className="font-display text-body-lg">{p.name}</p>
                <p className="font-body text-body-sm text-concrete">
                  ★ {p.rating.toFixed(1)} · {p.zone}
                </p>
              </div>
              <LevelBadge level={p.level} />
            </Link>
          ))}
          {visible.length === 0 && (
            <p className="font-body text-body-md text-concrete py-8 text-center">
              Todavía no hay pintores en esta zona.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
