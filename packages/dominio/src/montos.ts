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

/**
 * Convierte lo que se escribió en un monto, o devuelve `null`.
 *
 * **La regla de esta función es que ante la duda NO adivina.** Antes adivinaba, y adivinar un
 * monto es peor que rechazarlo: un rechazo se ve en pantalla y la persona lo corrige; un
 * número mal adivinado viaja a una cotización que el cliente acepta. Medido sobre la versión
 * anterior:
 *
 * | Se escribió    | Salía   | Quería decir | Error       |
 * |----------------|---------|--------------|-------------|
 * | `1,500,000`    | 1       | 1.500.000    | ×1.500.000  |
 * | `150,000.50`   | 150     | 150.000,50   | ×1.000      |
 * | `1500.50`      | 150.050 | 1.500,50     | ×100        |
 * | `150.00`       | 15.000  | 150          | ×100        |
 * | `1.50E+06`     | 15.006  | 1.500.000    | ×100        |
 * | `abc150000`    | 150.000 | (un error)   | lo aceptaba |
 *
 * El primero es el peor de todos: un pintor que pega un monto copiado de una planilla en
 * inglés para cobrar un millón y medio manda una cotización **por un peso**, sin ningún
 * aviso. Y `1.50E+06` es el más traicionero, porque $15.006 es un número creíble para un
 * trabajo de pintura: nadie sospecha.
 *
 * Lo que se acepta es un monto escrito como se escribe acá: `150000`, `150.000`, `$150.000`,
 * `150 000`, `150.000,50`. Todo lo demás se rechaza y se pide de nuevo.
 */
export function montoDesdeTexto(v: unknown): number | null {
  const crudo = String(v ?? "").trim();
  if (!crudo) return null;
  if (/^-/.test(crudo)) return null; // negativo explícito: se rechaza, no se "arregla" solo

  // 1. Sólo lo que puede aparecer en un monto de verdad. Antes se borraba todo lo demás con
  //    un `replace`, así que "abc150000" pasaba como 150.000 y "1.5e6" se convertía en 156
  //    tratando la "e" como basura en el medio de dos dígitos.
  if (/[^\d.,\s$]/.test(crudo)) return null;

  const limpio = crudo.replace(/[\s$]/g, "");
  if (!limpio) return null;

  // 2. Una sola coma, y decimal. Dos comas es notación inglesa de miles ("1,500,000"), y una
  //    coma seguida de tres dígitos ("1,500") también lo es casi seguro: acá los centavos se
  //    escriben con uno o dos.
  const comas = (limpio.match(/,/g) ?? []).length;
  if (comas > 1) return null;
  //    Coma ANTES de punto es formato inglés: "150,000.50".
  if (comas === 1 && limpio.indexOf(",") < limpio.lastIndexOf(".")) return null;

  const [entero, decimales = ""] = limpio.split(",");
  if (comas === 1 && !/^\d{1,2}$/.test(decimales)) return null;

  // 3. Los puntos tienen que separar miles de verdad. Un grupo que no es de tres dígitos
  //    significa que ese punto era un decimal inglés ("1500.50", "150.00") o un tipeo
  //    ("1.50.000"), y en los tres casos el número que salía estaba cien veces mal.
  const grupos = entero.split(".");
  if (!/^\d+$/.test(grupos[0] ?? "")) return null;
  if (grupos.length > 1 && !grupos.slice(1).every((g) => /^\d{3}$/.test(g))) return null;

  const n = parseInt(grupos.join(""), 10);
  if (!Number.isFinite(n) || n <= 0 || n > MONTO_MAXIMO) return null;
  return n;
}

/** Comisión de la plataforma sobre el monto del trabajo. */
export const COMISION = 0.1;

export function comisionDe(monto: number): number {
  return Math.round(monto * COMISION);
}
