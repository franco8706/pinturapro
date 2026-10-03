/**
 * El borde de la zona pintada: cuánto pinta cada píxel del filo.
 *
 * Una foto no tiene bordes de un píxel. Entre la pared y el marco de un cuadro, la esquina o el
 * zócalo hay uno o dos píxeles de TRANSICIÓN, mitad pared y mitad lo otro. La varita los deja
 * afuera (ahí el gradiente es alto: es justo lo que frena la selección), y si la pared era oscura
 * y se pinta de claro, esos píxeles quedan como un contorno del color viejo alrededor de cada
 * mueble y en cada esquina (visto en r08, pared verde oscura pintada de blanco, 3/10/2026).
 *
 * Dos pasos:
 *  1. Hacia adentro, un difuminado de 1 px: el corte no se escalona ("serrucho").
 *  2. Hacia afuera, hasta 2 px: cada píxel de transición se pinta en la proporción en que ES
 *     pared. Se compara su color con el de la pared de al lado (adentro de la selección) y con el
 *     de lo que hay del otro lado (más afuera): si está a 70 % del camino hacia la pared, se
 *     pinta al 70 %. Lo que es del todo "lo otro" —la moldura, el marco— queda en 0, así que la
 *     pintura no invade: sólo recupera lo que era pared a medias.
 *
 * Si la pared y lo de al lado son casi del mismo color (un techo apenas más claro), no hay forma
 * de saber cuánto de cada uno tiene un píxel: no se agrega nada.
 */
import type { FotoPerceptual } from "./pintura";

/** Hasta cuántos píxeles afuera de la selección se busca transición. */
const ANILLO = 2;
/** Radio de la ventana con la que se estima el color de cada lado. */
const VENTANA = 3;
/**
 * Diferencia mínima (OKLab) entre los dos lados para desmezclar. Con lados parecidos —una
 * pared casi blanca junto a una moldura blanca— la proporción sale de una diferencia de
 * ruido, y además ahí no hay contorno que se vea. Medido el 3/10/2026: con 0,03 se pintaba el
 * 7 % de la última columna de la moldura de la foto 01 (la prueba `sangrado-moldura` subía de
 * 4,5 a 7,2 %); con 0,05 la moldura queda idéntica a como estaba, y el contorno de pared vieja
 * de r08 (verde oscura pintada de blanco) baja de 53,6 % a 2,3 %. Una pared oscura junto a un
 * marco blanco es una diferencia de 0,4-0,5.
 */
const CONTRASTE_MINIMO = 0.05;

/**
 * Difuminado hacia adentro (caja separable de radio `radio`), con el alfa en 0 fuera de la
 * máscara. Antes era simétrico y la pintura se pasaba ~2 px sobre lo que no es pared: el 16,8 %
 * de una moldura clara de 22 px terminaba con color encima.
 */
export function difuminarHaciaAdentro(mascara: Uint8Array, alfa: Float32Array, w: number, h: number, radio: number): void {
  const tmp = new Float32Array(w * h);
  const ventana = radio * 2 + 1;
  for (let y = 0; y < h; y++) {
    const fila = y * w;
    let suma = 0;
    for (let k = -radio; k <= radio; k++) suma += mascara[fila + (k < 0 ? 0 : k >= w ? w - 1 : k)];
    for (let x = 0; x < w; x++) {
      tmp[fila + x] = suma / ventana;
      const entra = x + radio + 1;
      const sale = x - radio;
      suma += mascara[fila + (entra >= w ? w - 1 : entra)] - mascara[fila + (sale < 0 ? 0 : sale)];
    }
  }
  for (let x = 0; x < w; x++) {
    let suma = 0;
    for (let k = -radio; k <= radio; k++) suma += tmp[(k < 0 ? 0 : k >= h ? h - 1 : k) * w + x];
    for (let y = 0; y < h; y++) {
      const i = y * w + x;
      alfa[i] = mascara[i] ? suma / ventana : 0;
      const entra = y + radio + 1;
      const sale = y - radio;
      suma += tmp[(entra >= h ? h - 1 : entra) * w + x] - tmp[(sale < 0 ? 0 : sale) * w + x];
    }
  }
}

/**
 * Alfa de una selección: difuminado de 1 px hacia adentro y los píxeles de transición de
 * afuera pintados en la proporción en que son pared (ver arriba).
 */
export function alfaDeLaSeleccion(mascara: Uint8Array, alfa: Float32Array, foto: FotoPerceptual, w: number, h: number): void {
  difuminarHaciaAdentro(mascara, alfa, w, h, 1);

  // `cerca`: a ANILLO px o menos de la selección (Chebyshev), por dilatación separable.
  const n = w * h;
  const fila = new Uint8Array(n);
  for (let y = 0; y < h; y++) {
    let ultimo = -1e9;
    const base = y * w;
    for (let x = 0; x < w; x++) {
      if (mascara[base + x]) ultimo = x;
      if (x - ultimo <= ANILLO) fila[base + x] = 1;
    }
    ultimo = 1e9;
    for (let x = w - 1; x >= 0; x--) {
      if (mascara[base + x]) ultimo = x;
      if (ultimo - x <= ANILLO) fila[base + x] = 1;
    }
  }
  const cerca = new Uint8Array(n);
  for (let x = 0; x < w; x++) {
    let ultimo = -1e9;
    for (let y = 0; y < h; y++) {
      if (fila[y * w + x]) ultimo = y;
      if (y - ultimo <= ANILLO) cerca[y * w + x] = 1;
    }
    ultimo = 1e9;
    for (let y = h - 1; y >= 0; y--) {
      if (fila[y * w + x]) ultimo = y;
      if (ultimo - y <= ANILLO) cerca[y * w + x] = 1;
    }
  }

  const { L, ab } = foto;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      if (mascara[i] || !cerca[i]) continue;
      // El color de cada lado, en la ventana: la pared (adentro) y "lo otro" (más allá del anillo).
      let nP = 0, lP = 0, aP = 0, bP = 0;
      let nO = 0, lO = 0, aO = 0, bO = 0;
      for (let dy = -VENTANA; dy <= VENTANA; dy++) {
        const yy = y + dy;
        if (yy < 0 || yy >= h) continue;
        for (let dx = -VENTANA; dx <= VENTANA; dx++) {
          const xx = x + dx;
          if (xx < 0 || xx >= w) continue;
          const j = yy * w + xx;
          if (mascara[j]) {
            nP++; lP += L[j]; aP += ab[j * 2]; bP += ab[j * 2 + 1];
          } else if (!cerca[j]) {
            nO++; lO += L[j]; aO += ab[j * 2]; bO += ab[j * 2 + 1];
          }
        }
      }
      if (nP < 3 || nO < 3) continue;
      lP /= nP; aP /= nP; bP /= nP;
      lO /= nO; aO /= nO; bO /= nO;
      const vl = lP - lO, va = aP - aO, vb = bP - bO;
      const largo2 = vl * vl + va * va + vb * vb;
      if (largo2 < CONTRASTE_MINIMO * CONTRASTE_MINIMO) continue;
      // Proyección del píxel sobre el segmento "lo otro" → "pared": 0 = es lo otro, 1 = es pared.
      // En OKLab (perceptual) y también en luz lineal (L³), y vale la mayor. La cámara mezcla la
      // luz de los dos lados en LINEAL: un píxel que es 70 % pared oscura y 30 % marco blanco
      // da 0,47 en OKLab —se pintaba a medias y el contorno seguía— y 0,70 en lineal. Lo que es
      // del todo "lo otro" da 0 en las dos cuentas, así que la mayor no invade.
      const tOk = ((L[i] - lO) * vl + (ab[i * 2] - aO) * va + (ab[i * 2 + 1] - bO) * vb) / largo2;
      const yP = lP * lP * lP;
      const yO = lO * lO * lO;
      const tLin = Math.abs(yP - yO) > 0.02 ? (L[i] * L[i] * L[i] - yO) / (yP - yO) : 0;
      const t = Math.max(tOk, tLin);
      if (t > 0.05) alfa[i] = Math.min(1, t);
    }
  }
}
