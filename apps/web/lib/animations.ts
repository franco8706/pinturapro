/**
 * Tokens y presets de animación compartidos.
 * Las curvas espejan los design tokens definidos en tailwind.config.ts.
 */

export const EASE = {
  expoOut: [0.16, 1, 0.3, 1] as const,
  expoIn: [0.7, 0, 0.84, 0] as const,
};

export const EASE_CSS = {
  expoOut: "cubic-bezier(0.16, 1, 0.3, 1)",
  expoIn: "cubic-bezier(0.7, 0, 0.84, 0)",
};

export const DURATION = {
  fast: 0.3,
  base: 0.6,
  slow: 1.2,
};

/**
 * Variants estilo Framer/CSS para revelar elementos al entrar en viewport.
 * Se consumen con IntersectionObserver + clases utilitarias.
 */
export const revealVariants = {
  hidden: { opacity: 0, y: 24 },
  visible: { opacity: 1, y: 0 },
};

/**
 * Genera un `transition` CSS para una o varias propiedades con la curva expo-out.
 */
export function expoTransition(properties: string[], duration = DURATION.base, delay = 0): string {
  return properties
    .map((p) => `${p} ${duration}s ${EASE_CSS.expoOut} ${delay}s`)
    .join(", ");
}

/**
 * Calcula un delay escalonado para listas (stagger).
 */
export function stagger(index: number, step = 0.08, base = 0): number {
  return base + index * step;
}
