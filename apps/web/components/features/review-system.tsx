"use client";

import Link from "next/link";

import { cn } from "@/lib/utils";

export interface Review {
  id: string;
  author: string;
  rating: number;
  date: string;
  comment: string;
  project?: string;
}

function Stars({ value, size = "sm" }: { value: number; size?: "sm" | "lg" }) {
  const full = Math.round(value);
  return (
    <span className={cn("inline-flex", size === "lg" ? "text-body-lg" : "text-body-sm")} aria-label={`${value} de 5`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <span key={i} className={i <= full ? "text-ink" : "text-concrete/30"}>
          ★
        </span>
      ))}
    </span>
  );
}

interface ReviewSystemProps {
  reviews: Review[];
  average: number;
  total: number;
}

export function ReviewSystem({ reviews, average, total }: ReviewSystemProps) {

  const distribution = [5, 4, 3, 2, 1].map((star) => {
    const count = reviews.filter((r) => Math.round(r.rating) === star).length;
    return { star, count, pct: reviews.length ? (count / reviews.length) * 100 : 0 };
  });

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
      {/* Resumen */}
      <div className="lg:col-span-4">
        <div className="flex items-end gap-3">
          <span className="font-display text-display-xl leading-none">{average.toFixed(1)}</span>
          <div className="pb-2">
            <Stars value={average} size="lg" />
            <p className="font-body text-body-sm text-concrete mt-1">{total} reseñas</p>
          </div>
        </div>
        <div className="mt-8 space-y-2">
          {distribution.map((d) => (
            <div key={d.star} className="flex items-center gap-3">
              <span className="font-mono text-mono-sm text-concrete w-3">{d.star}</span>
              <div className="flex-1 h-1.5 bg-concrete/15">
                <div className="h-full bg-ink" style={{ width: `${d.pct}%` }} />
              </div>
              <span className="font-mono text-mono-sm text-concrete w-6 text-right">{d.count}</span>
            </div>
          ))}
        </div>
        {/* Las reseñas se dejan desde el panel del cliente, sobre un trabajo COMPLETADO:
            la RLS exige job_id con el trabajo terminado (migración 0006) y hay unicidad por
            (job_id, author_id). Desde el perfil público no hay forma de saber qué trabajo se
            está reseñando, así que acá sólo se enruta al lugar donde el flujo existe. */}
        <Link
          href="/cliente"
          className="mt-8 inline-block px-6 py-3 border border-ink font-body text-body-sm hover:bg-ink hover:text-bone transition-colors duration-300"
        >
          Calificá tus trabajos terminados →
        </Link>
      </div>

      {/* Lista + form */}
      <div className="lg:col-span-8 space-y-8">
        {reviews.map((review) => (
          <article key={review.id} className="pb-8 border-b border-concrete/15 last:border-0">
            <div className="flex items-center justify-between gap-4 mb-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-mist flex items-center justify-center font-display text-body-sm">
                  {review.author.charAt(0)}
                </div>
                <div>
                  <p className="font-body text-body-md text-ink">{review.author}</p>
                  <p className="font-mono text-mono-sm text-concrete">{review.date}</p>
                </div>
              </div>
              <Stars value={review.rating} />
            </div>
            <p className="font-body text-body-md text-concrete leading-relaxed">{review.comment}</p>
            {review.project && (
              <p className="font-mono text-mono-sm text-concrete/70 mt-2">Proyecto: {review.project}</p>
            )}
          </article>
        ))}
      </div>
    </div>
  );
}
