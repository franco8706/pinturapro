"use client";

import { useCallback, useRef, useState } from "react";

interface BeforeAfterSliderProps {
  beforeImage: string;
  afterImage: string;
  accentColor?: string;
}

export function BeforeAfterSlider({ beforeImage, afterImage, accentColor = "#141414" }: BeforeAfterSliderProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState(50);
  const dragging = useRef(false);

  const updateFromClientX = useCallback((clientX: number) => {
    const node = containerRef.current;
    if (!node) return;
    const rect = node.getBoundingClientRect();
    const pct = ((clientX - rect.left) / rect.width) * 100;
    setPosition(Math.max(0, Math.min(100, pct)));
  }, []);

  const onPointerDown = (e: React.PointerEvent) => {
    dragging.current = true;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    updateFromClientX(e.clientX);
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (dragging.current) updateFromClientX(e.clientX);
  };

  const onPointerUp = () => {
    dragging.current = false;
  };

  return (
    <div
      ref={containerRef}
      className="relative aspect-[16/9] overflow-hidden bg-mist select-none touch-none cursor-ew-resize"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      role="slider"
      aria-label="Comparar antes y después"
      aria-valuenow={Math.round(position)}
      aria-valuemin={0}
      aria-valuemax={100}
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "ArrowLeft") setPosition((p) => Math.max(0, p - 4));
        if (e.key === "ArrowRight") setPosition((p) => Math.min(100, p + 4));
      }}
    >
      {/* Después (fondo completo) */}
      <div className="absolute inset-0 flex items-center justify-center bg-concrete/5">
        {afterImage.startsWith("http") ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={afterImage} alt="Después" className="absolute inset-0 w-full h-full object-cover" />
        ) : (
          <span className="font-mono text-mono-sm text-concrete">{afterImage}</span>
        )}
        <span className="absolute bottom-4 right-4 font-mono text-mono-sm text-ink bg-bone/80 px-2 py-1">Después</span>
      </div>

      {/* Antes (recortado por clip) */}
      <div
        className="absolute inset-0 flex items-center justify-center bg-concrete/15"
        style={{ clipPath: `inset(0 ${100 - position}% 0 0)` }}
      >
        {beforeImage.startsWith("http") ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={beforeImage} alt="Antes" className="absolute inset-0 w-full h-full object-cover grayscale" />
        ) : (
          <span className="font-mono text-mono-sm text-concrete">{beforeImage}</span>
        )}
        <span className="absolute bottom-4 left-4 font-mono text-mono-sm text-ink bg-bone/80 px-2 py-1">Antes</span>
      </div>

      {/* Handle */}
      <div className="absolute inset-y-0" style={{ left: `${position}%`, transform: "translateX(-50%)" }}>
        <div className="w-px h-full" style={{ backgroundColor: accentColor }} />
        <div
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-bone shadow-lg flex items-center justify-center font-mono text-mono-sm"
          style={{ color: accentColor }}
        >
          ↔
        </div>
      </div>
    </div>
  );
}
