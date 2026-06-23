"use client";

import { useState } from "react";
import { PainterCard } from "@/components/features/painter-card";
import { Reveal, EmptyState } from "@/components/features/states";
import { MagneticButton } from "@/components/features/magnetic-button";
import type { Painter } from "@/lib/data";
import { cn } from "@/lib/utils";

const zones = ["Todas", "CABA", "Zona Norte", "Zona Oeste", "Zona Sur"];
const levels = ["Todos", "Master", "Gold", "Silver"];

export function PintoresClient({ painters }: { painters: Painter[] }) {
  const [zone, setZone] = useState("Todas");
  const [level, setLevel] = useState("Todos");

  const filtered = painters.filter(
    (p) =>
      (zone === "Todas" || p.zone.toLowerCase().includes(zone.toLowerCase())) &&
      (level === "Todos" || p.level === level),
  );

  return (
    <>
      <div className="flex flex-col sm:flex-row flex-wrap gap-8 mb-12 pb-8 border-b border-concrete/15">
        <FilterGroup label="Zona" options={zones} value={zone} onChange={setZone} />
        <FilterGroup label="Nivel" options={levels} value={level} onChange={setLevel} />
        <div className="sm:ml-auto self-end">
          <MagneticButton href="/mapa" variant="ghost">
            Ver en mapa
          </MagneticButton>
        </div>
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          title="Sin resultados"
          description="No encontramos pintores con esos filtros. Probá ampliando la zona o el nivel."
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {filtered.map((painter, i) => (
            <Reveal key={painter.id} delay={i * 0.06}>
              <PainterCard painter={painter} index={i} />
            </Reveal>
          ))}
        </div>
      )}
    </>
  );
}

function FilterGroup({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: string[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex flex-col gap-2">
      <span className="font-mono text-mono-sm text-concrete uppercase tracking-widest">{label}</span>
      <div className="flex flex-wrap gap-2">
        {options.map((opt) => (
          <button
            key={opt}
            onClick={() => onChange(opt)}
            className={cn(
              "px-4 py-2 font-body text-body-sm border transition-colors duration-300",
              value === opt ? "border-ink bg-ink text-bone" : "border-concrete/30 text-ink hover:border-ink",
            )}
          >
            {opt}
          </button>
        ))}
      </div>
    </div>
  );
}
