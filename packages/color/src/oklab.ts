/**
 * OKLab / OKLCh — espacio de color perceptual, para que "más claro" y "más oscuro"
 * signifiquen lo mismo en toda la escala.
 *
 * Por qué hace falta acá, con números medidos en el navegador sobre la misma pared:
 * el simulador conserva la textura del muro escalando su sombra por un factor fijo
 * (CONTRAST = 0,6). Haciendo esa cuenta en HSL, la textura que sobrevivía dependía
 * del color elegido:
 *
 *     Marfil 0,51 · Blanco Puro 0,57 · Arena 0,54 · Gris Perla 0,62
 *     Azul Profundo 0,87 · Negro Mate 1,04
 *
 * O sea: con un color oscuro la pared salía MÁS contrastada que la foto original
 * (1,04), que es exactamente lo que delata un montaje; con un color claro se
 * aplanaba (0,51). La L de HSL es (max+min)/2, un promedio de números de pantalla,
 * no una medida de cuánta luz percibe el ojo: en la zona oscura, un paso chico de
 * HSL es un salto grande de percepción, y al revés en la zona clara.
 *
 * OKLab sí es perceptual (Björn Ottosson, 2020): la misma diferencia numérica se ve
 * como la misma diferencia, arriba y abajo de la escala.
 *
 * Todas las funciones trabajan con sRGB 0..255 y L 0..1.
 */

/**
 * sRGB de un byte (0..255) → lineal (0..1), por tabla.
 *
 * Los píxeles de una foto son enteros de 0 a 255: hay sólo 256 valores posibles, y la potencia de
 * la fórmula se calculaba tres veces por píxel al cargar cada foto (700.000 píxeles en una de
 * 1024×683). La tabla tiene los mismos valores exactos que la fórmula.
 */
export const LINEAL_DE_BYTE = new Float64Array(256);
for (let v = 0; v < 256; v++) {
  const x = v / 255;
  LINEAL_DE_BYTE[v] = x <= 0.04045 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4);
}

/** sRGB (0..255) → lineal (0..1). Por tabla si es un byte; si no (un color con decimales), la fórmula. */
function aLineal(v: number): number {
  if ((v | 0) === v && v >= 0 && v <= 255) return LINEAL_DE_BYTE[v];
  const x = v / 255;
  return x <= 0.04045 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4);
}

/**
 * Lineal (0..1) → sRGB (0..255), por tabla.
 *
 * La fórmula exacta lleva un `Math.pow(v, 1/2.4)`, y acá se llama TRES VECES POR PÍXEL cada
 * vez que se repinta la pared: en una foto de 1024×683 son 2,1 millones de potencias por
 * cambio de color. Medido en la compilación de producción, con el procesador de un celular
 * de gama media: elegir un color congelaba la pantalla 363 ms.
 *
 * La tabla tiene 4.096 puntos e interpola entre ellos. El error contra la fórmula exacta es
 * de milésimas de un nivel de color de 0 a 255 — invisible— y cuesta una multiplicación y
 * una suma en lugar de una potencia.
 */
const PASOS_SRGB = 4096;
const TABLA_SRGB = new Float32Array(PASOS_SRGB + 1);
for (let i = 0; i <= PASOS_SRGB; i++) {
  const v = i / PASOS_SRGB;
  TABLA_SRGB[i] = (v <= 0.0031308 ? v * 12.92 : 1.055 * Math.pow(v, 1 / 2.4) - 0.055) * 255;
}

function aSrgb(v: number): number {
  if (v <= 0) return 0;
  if (v >= 1) return 255;
  const x = v * PASOS_SRGB;
  const i = x | 0;
  const f = x - i;
  return TABLA_SRGB[i] + (TABLA_SRGB[i + 1] - TABLA_SRGB[i]) * f;
}

export function rgbAOklab(r: number, g: number, b: number): [number, number, number] {
  const R = aLineal(r);
  const G = aLineal(g);
  const B = aLineal(b);
  const l = Math.cbrt(0.4122214708 * R + 0.5363325363 * G + 0.0514459929 * B);
  const m = Math.cbrt(0.2119034982 * R + 0.6806995451 * G + 0.1073969566 * B);
  const s = Math.cbrt(0.0883024619 * R + 0.2817188376 * G + 0.6299787005 * B);
  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  ];
}

/** Sólo la luminosidad perceptual. Es el camino caliente: una vez por píxel de la foto. */
export function rgbAOkL(r: number, g: number, b: number): number {
  const R = aLineal(r);
  const G = aLineal(g);
  const B = aLineal(b);
  const l = Math.cbrt(0.4122214708 * R + 0.5363325363 * G + 0.0514459929 * B);
  const m = Math.cbrt(0.2119034982 * R + 0.6806995451 * G + 0.1073969566 * B);
  const s = Math.cbrt(0.0883024619 * R + 0.2817188376 * G + 0.6299787005 * B);
  return 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s;
}

/** OKLab → sRGB 0..255 sin recortar (puede devolver valores fuera de 0..255). */
/**
 * OKLab → RGB lineal (0..1), sin recortar.
 *
 * Se devuelve en lineal a propósito: mirar si un color entra en la pantalla es comprobar que
 * los tres canales estén entre 0 y 1, y hacerlo acá evita convertir a sRGB —tres pasadas por
 * la tabla— en cada intento de la búsqueda de gama. Antes se convertía para después
 * descartar el resultado.
 */
const lineal: [number, number, number] = [0, 0, 0];

function oklabALineal(L: number, a: number, b: number): [number, number, number] {
  const l_ = L + 0.3963377774 * a + 0.2158037573 * b;
  const m_ = L - 0.1055613458 * a - 0.0638541728 * b;
  const s_ = L - 0.0894841775 * a - 1.291485548 * b;
  const l = l_ * l_ * l_;
  const m = m_ * m_ * m_;
  const s = s_ * s_ * s_;
  // Se reusa el mismo arreglo en cada llamada: esta función corre una vez por píxel y crear
  // un arreglo nuevo cada vez le da trabajo al recolector de basura justo en el momento en
  // que la pantalla tiene que responder.
  lineal[0] = 4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s;
  lineal[1] = -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s;
  lineal[2] = -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s;
  return lineal;
}

/**
 * ¿Los tres canales entran en la pantalla? Con un margen de medio nivel de pantalla (de 255).
 *
 * El margen se mira en luz LINEAL, y medio nivel de pantalla no es lo mismo en todo el rango:
 * cerca del negro la curva de sRGB es una recta de pendiente 12,92, así que medio nivel son
 * 0,5/255/12,92 en lineal. Antes el margen era 0,5/255 en los dos extremos, que abajo son 6,5
 * niveles: un oscuro saturado que se salía por poco pasaba por bueno, y al recortarlo canal por
 * canal se le corría el tono (hasta 69° en un oliva muy oscuro; Rojo Teja en sombra, ΔE 2,5).
 * Arriba, 0,5/255 en lineal es menos de medio nivel: no cambia.
 */
const MARGEN_NEGRO = 0.5 / 255 / 12.92;
const MARGEN_BLANCO = 0.5 / 255;
function entraEnPantalla([r, g, b]: [number, number, number]): boolean {
  const lo = -MARGEN_NEGRO;
  const hi = 1 + MARGEN_BLANCO;
  return r >= lo && r <= hi && g >= lo && g <= hi && b >= lo && b <= hi;
}

function oklabACrudo(L: number, a: number, b: number): [number, number, number] {
  const [r, g, bl] = oklabALineal(L, a, b);
  return [aSrgb(r), aSrgb(g), aSrgb(bl)];
}

/**
 * OKLCh → sRGB, bajando el croma hasta que el color entre en la pantalla.
 *
 * Recortar los canales a 0..255 y listo es lo barato, pero corre el tono: un azul
 * saturado y muy claro se vuelve celeste grisáceo por un lado y violeta por otro,
 * y en una pared eso se ve como manchas. Bajar el croma mantiene el tono y la
 * luminosidad, que es lo que la persona eligió. Búsqueda binaria corta: 12 pasos
 * dejan el error por debajo de lo que distingue el ojo, y sólo corre para los
 * colores que se salen de la gama.
 */
export function oklchASrgb(L: number, C: number, h: number): [number, number, number] {
  const cos = Math.cos(h);
  const sen = Math.sin(h);
  const entra = ([r, g, b]: [number, number, number]) =>
    r >= -0.5 && r <= 255.5 && g >= -0.5 && g <= 255.5 && b >= -0.5 && b <= 255.5;

  let rgb = oklabACrudo(L, C * cos, C * sen);
  if (!entra(rgb)) {
    let bajo = 0;
    let alto = C;
    for (let i = 0; i < 12; i++) {
      const medio = (bajo + alto) / 2;
      const prueba = oklabACrudo(L, medio * cos, medio * sen);
      if (entra(prueba)) bajo = medio;
      else alto = medio;
    }
    rgb = oklabACrudo(L, bajo * cos, bajo * sen);
  }
  return [
    Math.max(0, Math.min(255, rgb[0])),
    Math.max(0, Math.min(255, rgb[1])),
    Math.max(0, Math.min(255, rgb[2])),
  ];
}

/**
 * OKLab → sRGB, bajando el croma (acercando a y b a cero) hasta que entre en pantalla.
 *
 * Igual que `oklchASrgb` pero sin pasar por coordenadas polares: evita un `atan2`, un
 * `hypot` y un `cos`/`sin` por píxel, que en una foto de 1 megapíxel se notan.
 */
export function oklabASrgb(L: number, a: number, b: number): [number, number, number] {
  // La comprobación de gama se hace sobre los valores LINEALES: es la misma condición y
  // evita pasar por la tabla de conversión en cada intento de la búsqueda. Para un color que
  // ya entra —la mayoría de los píxeles de una pared— esto es una sola pasada.
  let ok = entraEnPantalla(oklabALineal(L, a, b));
  let escala = 1;
  if (!ok) {
    let bajo = 0;
    let alto = 1;
    for (let i = 0; i < 10; i++) {
      const medio = (bajo + alto) / 2;
      if (entraEnPantalla(oklabALineal(L, a * medio, b * medio))) bajo = medio;
      else alto = medio;
    }
    escala = bajo;
    ok = true;
  }
  const [r, g, bl] = oklabALineal(L, a * escala, b * escala);
  return [
    Math.max(0, Math.min(255, aSrgb(r))),
    Math.max(0, Math.min(255, aSrgb(g))),
    Math.max(0, Math.min(255, aSrgb(bl))),
  ];
}

/**
 * Lo mismo que `oklabASrgb`, pero escribe el resultado en `destino[p..p+2]` en vez de devolver
 * un arreglo nuevo. Es el camino por píxel de `componer` cuando la Intensidad es menor a 100 %
 * (o en el borde difuminado): un arreglo nuevo por píxel eran 700.000 por cambio de color, trabajo
 * para el recolector justo cuando la pantalla tiene que responder. El valor es el mismo.
 */
export function oklabASrgbEn(destino: Uint8ClampedArray, p: number, L: number, a: number, b: number): void {
  let lin = oklabALineal(L, a, b);
  const m = 0.5 / 255;
  const lo = -MARGEN_NEGRO;
  if (!(lin[0] >= lo && lin[0] <= 1 + m && lin[1] >= lo && lin[1] <= 1 + m && lin[2] >= lo && lin[2] <= 1 + m)) {
    let bajo = 0;
    let alto = 1;
    for (let i = 0; i < 10; i++) {
      const medio = (bajo + alto) / 2;
      const prueba = oklabALineal(L, a * medio, b * medio);
      if (prueba[0] >= lo && prueba[0] <= 1 + m && prueba[1] >= lo && prueba[1] <= 1 + m && prueba[2] >= lo && prueba[2] <= 1 + m) bajo = medio;
      else alto = medio;
    }
    lin = oklabALineal(L, a * bajo, b * bajo);
  }
  destino[p] = aSrgb(lin[0]);
  destino[p + 1] = aSrgb(lin[1]);
  destino[p + 2] = aSrgb(lin[2]);
}

/** Croma y tono (radianes) de un color de pantalla. */
export function rgbAOklch(r: number, g: number, b: number): { L: number; C: number; h: number } {
  const [L, a, bb] = rgbAOklab(r, g, b);
  return { L, C: Math.sqrt(a * a + bb * bb), h: Math.atan2(bb, a) };
}
