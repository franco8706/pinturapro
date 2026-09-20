"use client";

import { usePrefersReducedMotion } from "@/hooks/use-media-query";

import { useEffect, useState, useCallback } from "react";
import Image from "next/image";
import Link from "next/link";
import type { NewsItem } from "@/lib/queries";

const ACCENTS = ["#C41E3A", "#1E3A8A", "#2D5A3D", "#B45309", "#0F766E"];

/** Carrusel de noticias: auto-avanza, con flechas, dots y pausa al pasar el mouse. */
export function NewsCarousel({ items }: { items: NewsItem[] }) {
  const [i, setI] = useState(0);
  const [paused, setPaused] = useState(false);
  const n = items.length;

  // "Reducir movimiento" no es una preferencia estética: quien la activa suele hacerlo porque
  // el movimiento automático le da mareo o le dispara migraña. Medido con la preferencia
  // puesta, este carrusel seguía pasando solo cada 5 segundos. Con ella activada se queda
  // quieto y se mueve sólo cuando la persona lo pide con las flechas.
  const sinMovimiento = usePrefersReducedMotion();
  const go = useCallback((d: number) => setI((p) => (p + d + n) % n), [n]);

  useEffect(() => {
    if (paused || sinMovimiento || n <= 1) return;
    const t = setInterval(() => setI((p) => (p + 1) % n), 5000);
    return () => clearInterval(t);
  }, [paused, sinMovimiento, n]);

  if (n === 0) return null;

  return (
    <div
      className="relative"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      <div className="overflow-hidden">
        <div className="flex transition-transform duration-700 ease-expo-out" style={{ transform: `translateX(-${i * 100}%)` }}>
          {items.map((item, idx) => {
            const accent = ACCENTS[idx % ACCENTS.length];
            const card = (
              <div className="grid grid-cols-1 md:grid-cols-2 min-h-[20rem] border border-concrete/15">
                <div className="relative hidden md:block" style={{ backgroundColor: accent }}>
                  {item.coverUrl?.startsWith("http") && (
                    <Image
                      src={item.coverUrl}
                      alt=""
                      fill
                      /* Media pantalla desde md (656px con el contenedor tope), y 1px abajo
                         de md porque ahí la columna está oculta: no tiene sentido bajar una
                         foto que nadie ve. Todas en lazy: el carrusel está al final de la
                         home y el color de acento del fondo hace de placeholder mientras
                         entra la diapositiva. */
                      sizes="(max-width: 767px) 1px, (max-width: 1535px) 50vw, 656px"
                      className="object-cover"
                    />
                  )}
                </div>
                <div className="p-8 sm:p-12 flex flex-col justify-center bg-bone">
                  <span className="font-mono text-mono-sm uppercase tracking-widest text-concrete">Novedades · {item.date}</span>
                  <h3 className="font-display text-display-md mt-3 mb-3 leading-tight">{item.title}</h3>
                  {item.excerpt && <p className="font-body text-body-md text-concrete">{item.excerpt}</p>}
                  {item.url && (
                    <span className="mt-5 font-body text-body-sm text-ink underline underline-offset-4">Leer más →</span>
                  )}
                </div>
              </div>
            );
            return (
              <div key={item.id} className="w-full shrink-0">
                {item.url ? (
                  <Link href={item.url} className="block group">
                    {card}
                  </Link>
                ) : (
                  card
                )}
              </div>
            );
          })}
        </div>
      </div>

      {n > 1 && (
        <>
          <button
            type="button"
            aria-label="Anterior"
            onClick={() => go(-1)}
            className="absolute left-3 top-1/2 -translate-y-1/2 w-10 h-10 bg-bone border border-concrete/20 flex items-center justify-center hover:bg-ink hover:text-bone transition-colors"
          >
            ←
          </button>
          <button
            type="button"
            aria-label="Siguiente"
            onClick={() => go(1)}
            className="absolute right-3 top-1/2 -translate-y-1/2 w-10 h-10 bg-bone border border-concrete/20 flex items-center justify-center hover:bg-ink hover:text-bone transition-colors"
          >
            →
          </button>
          <div className="mt-1 flex justify-center gap-1">
            {items.map((_, idx) => (
              <button
                key={idx}
                type="button"
                aria-label={`Ir a la noticia ${idx + 1}`}
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
        </>
      )}
    </div>
  );
}
