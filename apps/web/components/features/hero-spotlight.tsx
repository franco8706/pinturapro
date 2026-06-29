"use client";

import { useEffect, useRef } from "react";

/**
 * Halo sutil que sigue al cursor dentro del hero. Detrás del texto, sobre el fondo fluido.
 * Respeta prefers-reduced-motion (no se activa).
 */
export function HeroSpotlight() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const onMove = (e: MouseEvent) => {
      const rect = el.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const inside = x >= 0 && y >= 0 && x <= rect.width && y <= rect.height;
      el.style.setProperty("--x", `${x}px`);
      el.style.setProperty("--y", `${y}px`);
      el.style.opacity = inside ? "1" : "0";
    };
    window.addEventListener("mousemove", onMove, { passive: true });
    return () => window.removeEventListener("mousemove", onMove);
  }, []);

  return (
    <div
      ref={ref}
      aria-hidden
      className="pointer-events-none absolute inset-0 -z-10 opacity-0 transition-opacity duration-500"
      style={{
        background:
          "radial-gradient(420px circle at var(--x, 50%) var(--y, 50%), rgba(20,20,20,0.08), transparent 70%)",
      }}
    />
  );
}
