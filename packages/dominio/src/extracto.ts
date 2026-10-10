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
 * encabezados (una fecha y un importe), la columna del monto que ENTRA y la del saldo, y todo el
 * resto de la línea es el texto donde se busca el código. Nunca se inventa un monto.
 *
 * El concepto lo escribe el que transfiere, y termina adentro del CSV (abuso-marketplace y
 * dinero-y-comisiones, 8/10/2026). Con un `;` en el concepto, un banco que no lo escapa corría las
 * columnas y $1 se leía como $7.700; con 25 comas en una línea el separador se daba vuelta y no se
 * leía nada; con un salto de línea se podía meter una línea entera inventada. Por eso:
 *  · el separador sale del ENCABEZADO, no de contar caracteres;
 *  · una línea con otra cantidad de columnas que el encabezado no se lee;
 *  · si el extracto trae SALDO, cada movimiento tiene que cerrar con el saldo de al lado: una línea
 *    inventada no cierra sin saber el saldo de la cuenta del negocio. Sin saldo, nada se confirma
 *    solo (lo decide `procesarExtracto`: todo queda para revisar).
 */
import { codigosEnTexto } from "./suscripcion";

export interface LineaDeExtracto {
  /** El texto original de la línea: es lo que queda guardado en el libro como prueba. */
  linea: string;
  fecha: string | null;
  /** Lo que entró a la cuenta, en pesos. Sólo créditos (> 0). */
  monto: number;
  /** El código del pintor encontrado en la línea ("PP-0037"), o null. */
  codigo: string | null;
  /**
   * 1 la primera vez que aparece este mismo texto en el archivo, 2 la segunda… Dos transferencias
   * iguales el mismo día son dos pagos, no uno repetido; el mismo archivo cargado dos veces, sí.
   */
  ocurrencia: number;
  /** El saldo del extracto confirma este movimiento (true), no lo confirma (false), o no hay saldo (null). */
  saldoCierra: boolean | null;
  /** Por qué no se puede confirmar sola aunque el monto alcance, o null. */
  sospecha: string | null;
}

export interface ExtractoLeido {
  /** Las líneas con plata que ENTRÓ. */
  creditos: LineaDeExtracto[];
  /** Movimientos que no se pudieron leer (otra cantidad de columnas, un importe imposible). */
  ilegibles: number;
  /** Si el extracto trae saldo. Sin saldo no hay cómo comprobar una línea: nada se confirma solo. */
  conSaldo: boolean;
  /** Si se encontró el encabezado (una fecha y un importe). Si no, el archivo no se entendió. */
  entendido: boolean;
}

/** Más que esto no es una transferencia de un pintor: es un importe corrido de columna. */
const MONTO_IMPOSIBLE = 1_000_000_000;

/** "7.700,00" → 7700; "7700.50" → 7700.5; "$ 1.234" → 1234; "-500" → -500. null si no es un número. */
export function montoDeExtracto(v: unknown): number | null {
  if (typeof v !== "string" && typeof v !== "number") return null;
  let s = String(v).trim().replace(/[$\s]/g, "").replace(/^ARS/i, "");
  if (!s) return null;
  // Un paréntesis sin cerrar ("(7.547,00") no es un negativo: no es un número (se leía +7.547).
  const abre = s.startsWith("(");
  if (abre !== s.endsWith(")")) return null;
  const negativo = s.startsWith("-") || abre;
  s = s.replace(/^[-+]/, "").replace(/^\(|\)$/g, "");
  // Miles con punto ("7.547,00") o con coma ("7,547.00"). El primer grupo no empieza con 0:
  // "0.500" es medio peso, no quinientos.
  if (/^[1-9]\d{0,2}(\.\d{3})+(,\d+)?$/.test(s) || /^\d+,\d+$/.test(s)) s = s.replace(/\./g, "").replace(",", ".");
  else if (/^[1-9]\d{0,2}(,\d{3})+(\.\d+)?$/.test(s)) s = s.replace(/,/g, "");
  if (!/^\d+(\.\d+)?$/.test(s)) return null;
  const n = Number(s);
  return Number.isFinite(n) ? (negativo ? -n : n) : null;
}

/** "08/10/2026", "8-10-26" o "2026-10-08" (con hora o sin) → el comienzo de ese día en Argentina; null si no es una fecha. */
export function fechaDeExtracto(v: unknown): Date | null {
  if (typeof v !== "string") return null;
  const s = v.trim();
  let r = /^(\d{4})-(\d{1,2})-(\d{1,2})(?:[ T].*)?$/.exec(s);
  let anio: number, mes: number, dia: number;
  if (r) [anio, mes, dia] = [Number(r[1]), Number(r[2]), Number(r[3])];
  else {
    r = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4}|\d{2})(?:\s.*)?$/.exec(s);
    if (!r) return null;
    [dia, mes, anio] = [Number(r[1]), Number(r[2]), Number(r[3])];
    if (anio < 100) anio += 2000;
  }
  const local = new Date(Date.UTC(anio, mes - 1, dia));
  if (local.getUTCFullYear() !== anio || local.getUTCMonth() !== mes - 1 || local.getUTCDate() !== dia) return null; // 31/02
  return new Date(local.getTime() + 3 * 3_600_000); // 00:00 en Argentina (UTC−3)
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

// Las celdas del encabezado son rótulos: sin números ("Total créditos: 15.000" es un renglón del
// resumen, no el encabezado). `�`: la tilde de un archivo en Latin-1 leído como UTF-8.
const ROTULO = (x: string) => x.length <= 40 && !/\d/.test(x);
const esFecha = (x: string) => ROTULO(x) && /^(fecha|date)\b/i.test(x);
const esSaldo = (x: string) => ROTULO(x) && /^(saldo|balance)\b/i.test(x);
const esCredito = (x: string) => ROTULO(x) && !esSaldo(x) && !/\//.test(x) && /(^|\s)(cr[eé�]ditos?|haber|ingresos?|credits?)\b/i.test(x);
const esDebito = (x: string) => ROTULO(x) && !esSaldo(x) && !/\//.test(x) && /(^|\s)(d[eé�]bitos?|debe|egresos?|debits?)\b/i.test(x);
const esImporte = (x: string) => ROTULO(x) && /^(importes?|montos?|amount)\b/i.test(x) && !esCredito(x) && !esDebito(x);
/** "Tipo" o "Débito/Crédito": la columna que dice el signo de un importe que viene sin signo. */
const esTipo = (x: string) => ROTULO(x) && /^(tipo|movimiento|d[eé\uFFFD]bito\s*\/\s*cr[eé\uFFFD]dito|type)$/i.test(x);
const signoDeTipo = (v: string | undefined): 1 | -1 | null =>
  !v ? null : /^(d|db|deb|d[eé\uFFFD]bito|egreso|debit)\b/i.test(v.trim()) ? -1 : /^(c|cr|cred|cr[eé\uFFFD]dito|ingreso|credit)\b/i.test(v.trim()) ? 1 : null;

const SEPARADORES = [";", "\t", ","];

/** La fila de encabezados: la primera de las 15 primeras que, con algún separador, tiene una fecha y un importe. */
function encabezado(lineas: string[]): { i: number; sep: string; cols: string[] } | null {
  for (let i = 0; i < Math.min(15, lineas.length); i++) {
    for (const sep of SEPARADORES) {
      const cols = campos(lineas[i], sep);
      if (cols.length >= 3 && cols.some(esFecha) && cols.some((x) => esCredito(x) || esImporte(x))) return { i, sep, cols };
    }
  }
  return null;
}

type Movimiento = { linea: string; c: string[]; monto: number; delta: number; saldo: number | null } | { roto: true };

const igual = (a: number, b: number) => Math.abs(a - b) < 0.005;

/** El extracto entero: los créditos, cuántas líneas no se pudieron leer y si cada crédito cierra con el saldo. */
export function analizarExtracto(csv: unknown): ExtractoLeido {
  const vacio: ExtractoLeido = { creditos: [], ilegibles: 0, conSaldo: false, entendido: false };
  if (typeof csv !== "string") return vacio;
  const lineas = csv.replace(/^﻿/, "").split(/\r?\n/).filter((l) => l.trim());
  const enc = encabezado(lineas);
  if (!enc) return vacio;
  const { sep, cols } = enc;
  const iCredito = cols.findIndex(esCredito);
  const iDebito = cols.findIndex(esDebito);
  const iImporte = cols.findIndex(esImporte);
  const iSaldo = cols.findIndex(esSaldo);
  const iFecha = cols.findIndex(esFecha);
  const iTipo = cols.findIndex(esTipo);
  // Con columna de crédito, ésa (y la de débito resta); si no, el importe con signo.
  const iMonto = iCredito >= 0 ? iCredito : iImporte;
  if (iMonto < 0) return vacio;

  let ilegibles = 0;
  const movimientos: Movimiento[] = [];
  for (const linea of lineas.slice(enc.i + 1)) {
    let c = campos(linea, sep);
    // Un separador de más al final (o de menos) es costumbre de algunos bancos, no un corrimiento.
    if (c.length === cols.length + 1 && c[c.length - 1] === "") c = c.slice(0, -1);
    if (c.length + 1 === cols.length && cols[cols.length - 1] === "") c = [...c, ""];
    if (c.length !== cols.length) {
      ilegibles++;
      movimientos.push({ roto: true });
      continue;
    }
    const valor = (i: number) => (i >= 0 && c[i] ? montoDeExtracto(c[i]) : null);
    const [credito, debito, importe] = [valor(iCredito), valor(iDebito), valor(iImporte)];
    if ([credito, debito, importe].some((n) => n !== null && Math.abs(n) >= MONTO_IMPOSIBLE)) {
      ilegibles++;
      movimientos.push({ roto: true });
      continue;
    }
    // Un importe sin signo con una columna "Tipo" (Débito/Crédito): el signo lo dice esa columna.
    const signo = iCredito < 0 && iTipo >= 0 ? signoDeTipo(c[iTipo]) : null;
    const conSigno = importe === null ? null : signo === null ? importe : signo * Math.abs(importe);
    const monto = iCredito >= 0 ? credito ?? 0 : conSigno ?? 0;
    const delta = iCredito >= 0 ? Math.max(credito ?? 0, 0) - Math.abs(debito ?? 0) : conSigno ?? 0;
    movimientos.push({ linea: linea.trim(), c, monto, delta, saldo: iSaldo >= 0 ? valor(iSaldo) : null });
  }

  // El saldo: ¿la lista va del más viejo al más nuevo o al revés? Gana el sentido en el que más
  // movimientos cierran (saldo de ahora = saldo de antes + movimiento).
  const conSaldo = iSaldo >= 0;
  const cierra = (antes: Movimiento | undefined, despues: Movimiento | undefined): boolean | undefined => {
    if (!antes || !despues) return undefined; // no hay vecino: no hay nada que comprobar de ese lado
    if ("roto" in antes || "roto" in despues) return false;
    return antes.saldo !== null && despues.saldo !== null && igual(antes.saldo + despues.delta, despues.saldo);
  };
  let ascendente = 0;
  let descendente = 0;
  for (let k = 1; k < movimientos.length; k++) {
    if (cierra(movimientos[k - 1], movimientos[k])) ascendente++;
    if (cierra(movimientos[k], movimientos[k - 1])) descendente++;
  }
  const haciaAdelante = ascendente >= descendente;

  const creditos: LineaDeExtracto[] = [];
  const vistas = new Map<string, number>();
  movimientos.forEach((m, k) => {
    if ("roto" in m || m.monto <= 0) return;
    const texto = m.c.filter((_, i) => i !== iMonto && i !== iDebito && i !== iImporte && i !== iSaldo && i !== iTipo).join(" ");
    const codigos = codigosEnTexto(texto);
    const ocurrencia = (vistas.get(m.linea) ?? 0) + 1;
    vistas.set(m.linea, ocurrencia);
    let saldoCierra: boolean | null = null;
    let sospecha: string | null = codigos.length > 1 ? `trae más de un código (${codigos.join(", ")})` : null;
    if (conSaldo) {
      const [antes, despues] = haciaAdelante ? [movimientos[k - 1], movimientos[k + 1]] : [movimientos[k + 1], movimientos[k - 1]];
      const lados = [cierra(antes, m), cierra(m, despues)].filter((x) => x !== undefined);
      saldoCierra = lados.length > 0 && lados.every(Boolean);
      if (!saldoCierra) {
        sospecha ??= [antes, despues].some((v) => v && "roto" in v)
          ? "está al lado de una línea que no se pudo leer"
          : lados.length === 0
            ? "es el único movimiento: no hay saldo con qué comprobarlo"
            : "no cierra con el saldo del extracto";
      }
    }
    creditos.push({
      linea: m.linea,
      fecha: iFecha >= 0 ? m.c[iFecha] || null : null,
      monto: m.monto,
      codigo: codigos[0] ?? null,
      ocurrencia,
      saldoCierra,
      sospecha,
    });
  });
  return { creditos, ilegibles, conSaldo, entendido: true };
}

/** Las líneas del extracto con plata que ENTRÓ, cada una con su código si lo trae. */
export function leerExtracto(csv: unknown): LineaDeExtracto[] {
  return analizarExtracto(csv).creditos;
}
