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
 * Alfa de una selección: cuánto pinta cada píxel del filo.
 *
 * Se desmezclan TRES franjas, todas contra los mismos dos colores de referencia (la pared, del
 * interior de la selección; "lo otro", de más allá del anillo):
 *  · el filo de adentro (los píxeles de la selección con algún vecino afuera): si son pared, se
 *    pintan enteros. Hasta el 4/10 quedaban al 67 % por el difuminado, al lado de los de afuera
 *    pintados al 100 %: una línea gris adentro de la pintura en el 89 % del filo de r08;
 *  · el primer píxel de afuera: en la proporción en que es pared;
 *  · el segundo de afuera, SÓLO si el primero es pared de verdad (≥ 0,9). Si en el medio hay una
 *    arista —la línea más oscura entre la pared y la tapa de un mueble del mismo color—, la
 *    pintura no la salta: la tapa de la cómoda de r02 quedaba pintada.
 * Donde los dos lados son casi iguales no hay proporción que calcular: queda el difuminado de
 * 1 px hacia adentro, que evita el serrucho, y afuera no se pinta nada.
 */
export function alfaDeLaSeleccion(mascara: Uint8Array, alfa: Float32Array, foto: FotoPerceptual, w: number, h: number): void {
  difuminarHaciaAdentro(mascara, alfa, w, h, 1);
  const n = w * h;

  // Distancia a la selección (vecindad de 8): 0 adentro, 1 y 2 en el anillo, 3 más allá.
  // Y `filo`: los de adentro con algún vecino afuera.
  const dist = new Uint8Array(n).fill(3);
  const filo = new Uint8Array(n);
  const vecinos = (i: number, x: number, y: number, f: (j: number) => void) => {
    for (let dy = -1; dy <= 1; dy++) {
      const yy = y + dy;
      if (yy < 0 || yy >= h) continue;
      for (let dx = -1; dx <= 1; dx++) {
        if (!dx && !dy) continue;
        const xx = x + dx;
        if (xx < 0 || xx >= w) continue;
        f(i + dy * w + dx);
      }
    }
  };
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      if (mascara[i]) {
        dist[i] = 0;
        vecinos(i, x, y, (j) => {
          if (!mascara[j]) filo[i] = 1;
        });
      } else {
        vecinos(i, x, y, (j) => {
          if (mascara[j]) dist[i] = 1;
        });
      }
    }
  }
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      if (dist[i] !== 3) continue;
      vecinos(i, x, y, (j) => {
        if (dist[j] === 1) dist[i] = 2;
      });
    }
  }

  const { L, ab } = foto;
  /** Proporción de pared del píxel `i` (0 = lo otro, 1 = pared), o -1 si no se puede saber. */
  const proporcion = (i: number, x: number, y: number): number => {
    let nP = 0, lP = 0, aP = 0, bP = 0;
    let nF = 0, lF = 0, aF = 0, bF = 0; // el filo, por si la pared no tiene interior en la ventana
    let nO = 0, lO = 0, aO = 0, bO = 0;
    for (let dy = -VENTANA; dy <= VENTANA; dy++) {
      const yy = y + dy;
      if (yy < 0 || yy >= h) continue;
      for (let dx = -VENTANA; dx <= VENTANA; dx++) {
        const xx = x + dx;
        if (xx < 0 || xx >= w) continue;
        const j = yy * w + xx;
        if (dist[j] === 0) {
          if (filo[j]) {
            nF++; lF += L[j]; aF += ab[j * 2]; bF += ab[j * 2 + 1];
          } else {
            nP++; lP += L[j]; aP += ab[j * 2]; bP += ab[j * 2 + 1];
          }
        } else if (dist[j] === 3) {
          nO++; lO += L[j]; aO += ab[j * 2]; bO += ab[j * 2 + 1];
        }
      }
    }
    // La pared de referencia es el interior: el filo puede ser una mezcla. Sin interior a la
    // vista (una selección finita), sirve el filo.
    if (nP < 3) {
      nP = nF; lP = lF; aP = aF; bP = bF;
    }
    if (nP < 3 || nO < 3) return -1;
    lP /= nP; aP /= nP; bP /= nP;
    lO /= nO; aO /= nO; bO /= nO;
    const vl = lP - lO, va = aP - aO, vb = bP - bO;
    const largo2 = vl * vl + va * va + vb * vb;
    if (largo2 < CONTRASTE_MINIMO * CONTRASTE_MINIMO) return -1;
    // Proyección sobre el segmento "lo otro" → "pared", en OKLab (perceptual) y en luz lineal
    // (L³), y vale la mayor. La cámara mezcla la luz de los dos lados en LINEAL: un píxel que es
    // 70 % pared oscura y 30 % marco blanco da 0,47 en OKLab y 0,70 en lineal. Lo que es del todo
    // "lo otro" da 0 en las dos cuentas, así que la mayor no invade.
    const tOk = ((L[i] - lO) * vl + (ab[i * 2] - aO) * va + (ab[i * 2 + 1] - bO) * vb) / largo2;
    const yP = lP * lP * lP;
    const yO = lO * lO * lO;
    const tLin = Math.abs(yP - yO) > 0.02 ? (L[i] * L[i] * L[i] - yO) / (yP - yO) : 0;
    return Math.max(0, Math.min(1, Math.max(tOk, tLin)));
  };

  // 1) El filo de adentro y el primer píxel de afuera.
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      if (!filo[i] && dist[i] !== 1) continue;
      const t = proporcion(i, x, y);
      if (t < 0) continue; // lados parecidos: queda el difuminado (adentro) o nada (afuera)
      if (filo[i]) alfa[i] = t;
      else if (t > 0.05) alfa[i] = t;
    }
  }
  // 1 bis) Un píxel del filo que quedó con el difuminado (su ventana no tenía contraste) pero
  // está pegado a un píxel de afuera que sí es pared, también es pared: si no, queda un escalón
  // al 67 % entre la pintura de adentro y la de afuera — la misma línea gris, por otro camino.
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      if (!filo[i] || alfa[i] >= 0.9) continue;
      let pegadoAPared = false;
      vecinos(i, x, y, (j) => {
        if (dist[j] === 1 && alfa[j] >= 0.9) pegadoAPared = true;
      });
      if (pegadoAPared) alfa[i] = 1;
    }
  }
  // 2) El segundo de afuera, sólo pegado a un primero que es pared de verdad.
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      if (dist[i] !== 2) continue;
      let pegadoAPared = false;
      vecinos(i, x, y, (j) => {
        if (dist[j] === 1 && alfa[j] >= 0.9) pegadoAPared = true;
      });
      if (!pegadoAPared) continue;
      const t = proporcion(i, x, y);
      if (t > 0.05) alfa[i] = t;
    }
  }
}
