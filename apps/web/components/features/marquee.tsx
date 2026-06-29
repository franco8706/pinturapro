"use client";

import { type ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Cinta horizontal infinita (marquee). Duplica el contenido para un loop sin cortes.
 * Pausa al pasar el mouse. Respeta prefers-reduced-motion (se detiene).
 */
export function Marquee({
  children,
  speed = 32,
  className,
  reverse = false,
}: {
  children: ReactNode;
  speed?: number;
  className?: string;
  reverse?: boolean;
}) {
  return (
    <div className={cn("group relative overflow-hidden", className)}>
      <div
        className="flex w-max animate-marquee group-hover:[animation-play-state:paused]"
        style={{ animationDuration: `${speed}s`, animationDirection: reverse ? "reverse" : "normal" }}
      >
        <div className="flex shrink-0">{children}</div>
        <div className="flex shrink-0" aria-hidden>
          {children}
        </div>
      </div>
    </div>
  );
}
