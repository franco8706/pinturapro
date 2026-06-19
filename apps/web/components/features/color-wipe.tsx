"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

interface ColorWipeProps {
  color?: string;
  children: ReactNode;
  className?: string;
}

/**
 * Sección con "color wipe": a medida que entra en viewport, un panel de color
 * barre el contenido de abajo hacia arriba. Sirve a la narrativa del hero.
 */
export function ColorWipe({ color = "#C41E3A", children, className }: ColorWipeProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;

    let raf = 0;
    const onScroll = () => {
      raf = requestAnimationFrame(() => {
        const rect = node.getBoundingClientRect();
        const vh = window.innerHeight;
        // 0 cuando el tope entra por abajo, 1 cuando llega al centro
        const p = 1 - (rect.top - vh * 0.2) / (vh * 0.8);
        setProgress(Math.max(0, Math.min(1, p)));
      });
    };

    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, []);

  return (
    <div ref={ref} className={className} style={{ position: "relative" }}>
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 origin-bottom"
        style={{
          backgroundColor: color,
          transform: `scaleY(${1 - progress})`,
          transition: "transform 0.1s linear",
          mixBlendMode: "multiply",
        }}
      />
      <div className="relative">{children}</div>
    </div>
  );
}
