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
 * 1 px hacia adentro (el conteo de la vecindad de 3×3), que evita el serrucho, y afuera nada.
 *
 * Velocidad: corre en el hilo de la pantalla en cada toque, pincelada, contorno, Deshacer y
 * Limpiar. Recorre sólo el rectángulo de la selección, una vez, y después trabaja sobre las
 * listas del filo y del anillo (unos miles de píxeles), sin funciones por píxel. La versión
 * anterior recorría la foto entera tres veces creando una función por píxel: 229 ms por llamada
 * en un celular de gama media contra 142 de la anterior a ella (`rendimiento`, 4/10). Da
 * exactamente el mismo resultado que esa versión (comprobado píxel a píxel en fotos reales).
 */
export function alfaDeLaSeleccion(mascara: Uint8Array, alfa: Float32Array, foto: FotoPerceptual, w: number, h: number): void {
  alfa.fill(0);
  // El rectángulo de la selección.
  let bx0 = w, bx1 = -1, by0 = h, by1 = -1;
  for (let y = 0; y < h; y++) {
    const fila = y * w;
    let primera = -1, ultima = -1;
    for (let x = 0; x < w; x++) {
      if (mascara[fila + x]) {
        if (primera < 0) primera = x;
        ultima = x;
      }
    }
    if (primera < 0) continue;
    if (primera < bx0) bx0 = primera;
    if (ultima > bx1) bx1 = ultima;
    if (y < by0) by0 = y;
    by1 = y;
  }
  if (bx1 < 0) return; // selección vacía

  const n = w * h;
  // Marca por píxel: 0 = nada, 1 = primer píxel de afuera, 2 = segundo, 3 = filo de adentro.
  const marca = new Uint8Array(n);
  const filo: number[] = [];
  const anillo1: number[] = [];
  const anillo2: number[] = [];

  // 1) Interior, filo (con el difuminado de 3×3 replicando el borde de la foto, igual que
  //    `difuminarHaciaAdentro` de radio 1) y primer píxel de afuera, en una sola pasada por el
  //    rectángulo agrandado 1 px.
  const rx0 = Math.max(0, bx0 - 1), rx1 = Math.min(w - 1, bx1 + 1);
  const ry0 = Math.max(0, by0 - 1), ry1 = Math.min(h - 1, by1 + 1);
  for (let y = ry0; y <= ry1; y++) {
    const arriba = y > 0 ? -w : 0;
    const abajo = y < h - 1 ? w : 0;
    for (let x = rx0; x <= rx1; x++) {
      const i = y * w + x;
      const izq = x > 0 ? -1 : 0;
      const der = x < w - 1 ? 1 : 0;
      if (mascara[i]) {
        const c =
          mascara[i + arriba + izq] + mascara[i + arriba] + mascara[i + arriba + der] +
          mascara[i + izq] + mascara[i] + mascara[i + der] +
          mascara[i + abajo + izq] + mascara[i + abajo] + mascara[i + abajo + der];
        if (c === 9) alfa[i] = 1;
        else {
          alfa[i] = c / 9;
          // Filo = algún vecino REAL afuera (los de fuera de la foto no cuentan).
          if (
            (y > 0 && ((x > 0 && !mascara[i - w - 1]) || !mascara[i - w] || (x < w - 1 && !mascara[i - w + 1]))) ||
            (x > 0 && !mascara[i - 1]) || (x < w - 1 && !mascara[i + 1]) ||
            (y < h - 1 && ((x > 0 && !mascara[i + w - 1]) || !mascara[i + w] || (x < w - 1 && !mascara[i + w + 1])))
          ) {
            marca[i] = 3;
            filo.push(i);
          }
        }
      } else if (
        (y > 0 && ((x > 0 && mascara[i - w - 1]) || mascara[i - w] || (x < w - 1 && mascara[i - w + 1]))) ||
        (x > 0 && mascara[i - 1]) || (x < w - 1 && mascara[i + 1]) ||
        (y < h - 1 && ((x > 0 && mascara[i + w - 1]) || mascara[i + w] || (x < w - 1 && mascara[i + w + 1])))
      ) {
        marca[i] = 1;
        anillo1.push(i);
      }
    }
  }
  // 2) Segundo píxel de afuera: los vecinos de los primeros que no son ni selección ni primeros.
  for (let k = 0; k < anillo1.length; k++) {
    const i = anillo1[k];
    const x = i % w;
    const y = (i - x) / w;
    for (let dy = -1; dy <= 1; dy++) {
      const yy = y + dy;
      if (yy < 0 || yy >= h) continue;
      for (let dx = -1; dx <= 1; dx++) {
        const xx = x + dx;
        if (xx < 0 || xx >= w) continue;
        const j = yy * w + xx;
        if (!mascara[j] && marca[j] === 0) {
          marca[j] = 2;
          anillo2.push(j);
        }
      }
    }
  }

  const { L, ab } = foto;
  /** Proporción de pared del píxel `i` (0 = lo otro, 1 = pared), o -1 si no se puede saber. */
  const proporcion = (i: number): number => {
    const x = i % w;
    const y = (i - x) / w;
    let nP = 0, lP = 0, aP = 0, bP = 0;
    let nF = 0, lF = 0, aF = 0, bF = 0; // el filo, por si la pared no tiene interior en la ventana
    let nO = 0, lO = 0, aO = 0, bO = 0;
    const ya = Math.max(0, y - VENTANA), yb = Math.min(h - 1, y + VENTANA);
    const xa = Math.max(0, x - VENTANA), xb = Math.min(w - 1, x + VENTANA);
    for (let yy = ya; yy <= yb; yy++) {
      for (let j = yy * w + xa, fin = yy * w + xb; j <= fin; j++) {
        if (mascara[j]) {
          if (marca[j] === 3) {
            nF++; lF += L[j]; aF += ab[j * 2]; bF += ab[j * 2 + 1];
          } else {
            nP++; lP += L[j]; aP += ab[j * 2]; bP += ab[j * 2 + 1];
          }
        } else if (marca[j] === 0) {
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
  /** ¿Algún vecino (8) es un primer píxel de afuera que es pared de verdad? */
  const pegadoAPared = (i: number): boolean => {
    const x = i % w;
    const y = (i - x) / w;
    for (let dy = -1; dy <= 1; dy++) {
      const yy = y + dy;
      if (yy < 0 || yy >= h) continue;
      for (let dx = -1; dx <= 1; dx++) {
        const xx = x + dx;
        if (xx < 0 || xx >= w || (!dx && !dy)) continue;
        const j = yy * w + xx;
        if (marca[j] === 1 && alfa[j] >= 0.9) return true;
      }
    }
    return false;
  };

  // 3) El filo de adentro y el primer píxel de afuera, desmezclados.
  for (let k = 0; k < filo.length; k++) {
    const t = proporcion(filo[k]);
    if (t >= 0) alfa[filo[k]] = t; // lados parecidos (-1): queda el difuminado
  }
  for (let k = 0; k < anillo1.length; k++) {
    const t = proporcion(anillo1[k]);
    if (t > 0.05) alfa[anillo1[k]] = t;
  }
  // 3 bis) Un píxel del filo que quedó con el difuminado (su ventana no tenía contraste) pero
  // está pegado a un píxel de afuera que sí es pared, también es pared: si no, queda un escalón
  // al 67 % entre la pintura de adentro y la de afuera — la misma línea gris, por otro camino.
  for (let k = 0; k < filo.length; k++) {
    const i = filo[k];
    if (alfa[i] < 0.9 && pegadoAPared(i)) alfa[i] = 1;
  }
  // 4) El segundo de afuera, sólo pegado a un primero que es pared de verdad.
  for (let k = 0; k < anillo2.length; k++) {
    const i = anillo2[k];
    if (!pegadoAPared(i)) continue;
    const t = proporcion(i);
    if (t > 0.05) alfa[i] = t;
  }
}
