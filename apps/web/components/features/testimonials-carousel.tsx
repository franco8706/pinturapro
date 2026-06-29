"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import type { Testimonial } from "@/lib/queries";

/** Carrusel de testimonios reales (reseñas). Auto-avanza; pausa al pasar el mouse. */
export function TestimonialsCarousel({ items }: { items: Testimonial[] }) {
  const [i, setI] = useState(0);
  const [paused, setPaused] = useState(false);
  const n = items.length;
  const go = useCallback((d: number) => setI((p) => (p + d + n) % n), [n]);

  useEffect(() => {
    if (paused || n <= 1) return;
    const t = setInterval(() => setI((p) => (p + 1) % n), 6000);
    return () => clearInterval(t);
  }, [paused, n]);

  if (n === 0) return null;

  return (
    <div onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)}>
      <div className="overflow-hidden">
        <div
          className="flex transition-transform duration-700 ease-expo-out"
          style={{ transform: `translateX(-${i * 100}%)` }}
        >
          {items.map((t) => (
            <figure key={t.id} className="w-full shrink-0 px-1">
              <div className="flex gap-0.5 mb-6 text-[#B45309]" aria-label={`${t.rating} de 5`}>
                {Array.from({ length: 5 }).map((_, s) => (
                  <span key={s} style={{ opacity: s < t.rating ? 1 : 0.25 }}>★</span>
                ))}
              </div>
              <blockquote className="font-display text-display-md leading-tight text-balance max-w-3xl">
                “{t.comment}”
              </blockquote>
              <figcaption className="mt-6 font-body text-body-md text-concrete">
                <span className="text-ink">{t.author}</span> · sobre{" "}
                <Link href={`/pintor/${t.painterId}`} className="text-ink underline underline-offset-2 hover:text-concrete">
                  {t.painter}
                </Link>
              </figcaption>
            </figure>
          ))}
        </div>
      </div>

      {n > 1 && (
        <div className="mt-10 flex items-center gap-4">
          <button
            type="button"
            aria-label="Anterior"
            onClick={() => go(-1)}
            className="w-10 h-10 border border-concrete/20 flex items-center justify-center hover:bg-ink hover:text-bone transition-colors"
          >
            ←
          </button>
          <button
            type="button"
            aria-label="Siguiente"
            onClick={() => go(1)}
            className="w-10 h-10 border border-concrete/20 flex items-center justify-center hover:bg-ink hover:text-bone transition-colors"
          >
            →
          </button>
          <div className="flex gap-2 ml-2">
            {items.map((_, idx) => (
              <button
                key={idx}
                type="button"
                aria-label={`Testimonio ${idx + 1}`}
                onClick={() => setI(idx)}
                className="h-1.5 transition-all"
                style={{ width: idx === i ? 24 : 8, backgroundColor: idx === i ? "#141414" : "#C9C7C1" }}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
