/**
 * Cómo se ve la pintura sobre la foto — la cuenta de cada píxel, sin lienzo ni React.
 *
 * Vivía dentro de `repaint` en `photo-simulator.tsx`. Se sacó por tres razones, todas del
 * 3/10/2026: (1) es la parte que decide si el color que se ve en la pared es el color que la
 * persona eligió, y adentro de un componente no había forma de probarla con números sin
 * levantar un navegador; (2) la app móvil la va a necesitar; (3) con la cuenta separada se
 * puede calcular UNA tabla por color en vez de repetir la cuenta en cada píxel (ver `curva`).
 *
 * El modelo, en una línea: cada píxel de la pared queda con el TONO y la SATURACIÓN del color
 * elegido, y con una luminosidad que sale de la de la foto — así sobreviven la luz de la
 * ventana, la sombra del mueble y el grano del revoque. Todo en OKLab (ver oklab.ts).
 */
import { rgbAOklch, oklabASrgb, oklabASrgbEn, LINEAL_DE_BYTE } from "./oklab";

/**
 * Cuánta textura y sombra de la foto se conserva (1 = copia 1:1). Con 1 la pared pintada se
 * ve tan manchada como la original, que con un color nuevo delata el montaje; 0,6 deja la luz
 * y el grano sin que la pintura parezca sucia.
 */
export const CONTRASTE = 0.6;

/** Luminosidad, croma y matiz (coseno y seno) del color elegido, en OKLCh. */
export interface Pintura {
  L: number;
  C: number;
  cos: number;
  sen: number;
}

/** Luminosidad (L) y croma (a, b intercalados) OKLab de cada píxel de la foto. */
export interface FotoPerceptual {
  L: Float32Array;
  ab: Float32Array;
}

/** Una zona pintada: su máscara suave (0..1 por píxel) y la tabla de su color. */
export interface Capa {
  alfa: Float32Array;
  curva: Curva;
  /**
   * Intensidad propia (0..1). Una pared que ya quedó fija conserva la que tenía; sin esto, mover
   * la Intensidad para la pared nueva cambiaba también las anteriores (4/10, `simulador-uso-real`).
   * Sin definir, vale la de `componer`.
   */
  intensidad?: number;
}

/**
 * La pintura de un color, ya resuelta para cada luminosidad posible de la foto.
 *
 * Con la Intensidad al 100 % y lejos del borde —casi toda la pared—, el color final de un píxel
 * depende SÓLO de su luminosidad en la foto. Entonces se calcula una vez por color para 1.025
 * luminosidades y cada píxel interpola en la tabla, en vez de repetir por píxel el hombro, la
 * conversión a sRGB y la búsqueda de gama (700.000 veces por cambio de color en una foto de
 * 1024×683). El error contra la cuenta exacta es de centésimas de nivel: no se ve.
 */
export interface Curva {
  /** Luminosidad de la pintura para cada nivel de la foto. */
  L: Float32Array;
  /** Croma de la pintura para cada nivel de la foto. */
  C: Float32Array;
  /** sRGB final (0..255, con decimales) para cada nivel, a Intensidad 100 %. */
  rgb: Float32Array;
  cos: number;
  sen: number;
}

const NIVELES = 1024;

/** `#RRGGBB` o `#RGB` → sRGB. Cualquier otra cosa → null (y no se pinta nada raro). */
export function hexARgb(hex: string): [number, number, number] | null {
  const m = /^#?([0-9a-f]{6}|[0-9a-f]{3})$/i.exec(hex.trim());
  if (!m) return null;
  const c = m[1].length === 3 ? m[1].replace(/./g, (x) => x + x) : m[1];
  return [parseInt(c.slice(0, 2), 16), parseInt(c.slice(2, 4), 16), parseInt(c.slice(4, 6), 16)];
}

export function pinturaDesdeHex(hex: string): Pintura | null {
  const rgb = hexARgb(hex);
  if (!rgb) return null;
  const { L, C, h } = rgbAOklch(rgb[0], rgb[1], rgb[2]);
  return { L, C, cos: Math.cos(h), sen: Math.sin(h) };
}

/**
 * OKLab de cada píxel de una foto RGBA (bytes 0..255, como los de un lienzo). Se calcula una vez
 * por foto.
 *
 * Es la cuenta de `rgbAOklab`, escrita acá adentro: sin la potencia por canal (va por la tabla
 * `LINEAL_DE_BYTE`) y sin crear un arreglo por píxel. Al cargar una foto era la tarea larga de
 * 561-592 ms en un celular de gama media (`rendimiento`, 4/10). El resultado es idéntico.
 */
export function fotoPerceptual(rgba: ArrayLike<number>, n: number): FotoPerceptual {
  const L = new Float32Array(n);
  const ab = new Float32Array(n * 2);
  const lin = LINEAL_DE_BYTE;
  for (let i = 0; i < n; i++) {
    const p = i * 4;
    const R = lin[rgba[p]];
    const G = lin[rgba[p + 1]];
    const B = lin[rgba[p + 2]];
    const l = Math.cbrt(0.4122214708 * R + 0.5363325363 * G + 0.0514459929 * B);
    const m = Math.cbrt(0.2119034982 * R + 0.6806995451 * G + 0.1073969566 * B);
    const s = Math.cbrt(0.0883024619 * R + 0.2817188376 * G + 0.6299787005 * B);
    L[i] = 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s;
    ab[i * 2] = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s;
    ab[i * 2 + 1] = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s;
  }
  return { L, ab };
}

/**
 * Qué luminosidad de la foto queda EXACTAMENTE con la del color elegido.
 *
 * No es el promedio de la pared: con el promedio, la mitad de los píxeles queda por encima del
 * color, y con un color extremo eso no entra — "Blanco Puro" tiene L = 0,97 y casi no queda
 * lugar hacia arriba, así que toda la mitad clara del muro terminaba en el mismo valor.
 * Anclando en un percentil alto para los claros (y bajo para los oscuros), la pared cae hacia
 * el lado donde sí hay recorrido.
 */
export function ancla(foto: FotoPerceptual, alfa: Float32Array, pintura: Pintura): number {
  const pct = Math.max(12, Math.min(88, 50 + (pintura.L - 0.5) * 70));
  const muestras: number[] = [];
  // Muestreo: alcanza para estimar un percentil y evita ordenar un millón de valores.
  const paso = Math.max(1, Math.floor(alfa.length / 20000));
  let suma = 0;
  let cuenta = 0;
  for (let i = 0; i < alfa.length; i += paso) {
    if (alfa[i] > 0.5) {
      muestras.push(foto.L[i]);
      suma += foto.L[i];
      cuenta++;
    }
  }
  if (muestras.length <= 1) return cuenta > 0 ? suma / cuenta : 0.5;
  muestras.sort((x, y) => x - y);
  const k = (muestras.length - 1) * (pct / 100);
  const f = Math.floor(k);
  const c = Math.min(f + 1, muestras.length - 1);
  return muestras[f] + (muestras[c] - muestras[f]) * (k - f);
}

/**
 * `Math.tanh` por tabla: vale prácticamente 1 a partir de 4, así que la tabla cubre 0..4 con
 * 2.048 puntos e interpola. El error es de una diezmilésima.
 */
const TANH_MAX = 4;
const TANH_PASOS = 2048;
const TABLA_TANH = new Float32Array(TANH_PASOS + 1);
for (let i = 0; i <= TANH_PASOS; i++) TABLA_TANH[i] = Math.tanh((i / TANH_PASOS) * TANH_MAX);

function tanhRapido(x: number): number {
  if (x >= TANH_MAX) return 1;
  const p = (x / TANH_MAX) * TANH_PASOS;
  const i = p | 0;
  return TABLA_TANH[i] + (TABLA_TANH[i + 1] - TABLA_TANH[i]) * (p - i);
}

/** Luminosidad y croma de la pintura en un píxel cuya luminosidad en la foto es `ol`. */
function pintaEn(ol: number, pintura: Pintura, ancla: number): [number, number] {
  const tl = pintura.L;
  const shade = (ol - ancla) * CONTRASTE;
  // Hombro suave en lugar de recorte: la pendiente es 1 en el medio y se cierra cerca de los
  // extremos sin aplastar nunca dos píxeles distintos en el mismo valor.
  const up = 1 - tl;
  const down = tl;
  let nl: number;
  if (shade >= 0) nl = up > 1e-6 ? tl + up * tanhRapido(shade / up) : tl;
  else nl = down > 1e-6 ? tl - down * tanhRapido(-shade / down) : tl;
  // El croma acompaña a la luminosidad: C/L constante, igual que en la muestra.
  //
  // Es lo que hace la luz de verdad. Una pared con menos luz refleja la misma proporción de
  // cada color, sólo que menos de todo; en OKLab eso escala L, a y b por el mismo factor, así
  // que una sombra baja el croma en la misma proporción que la luminosidad, sin tocar el tono.
  //
  // Antes el croma bajaba según la distancia a L = 0,5 (`C·(1 − rd²·0,35)`), no según la
  // distancia al color elegido: un color claro perdía saturación aun en el punto donde la pared
  // tenía que quedar IGUAL a la muestra. Marfil, Durazno y Celeste salían 10-15 % más grises
  // (ΔE 2,2 sobre una pared pareja). Y en las sombras profundas el croma se quedaba alto y el
  // recorte de gama corría el tono (Borravino, 11°). Medido el 3/10/2026: de ΔE 2,2 a 0,5.
  // Donde la pintura quedaría más saturada de lo que la pantalla puede mostrar —una luz fuerte
  // sobre un color vivo—, `oklabASrgb` baja el croma sin cambiar el tono.
  const nc = tl > 1e-6 ? (pintura.C * nl) / tl : pintura.C;
  return [nl, nc];
}

/** La tabla de un color para una pared (ver `Curva`). */
export function curva(pintura: Pintura, anclaDeLaPared: number): Curva {
  const L = new Float32Array(NIVELES + 1);
  const C = new Float32Array(NIVELES + 1);
  const rgb = new Float32Array((NIVELES + 1) * 3);
  for (let k = 0; k <= NIVELES; k++) {
    const [nl, nc] = pintaEn(k / NIVELES, pintura, anclaDeLaPared);
    L[k] = nl;
    C[k] = nc;
    const [r, g, b] = oklabASrgb(nl, nc * pintura.cos, nc * pintura.sen);
    rgb[k * 3] = r;
    rgb[k * 3 + 1] = g;
    rgb[k * 3 + 2] = b;
  }
  return { L, C, rgb, cos: pintura.cos, sen: pintura.sen };
}

/** Rectángulo de píxeles [x0, x1) × [y0, y1). Sin rectángulo, la foto entera. */
export interface Rect {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

/**
 * Compone la foto con sus capas de pintura, de abajo hacia arriba.
 *
 * `destino` y `origen` son RGBA del mismo tamaño (`ancho` × alto). Fuera de toda capa se copia
 * la foto. Donde hay pintura, la mezcla con lo de abajo se hace en OKLab, no en sRGB: mezclando
 * en sRGB, el resto de foto que deja la Intensidad se veía mucho más fuerte sobre un color
 * oscuro. Con varias capas, el borde difuminado de la de arriba se mezcla con la de abajo (no
 * con la foto), que es lo que se ve donde se tocan dos paredes de distinto color.
 *
 * `intensidad` (0..1) es cuánto cubre la pintura.
 */
export function componer(
  destino: Uint8ClampedArray,
  origen: Uint8ClampedArray,
  foto: FotoPerceptual,
  capas: readonly Capa[],
  intensidad: number,
  ancho: number,
  rect?: Rect,
): void {
  const alto = foto.L.length / ancho;
  const x0 = rect ? Math.max(0, rect.x0) : 0;
  const y0 = rect ? Math.max(0, rect.y0) : 0;
  const x1 = rect ? Math.min(ancho, rect.x1) : ancho;
  const y1 = rect ? Math.min(alto, rect.y1) : alto;
  const fuerza = Math.max(0, Math.min(1, intensidad));

  for (let y = y0; y < y1; y++) {
    for (let i = y * ancho + x0, fin = y * ancho + x1; i < fin; i++) {
      const p = i * 4;
      // La capa de más arriba que toca este píxel.
      let arriba = -1;
      for (let c = capas.length - 1; c >= 0; c--) {
        if (capas[c].alfa[i] > 0) {
          arriba = c;
          break;
        }
      }
      if (arriba < 0) {
        destino[p] = origen[p];
        destino[p + 1] = origen[p + 1];
        destino[p + 2] = origen[p + 2];
        destino[p + 3] = origen[p + 3];
        continue;
      }

      const ol = foto.L[i];
      const pos = Math.max(0, Math.min(1, ol)) * NIVELES;
      const k = Math.min(NIVELES - 1, pos | 0);
      const f = pos - k;

      // Camino rápido: la de arriba cubre del todo → el color sale de la tabla.
      const wArriba = capas[arriba].alfa[i] * (capas[arriba].intensidad ?? fuerza);
      if (wArriba >= 1) {
        const t = capas[arriba].curva.rgb;
        const q = k * 3;
        destino[p] = t[q] + (t[q + 3] - t[q]) * f;
        destino[p + 1] = t[q + 1] + (t[q + 4] - t[q + 1]) * f;
        destino[p + 2] = t[q + 2] + (t[q + 5] - t[q + 2]) * f;
        destino[p + 3] = origen[p + 3];
        continue;
      }

      // Camino completo: se apilan las capas sobre la foto, en OKLab.
      let L = ol;
      let a = foto.ab[i * 2];
      let b = foto.ab[i * 2 + 1];
      for (let c = 0; c <= arriba; c++) {
        const capa = capas[c];
        const w = capa.alfa[i] * (capa.intensidad ?? fuerza);
        if (w <= 0) continue;
        const cv = capa.curva;
        const nl = cv.L[k] + (cv.L[k + 1] - cv.L[k]) * f;
        const nc = cv.C[k] + (cv.C[k + 1] - cv.C[k]) * f;
        const iw = 1 - w;
        L = nl * w + L * iw;
        a = nc * cv.cos * w + a * iw;
        b = nc * cv.sen * w + b * iw;
      }
      oklabASrgbEn(destino, p, L, a, b);
      destino[p + 3] = origen[p + 3];
    }
  }
}
