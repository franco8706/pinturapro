/**
 * Leer el extracto del banco (CSV) para confirmar las transferencias de la suscripción.
 *
 * Por qué existe (6/10/2026): uno de los tres medios de pago es la transferencia a la cuenta del
 * negocio, con el código del pintor ("PP-0037") en el concepto. Es el medio que no depende de
 * ninguna empresa, pero no avisa solo: el dueño exporta el extracto desde el home banking, lo
 * carga en /admin → Cobro, y cada línea con un código y un monto que alcanza confirma esa
 * transferencia.
 *
 * Cada banco exporta distinto (separador `;` o `,`, columnas con otros nombres, montos con coma
 * decimal, débitos negativos o en otra columna). Esto no adivina de más: busca la fila de
 * encabezados, la columna del monto que ENTRA (crédito / importe / monto) y la de la fecha, y
 * todo el resto de la línea es el texto donde se busca el código. Una línea que no se entiende se
 * saltea; nunca se inventa un monto.
 */
import { codigoEnTexto } from "./suscripcion";

export interface LineaDeExtracto {
  /** El texto original de la línea: es lo que queda guardado en el libro como prueba. */
  linea: string;
  fecha: string | null;
  /** Lo que entró a la cuenta, en pesos. Sólo créditos (> 0). */
  monto: number;
  /** El código del pintor encontrado en la línea ("PP-0037"), o null. */
  codigo: string | null;
}

/** "7.700,00" → 7700; "7700.50" → 7700.5; "$ 1.234" → 1234; "-500" → -500. null si no es un número. */
export function montoDeExtracto(v: unknown): number | null {
  if (typeof v !== "string" && typeof v !== "number") return null;
  let s = String(v).trim().replace(/[$\s]/g, "").replace(/^ARS/i, "");
  if (!s) return null;
  const negativo = /^-|^\(.*\)$/.test(s);
  s = s.replace(/^[-+(]|\)$/g, "");
  if (/^\d{1,3}(\.\d{3})+(,\d+)?$/.test(s) || /^\d+,\d+$/.test(s)) s = s.replace(/\./g, "").replace(",", ".");
  else if (/^\d{1,3}(,\d{3})+(\.\d+)?$/.test(s)) s = s.replace(/,/g, "");
  if (!/^\d+(\.\d+)?$/.test(s)) return null;
  const n = Number(s);
  return Number.isFinite(n) ? (negativo ? -n : n) : null;
}

/** Parte una línea de CSV respetando las comillas. */
function campos(linea: string, sep: string): string[] {
  const out: string[] = [];
  let actual = "";
  let comillas = false;
  for (let i = 0; i < linea.length; i++) {
    const c = linea[i];
    if (c === '"') {
      if (comillas && linea[i + 1] === '"') {
        actual += '"';
        i++;
      } else comillas = !comillas;
    } else if (c === sep && !comillas) {
      out.push(actual);
      actual = "";
    } else actual += c;
  }
  out.push(actual);
  return out.map((x) => x.trim());
}

const ES_MONTO = /cr[eé]dito|importe|monto|haber|ingreso/i;
const ES_DEBITO = /d[eé]bito|debe|egreso/i;
const ES_FECHA = /fecha|date/i;

/** Las líneas del extracto con plata que ENTRÓ, cada una con su código si lo trae. */
export function leerExtracto(csv: unknown): LineaDeExtracto[] {
  if (typeof csv !== "string") return [];
  const lineas = csv.replace(/^\uFEFF/, "").split(/\r?\n/).filter((l) => l.trim());
  if (!lineas.length) return [];
  const sep = (lineas.slice(0, 5).join("\n").match(/;/g)?.length ?? 0) >= (lineas.slice(0, 5).join("\n").match(/,/g)?.length ?? 0) ? ";" : ",";

  // El encabezado: la primera línea (de las 10 primeras) que nombra un monto.
  let iEncabezado = -1;
  let cols: string[] = [];
  for (let i = 0; i < Math.min(10, lineas.length); i++) {
    const c = campos(lineas[i], sep);
    if (c.some((x) => ES_MONTO.test(x))) {
      iEncabezado = i;
      cols = c;
      break;
    }
  }
  if (iEncabezado < 0) return [];
  // Si hay una columna de crédito explícita, ésa; si no, la de importe/monto (los débitos vienen negativos).
  const iCredito = cols.findIndex((x) => /cr[eé]dito|haber|ingreso/i.test(x));
  const iMonto = iCredito >= 0 ? iCredito : cols.findIndex((x) => ES_MONTO.test(x) && !ES_DEBITO.test(x));
  const iFecha = cols.findIndex((x) => ES_FECHA.test(x));
  if (iMonto < 0) return [];

  const salida: LineaDeExtracto[] = [];
  for (const linea of lineas.slice(iEncabezado + 1)) {
    const c = campos(linea, sep);
    const monto = montoDeExtracto(c[iMonto] ?? "");
    if (monto === null || monto <= 0) continue;
    const texto = c.filter((_, i) => i !== iMonto).join(" ");
    salida.push({ linea: linea.trim(), fecha: iFecha >= 0 ? c[iFecha] || null : null, monto, codigo: codigoEnTexto(texto) });
  }
  return salida;
}
