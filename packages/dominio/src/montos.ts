/**
 * Plata: convertir lo que una persona escribe en un monto en pesos.
 *
 * Esta función existe en un paquete compartido porque la web y la app móvil tenían cada una
 * su copia, y la del móvil era la versión con el error que la web ya había corregido. Medido
 * leyendo el código: en la app, "150.000,50" se convertía en $15.000.050 — cien veces más—
 * sin ningún aviso, y eso viaja a una cotización que un cliente después acepta.
 *
 * Las dos formas en que rompía `parseInt(v.replace(/[^\d]/g, ""))`:
 *
 *  · `"-99999"` → 99999. El signo desaparecía y la cotización salía POSITIVA. El pintor creía
 *    haber mandado una cosa y al cliente le llegaba otra. Peor que rechazarla.
 *  · `"320.000,50"` → 32000050. Escribir el monto como se escribe en Argentina multiplicaba
 *    por cien.
 */

/** Más de mil millones en un trabajo de pintura es un error de tipeo, y `amount` es int4 en la base. */
export const MONTO_MAXIMO = 1_000_000_000;

export function montoDesdeTexto(v: unknown): number | null {
  const crudo = String(v ?? "").trim();
  if (!crudo) return null;
  if (/^-/.test(crudo)) return null; // negativo explícito: se rechaza, no se "arregla" solo

  const soloNumero = crudo.replace(/[^\d.,]/g, ""); // saca "$", espacios y letras
  const sinMiles = soloNumero.replace(/\./g, ""); // el punto es separador de miles
  const entero = sinMiles.split(",")[0]; // la coma abre los centavos: se descartan
  if (!entero) return null;

  const n = parseInt(entero, 10);
  if (!Number.isFinite(n) || n <= 0 || n > MONTO_MAXIMO) return null;
  return n;
}

/** Comisión de la plataforma sobre el monto del trabajo. */
export const COMISION = 0.1;

export function comisionDe(monto: number): number {
  return Math.round(monto * COMISION);
}
