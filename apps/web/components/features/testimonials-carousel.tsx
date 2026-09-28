"use client";

import { usePrefersReducedMotion } from "@/hooks/use-media-query";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import type { Testimonial } from "@/lib/queries";

/** Carrusel de testimonios reales (reseñas). Auto-avanza; pausa al pasar el mouse. */
export function TestimonialsCarousel({ items }: { items: Testimonial[] }) {
  const [i, setI] = useState(0);
  const [paused, setPaused] = useState(false);
  const n = items.length;
  // "Reducir movimiento" no es una preferencia estética: quien la activa suele hacerlo porque
  // el movimiento automático le da mareo o le dispara migraña. Medido con la preferencia
  // puesta, este carrusel seguía pasando solo cada 6 segundos. Con ella activada se queda
  // quieto y se mueve sólo cuando la persona lo pide con las flechas.
  const sinMovimiento = usePrefersReducedMotion();
  const go = useCallback((d: number) => setI((p) => (p + d + n) % n), [n]);

  useEffect(() => {
    if (paused || sinMovimiento || n <= 1) return;
    const t = setInterval(() => setI((p) => (p + 1) % n), 6000);
    return () => clearInterval(t);
  }, [paused, sinMovimiento, n]);

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

      {/* `flex-wrap` en la fila y en los puntos: sin eso, con el texto del sistema agrandado
          (la gente con poca visión lo usa así) los puntos no entraban, la portada quedaba más
          ancha que la pantalla, y el encabezado fijo se estiraba con ella hasta dejar el botón
          del menú FUERA de la pantalla, sin forma de alcanzarlo. Lo midió el agente
          `accesibilidad` con la fuente al 200 %. */}
      {n > 1 && (
        <div className="mt-10 flex flex-wrap items-center gap-4">
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
          <div className="flex flex-wrap gap-2 ml-2">
            {items.map((_, idx) => (
              <button
                key={idx}
                type="button"
                aria-label={`Testimonio ${idx + 1}`}
                onClick={() => setI(idx)}
                /* El punto mide 6 px de alto: imposible de acertar con el dedo. Se agranda la
                   ZONA TOCABLE con padding —44 px, que es lo que recomiendan las guías de
                   iOS y Android— sin agrandar el punto, que es puro adorno. */
                className="flex h-11 w-6 items-center justify-center"
              >
                <span
                  aria-hidden="true"
                  className="block h-1.5 transition-all"
                  style={{ width: idx === i ? 24 : 8, backgroundColor: idx === i ? "#141414" : "#C9C7C1" }}
                />
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
