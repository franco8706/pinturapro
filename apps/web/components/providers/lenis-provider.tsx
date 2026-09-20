"use client";

import { useEffect, useRef } from "react";
import Lenis from "lenis";
import { usePrefersReducedMotion } from "@/hooks/use-media-query";

export function LenisProvider({ children }: { children: React.ReactNode }) {
  const lenisRef = useRef<Lenis | null>(null);
  /**
   * Con "reducir movimiento" activado, el scroll vuelve al del navegador.
   *
   * Lenis reemplaza el scroll nativo por uno con inercia: la rueda del mouse dispara una
   * curva de aceleración y frenado que dura más de medio segundo. Medido con la preferencia
   * puesta, la curva era idéntica a la de siempre. Justamente el desplazamiento suave es de
   * lo que más se queja quien tiene sensibilidad al movimiento, porque la pantalla sigue
   * moviéndose después de que uno dejó de pedirlo.
   */
  const sinMovimiento = usePrefersReducedMotion();

  useEffect(() => {
    if (sinMovimiento) return;
    const lenis = new Lenis({
      duration: 1.2,
      easing: (t: number) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      touchMultiplier: 2,
    });

    lenisRef.current = lenis;

    // El handle se guarda para poder cancelarlo: si no, el bucle sigue corriendo a ~60fps
    // sobre una instancia ya destruida, y con StrictMode se acumula uno por montaje.
    let frame = 0;
    function raf(time: number) {
      lenis.raf(time);
      frame = requestAnimationFrame(raf);
    }
    frame = requestAnimationFrame(raf);

    return () => {
      cancelAnimationFrame(frame);
      lenis.destroy();
      lenisRef.current = null;
    };
  }, [sinMovimiento]);

  return <>{children}</>;
}
