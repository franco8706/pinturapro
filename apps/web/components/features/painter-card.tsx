import Link from "next/link";
import type { Painter } from "@/lib/data";
import { LevelBadge } from "@/components/features/level-badge";

export function PainterCard({ painter, index = 0 }: { painter: Painter; index?: number }) {
  return (
    <Link
      href={`/pintor/${painter.id}`}
      className="group block border border-concrete/15 bg-bone hover:border-ink transition-colors duration-300"
      style={{ transitionDelay: `${index * 0.04}s` }}
    >
      <div className="relative aspect-[4/3] overflow-hidden bg-mist">
        {/* INTEGRACIÓN: foto real del pintor desde Supabase Storage */}
        <div className="absolute inset-0 flex items-center justify-center bg-concrete/10">
          <span className="font-mono text-mono-sm text-concrete">{painter.image}</span>
        </div>
        <div className="absolute top-3 left-3">
          <LevelBadge level={painter.level} />
        </div>
      </div>
      <div className="p-5">
        <div className="flex items-center justify-between gap-3">
          <h3 className="font-display text-display-md leading-tight">{painter.name}</h3>
          <div className="flex items-center gap-1 font-mono text-mono-sm text-ink">
            <span aria-hidden>★</span>
            {painter.rating.toFixed(1)}
          </div>
        </div>
        <p className="font-body text-body-sm text-concrete mt-1">
          {painter.zone} · {painter.reviews} reseñas
        </p>
        <div className="flex flex-wrap gap-2 mt-4">
          {painter.specialty.map((s) => (
            <span key={s} className="px-2.5 py-1 bg-mist font-mono text-mono-sm text-concrete">
              {s}
            </span>
          ))}
        </div>
      </div>
    </Link>
  );
}
