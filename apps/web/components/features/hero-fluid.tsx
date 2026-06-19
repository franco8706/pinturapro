"use client";

import { useEffect, useRef } from "react";
import { usePrefersReducedMotion } from "@/hooks/use-media-query";

interface HeroFluidProps {
  colors?: string[];
  className?: string;
}

const DEFAULT_COLORS = ["#C41E3A", "#1E3A8A", "#2D5A3D", "#DAA520"];

/**
 * Fondo fluido animado sobre canvas 2D: blobs de color que se desplazan y
 * reaccionan suavemente al mouse. Liviano y sin dependencias 3D.
 *
 * NOTA: para una versión con shaders WebGL (React Three Fiber) ver CLAUDE.md;
 * esta implementación canvas garantiza performance y reduced-motion sin GPU.
 */
export function HeroFluid({ colors = DEFAULT_COLORS, className }: HeroFluidProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const reduceMotion = usePrefersReducedMotion();

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let raf = 0;
    let width = 0;
    let height = 0;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const mouse = { x: 0.5, y: 0.5, tx: 0.5, ty: 0.5 };

    const blobs = colors.map((color, i) => ({
      color,
      baseX: (i + 0.5) / colors.length,
      baseY: 0.5,
      phase: i * 1.7,
      radius: 0.45,
    }));

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      width = rect.width;
      height = rect.height;
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    const draw = (t: number) => {
      mouse.x += (mouse.tx - mouse.x) * 0.05;
      mouse.y += (mouse.ty - mouse.y) * 0.05;

      ctx.clearRect(0, 0, width, height);
      ctx.globalCompositeOperation = "lighter";

      const time = reduceMotion ? 0 : t * 0.00012;

      for (const blob of blobs) {
        const driftX = Math.sin(time + blob.phase) * 0.12;
        const driftY = Math.cos(time * 1.3 + blob.phase) * 0.12;
        const cx = (blob.baseX + driftX + (mouse.x - 0.5) * 0.15) * width;
        const cy = (blob.baseY + driftY + (mouse.y - 0.5) * 0.15) * height;
        const r = blob.radius * Math.min(width, height);

        const gradient = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
        gradient.addColorStop(0, hexToRgba(blob.color, 0.55));
        gradient.addColorStop(1, hexToRgba(blob.color, 0));
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.globalCompositeOperation = "source-over";
      if (!reduceMotion) {
        raf = requestAnimationFrame(draw);
      }
    };

    const onMove = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      mouse.tx = (e.clientX - rect.left) / rect.width;
      mouse.ty = (e.clientY - rect.top) / rect.height;
    };

    resize();
    window.addEventListener("resize", resize);
    window.addEventListener("mousemove", onMove);
    raf = requestAnimationFrame(draw);
    if (reduceMotion) draw(0);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      window.removeEventListener("mousemove", onMove);
    };
  }, [colors, reduceMotion]);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden
      className={className}
      style={{ width: "100%", height: "100%", display: "block", filter: "blur(40px)" }}
    />
  );
}

function hexToRgba(hex: string, alpha: number): string {
  const clean = hex.replace("#", "");
  const r = parseInt(clean.substring(0, 2), 16);
  const g = parseInt(clean.substring(2, 4), 16);
  const b = parseInt(clean.substring(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
