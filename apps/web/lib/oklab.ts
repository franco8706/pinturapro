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

/** sRGB (0..255) → lineal (0..1). */
function aLineal(v: number): number {
  const x = v / 255;
  return x <= 0.04045 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4);
}

/** Lineal (0..1) → sRGB (0..255), sin recortar: el llamador decide qué hacer si se pasa. */
function aSrgb(v: number): number {
  const x = v <= 0.0031308 ? v * 12.92 : 1.055 * Math.pow(v, 1 / 2.4) - 0.055;
  return x * 255;
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
function oklabACrudo(L: number, a: number, b: number): [number, number, number] {
  const l_ = L + 0.3963377774 * a + 0.2158037573 * b;
  const m_ = L - 0.1055613458 * a - 0.0638541728 * b;
  const s_ = L - 0.0894841775 * a - 1.291485548 * b;
  const l = l_ * l_ * l_;
  const m = m_ * m_ * m_;
  const s = s_ * s_ * s_;
  return [
    aSrgb(4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s),
    aSrgb(-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s),
    aSrgb(-0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s),
  ];
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
  const entra = ([r, g, bl]: [number, number, number]) =>
    r >= -0.5 && r <= 255.5 && g >= -0.5 && g <= 255.5 && bl >= -0.5 && bl <= 255.5;

  let rgb = oklabACrudo(L, a, b);
  if (!entra(rgb)) {
    let bajo = 0;
    let alto = 1;
    for (let i = 0; i < 10; i++) {
      const medio = (bajo + alto) / 2;
      if (entra(oklabACrudo(L, a * medio, b * medio))) bajo = medio;
      else alto = medio;
    }
    rgb = oklabACrudo(L, a * bajo, b * bajo);
  }
  return [
    Math.max(0, Math.min(255, rgb[0])),
    Math.max(0, Math.min(255, rgb[1])),
    Math.max(0, Math.min(255, rgb[2])),
  ];
}

/** Croma y tono (radianes) de un color de pantalla. */
export function rgbAOklch(r: number, g: number, b: number): { L: number; C: number; h: number } {
  const [L, a, bb] = rgbAOklab(r, g, b);
  return { L, C: Math.sqrt(a * a + bb * bb), h: Math.atan2(bb, a) };
}
