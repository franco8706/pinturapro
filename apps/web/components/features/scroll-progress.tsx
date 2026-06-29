"use client";

import { useEffect, useState } from "react";

/**
 * Barra de progreso de lectura: se llena a medida que el usuario baja por la página.
 * Fija arriba de todo (por encima del navbar). Respeta prefers-reduced-motion vía CSS global.
 */
export function ScrollProgress() {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    let raf = 0;
    const update = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const el = document.documentElement;
        const max = el.scrollHeight - el.clientHeight;
        setProgress(max > 0 ? Math.min(100, (el.scrollTop / max) * 100) : 0);
      });
    };
    update();
    window.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    return () => {
      window.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
      cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <div className="fixed top-0 inset-x-0 z-[60] h-0.5 bg-transparent pointer-events-none">
      <div
        className="h-full bg-ink origin-left transition-[width] duration-150 ease-out"
        style={{ width: `${progress}%` }}
      />
    </div>
  );
}
