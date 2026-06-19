"use client";

import { useEffect, useRef, useState } from "react";

export interface MousePosition {
  x: number;
  y: number;
}

/**
 * Posición global del mouse (coordenadas de viewport).
 */
export function useMousePosition(): MousePosition {
  const [position, setPosition] = useState<MousePosition>({ x: 0, y: 0 });

  useEffect(() => {
    const handler = (event: MouseEvent) => {
      setPosition({ x: event.clientX, y: event.clientY });
    };
    window.addEventListener("mousemove", handler);
    return () => window.removeEventListener("mousemove", handler);
  }, []);

  return position;
}

/**
 * Posición del mouse relativa a un elemento, normalizada a [-0.5, 0.5].
 * Útil para efectos magnéticos / parallax.
 */
export function useRelativeMousePosition<T extends HTMLElement>() {
  const ref = useRef<T | null>(null);
  const [position, setPosition] = useState<MousePosition>({ x: 0, y: 0 });

  useEffect(() => {
    const node = ref.current;
    if (!node) return;

    const handler = (event: MouseEvent) => {
      const rect = node.getBoundingClientRect();
      setPosition({
        x: (event.clientX - rect.left) / rect.width - 0.5,
        y: (event.clientY - rect.top) / rect.height - 0.5,
      });
    };

    node.addEventListener("mousemove", handler);
    return () => node.removeEventListener("mousemove", handler);
  }, []);

  return { ref, position };
}
