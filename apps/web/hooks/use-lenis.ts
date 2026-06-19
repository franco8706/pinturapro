"use client";

import { useCallback } from "react";

/**
 * Helpers de scroll programático compatibles con Lenis.
 * Lenis ya intercepta `window.scrollTo`, así que estos helpers funcionan
 * tanto con el smooth scroll activo como sin él (prefers-reduced-motion).
 */
export function useLenis() {
  const scrollTo = useCallback((target: string | number, offset = 0) => {
    if (typeof window === "undefined") return;

    if (typeof target === "number") {
      window.scrollTo({ top: target + offset, behavior: "smooth" });
      return;
    }

    const el = document.querySelector(target);
    if (el) {
      const top = el.getBoundingClientRect().top + window.scrollY + offset;
      window.scrollTo({ top, behavior: "smooth" });
    }
  }, []);

  const scrollToTop = useCallback(() => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, []);

  return { scrollTo, scrollToTop };
}
