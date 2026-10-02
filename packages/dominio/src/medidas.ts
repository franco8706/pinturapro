/**
 * Medidas y cantidades que escribe una persona: la superficie de un pedido, los años de
 * experiencia de un pintor, y cuánto puede publicar o cotizar una cuenta por hora.
 *
 * Por qué existe: el formulario de /publicar validaba `Number(superficie) > 0`, y
 * `Number("Infinity")`, `Number("1e9")` y `Number("99999999999")` son todos mayores que cero.
 * El servidor no miraba nada: la superficie viajaba pegada adentro de un texto. Un agente
 * publicó un pedido de "Superficie: Infinity m²" y quedó en el tablero público, a la vista de
 * todos (formularios-hostiles, 2/10/2026).
 */

/** Más que esto no es una obra, es un error de tipeo: 100.000 m² son diez manzanas. */
export const SUPERFICIE_MAXIMA = 100_000;

/** La superficie en m², o `null` si no es un número razonable. Acepta coma o punto decimal. */
export function superficieDesdeTexto(v: unknown): number | null {
  if (typeof v !== "string" && typeof v !== "number") return null;
  const t = String(v).trim().replace(",", ".");
  // Sólo dígitos y, como mucho, dos decimales: deja afuera "Infinity", "1e9", los negativos
  // y cualquier cosa que `Number()` aceptaría con gusto.
  if (!/^\d{1,6}(\.\d{1,2})?$/.test(t)) return null;
  const n = Number(t);
  return n > 0 && n <= SUPERFICIE_MAXIMA ? n : null;
}

/** Años de experiencia: un entero entre 1 y 70. */
export function aniosDesdeTexto(v: unknown): number | null {
  if (typeof v !== "string" && typeof v !== "number") return null;
  const t = String(v).trim();
  if (!/^\d{1,2}$/.test(t)) return null;
  const n = Number(t);
  return n >= 1 && n <= 70 ? n : null;
}

/**
 * Cuánto puede publicar o cotizar una misma cuenta en una hora.
 *
 * Los formularios de contacto ya tenían un tope (5 por hora); publicar un pedido y cotizar,
 * ninguno: una cuenta publicó 8 pedidos seguidos y otra cotizó los 8 sin que nada lo frenara.
 * Un cliente real publica uno o dos pedidos; un pintor con mucho trabajo cotiza una decena.
 * Los números son generosos a propósito: están para frenar a un programa, no a una persona.
 */
export const TOPE_POR_HORA = { pedidos: 10, cotizaciones: 30 } as const;
