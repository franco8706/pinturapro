/**
 * Varita mágica — selección de superficies por crecimiento de región, 100% en el navegador.
 *
 * Reemplaza la dependencia de un modelo de segmentación remoto para el caso de uso real
 * del simulador: "hago clic en una pared y quiero esa pared".
 *
 * Por qué no alcanza SAM acá: `meta/sam-2` (el único modo que expone Replicate) segmenta
 * TODA la foto sin recibir el punto del clic — ~30 s y ~100 regiones — y además no es
 * semántico, así que una pared con una sombra o una moldura se parte en varios pedazos.
 * Esto resuelve el mismo problema en ~30 ms, sin red y sin costo.
 *
 * Ideas centrales del algoritmo:
 *
 *  1. **Seguir el degradado, con correa.** La versión anterior comparaba SIEMPRE contra el
 *     color del clic, para que un degradé no hiciera "gotear" la selección por media foto.
 *     El precio era alto y medido en el navegador, contra una máscara de referencia: en una
 *     pared con luz de ventana la varita agarraba el 54% de la pared con la sensibilidad por
 *     defecto, y para llegar al 78% había que subirla tanto que se comía el techo entero
 *     (precisión 97,6% → 82%). Una pared iluminada NO es un color: es un rango continuo.
 *     Con este cambio, al valor por defecto: pared con luz 54% → 83% de la pared agarrada
 *     (acuerdo global 53% → 82%), pared oscura 77% → 85%, pared plana igual, y la precisión
 *     se mantiene en 98-99%. La fuga al techo al subir la sensibilidad en la pared plana
 *     (8,9% de la foto) desapareció.
 *     Ahora se avanza vecino a vecino sobre la luminancia SUAVIZADA (`Ys`, que absorbe el
 *     ruido del sensor y la textura del revoque), con dos frenos que evitan la fuga:
 *     un paso local chico —el degradé de una pared es suave, el salto a otra superficie no—
 *     y una correa global contra el color del clic, para no terminar en la otra punta de la
 *     foto sumando pasos mínimos. La croma se sigue comparando contra el clic.
 *
 *  2. **Separar luma de croma.** Una pared en sombra sigue siendo la misma pared: cambia su
 *     brillo, no su tono. Se trabaja en YCbCr y se pondera MENOS la luminancia que la
 *     cromaticidad, así la selección atraviesa sombras pero se frena ante un color distinto.
 *
 *  3. **Frenar en bordes estructurales.** Un zócalo o el marco de una ventana es un salto
 *     brusco de luminancia. Con la magnitud del gradiente (Sobel) se evita que la región
 *     cruce esos límites aunque el color del otro lado sea parecido.
 *
 *  4. **Cerrar huecos.** Enchufes, clavos y la textura del revoque dejan agujeros. Un cierre
 *     morfológico (dilatar y erosionar) los absorbe sin desbordar el contorno.
 */

/** Imagen preprocesada para la varita. Se calcula UNA vez por foto y se reusa en cada clic. */
export interface WandImage {
  w: number;
  h: number;
  /** Luminancia 0..255 */
  Y: Float32Array;
  /**
   * Luminancia suavizada (media de 5×5).
   *
   * El crecimiento paso a paso necesita saber si el brillo cambió *de verdad* o si es ruido
   * del sensor. Entre dos píxeles vecinos de una pared lisa el ruido JPEG ya da saltos de
   * 10-20 puntos; sobre la luma cruda, cualquier umbral chico corta la pared al instante y
   * cualquiera grande deja pasar el zócalo. Suavizada, el paso mide el degradé y no el grano.
   */
  Ys: Float32Array;
  /** Croma azul, centrada en 0 */
  Cb: Float32Array;
  /** Croma roja, centrada en 0 */
  Cr: Float32Array;
  /** Magnitud del gradiente de luminancia (Sobel) — detecta bordes estructurales */
  grad: Float32Array;
  /**
   * Percentiles del gradiente de ESTA foto (índice = percentil 0..100).
   *
   * El umbral de borde no puede ser un número fijo: una foto a contraluz y una foto plana
   * tienen escalas de gradiente completamente distintas. Calibrando por percentil, "frenar
   * en el 15% de píxeles con más contraste" significa lo mismo en cualquier foto.
   */
  gradPercentile: Float32Array;
}

export interface WandOptions {
  /** 0..100 — cuánto se aleja del color de la semilla. Es el slider del usuario. */
  tolerance: number;
  /** 0..100 — cuánto frena en bordes. 0 = ignora bordes. */
  edgeResistance?: number;
  /** Radio (px) de la ventana que promedia el color de referencia. Amortigua el ruido/textura. */
  sampleRadius?: number;
  /** Radio (px) del cierre morfológico que tapa huecos. 0 = desactivado. */
  fillHoles?: number;
  /**
   * Radio máximo (px) de expansión desde el clic. 0 = sin límite.
   *
   * Red de contención contra el peor modo de falla: en una foto con una ventana, la
   * selección puede escaparse por el vidrio y agarrar el edificio de enfrente. Cortar por
   * distancia mantiene el error acotado y previsible: "agarró de más, pero acá cerca".
   */
  maxRadius?: number;
}

const DEFAULTS = { edgeResistance: 45, sampleRadius: 2, fillHoles: 2 };

/**
 * Precalcula YCbCr + gradiente. Es la parte cara (una pasada por píxel), por eso corre
 * una sola vez al cargar la foto y no en cada clic.
 */
export function prepareWandImage(img: ImageData): WandImage {
  const { width: w, height: h, data } = img;
  const n = w * h;
  const Y = new Float32Array(n);
  const Cb = new Float32Array(n);
  const Cr = new Float32Array(n);

  for (let i = 0; i < n; i++) {
    const p = i * 4;
    const r = data[p];
    const g = data[p + 1];
    const b = data[p + 2];
    // BT.601 — barato y suficiente para separar brillo de tono.
    Y[i] = 0.299 * r + 0.587 * g + 0.114 * b;
    Cb[i] = -0.168736 * r - 0.331264 * g + 0.5 * b;
    Cr[i] = 0.5 * r - 0.418688 * g - 0.081312 * b;
  }

  // Luma suavizada: box blur separable de radio 2 (dos pasadas 1D, O(n) con suma corrida).
  const Ys = new Float32Array(n);
  {
    const R = 2;
    const tmp = new Float32Array(n);
    for (let y = 0; y < h; y++) {
      const fila = y * w;
      let suma = 0;
      for (let x = 0; x <= R && x < w; x++) suma += Y[fila + x];
      let cuenta = Math.min(R + 1, w);
      for (let x = 0; x < w; x++) {
        tmp[fila + x] = suma / cuenta;
        const sale = x - R;
        const entra = x + R + 1;
        if (entra < w) {
          suma += Y[fila + entra];
          cuenta++;
        }
        if (sale >= 0) {
          suma -= Y[fila + sale];
          cuenta--;
        }
      }
    }
    for (let x = 0; x < w; x++) {
      let suma = 0;
      for (let y = 0; y <= R && y < h; y++) suma += tmp[y * w + x];
      let cuenta = Math.min(R + 1, h);
      for (let y = 0; y < h; y++) {
        Ys[y * w + x] = suma / cuenta;
        const sale = y - R;
        const entra = y + R + 1;
        if (entra < h) {
          suma += tmp[entra * w + x];
          cuenta++;
        }
        if (sale >= 0) {
          suma -= tmp[sale * w + x];
          cuenta--;
        }
      }
    }
  }

  // Sobel sobre la luminancia. Los bordes de la imagen quedan en 0 (no hay vecindario completo).
  const grad = new Float32Array(n);
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const i = y * w + x;
      const tl = Y[i - w - 1];
      const tc = Y[i - w];
      const tr = Y[i - w + 1];
      const ml = Y[i - 1];
      const mr = Y[i + 1];
      const bl = Y[i + w - 1];
      const bc = Y[i + w];
      const br = Y[i + w + 1];
      const gx = tr + 2 * mr + br - (tl + 2 * ml + bl);
      const gy = bl + 2 * bc + br - (tl + 2 * tc + tr);
      grad[i] = Math.sqrt(gx * gx + gy * gy);
    }
  }

  // Percentiles del gradiente vía histograma (más barato que ordenar ~1M de valores).
  const BINS = 1024;
  const hist = new Uint32Array(BINS);
  for (let i = 0; i < n; i++) hist[Math.min(BINS - 1, grad[i] | 0)]++;
  const gradPercentile = new Float32Array(101);
  let acc = 0;
  let bin = 0;
  for (let p = 0; p <= 100; p++) {
    const target = (p / 100) * n;
    while (acc < target && bin < BINS - 1) acc += hist[bin++];
    gradPercentile[p] = bin;
  }

  return { w, h, Y, Ys, Cb, Cr, grad, gradPercentile };
}

/**
 * Selecciona la región conectada que contiene (sx, sy).
 *
 * Devuelve una máscara binaria (1 = seleccionado) del tamaño de la imagen.
 * No modifica ninguna máscara previa: el llamador decide si suma, resta o reemplaza.
 */
export function magicWand(img: WandImage, sx: number, sy: number, opts: WandOptions): Uint8Array {
  const { w, h, Y, Ys, Cb, Cr, grad } = img;
  const n = w * h;
  const mask = new Uint8Array(n);

  const x0 = Math.min(w - 1, Math.max(0, Math.round(sx)));
  const y0 = Math.min(h - 1, Math.max(0, Math.round(sy)));
  const seed = y0 * w + x0;

  const edgeResistance = opts.edgeResistance ?? DEFAULTS.edgeResistance;
  const sampleRadius = opts.sampleRadius ?? DEFAULTS.sampleRadius;
  const holes = opts.fillHoles ?? DEFAULTS.fillHoles;

  // ── Color de referencia: promedio de una ventana alrededor del clic ──
  // Un píxel suelto puede caer justo en una mota de textura y arruinar la referencia.
  let sy0 = 0;
  let scb = 0;
  let scr = 0;
  let count = 0;
  for (let dy = -sampleRadius; dy <= sampleRadius; dy++) {
    for (let dx = -sampleRadius; dx <= sampleRadius; dx++) {
      const x = x0 + dx;
      const y = y0 + dy;
      if (x < 0 || y < 0 || x >= w || y >= h) continue;
      const i = y * w + x;
      sy0 += Y[i];
      scb += Cb[i];
      scr += Cr[i];
      count++;
    }
  }
  const refY = sy0 / count;
  const refCb = scb / count;
  const refCr = scr / count;

  // ── Umbrales ──
  // Medidos sobre fotos de interiores reales: en un ambiente neutro (paredes, techo y
  // muebles claros) el color NO discrimina — pared y mesa pueden tener idéntica luminancia
  // y croma casi igual. Lo único que separa las superficies es el borde geométrico entre
  // ellas. Por eso el color acota, pero el freno de verdad lo pone `edgeTol`.
  const t = Math.max(0, Math.min(100, opts.tolerance)) / 100;
  const chromaTol = 3 + t * 17; // 3..20
  // Paso local sobre la luma suavizada: cuánto puede cambiar el brillo de un píxel al de al
  // lado. El degradé de una pared iluminada es de décimas por píxel; el salto a un zócalo o
  // a un mueble es de varias unidades. Chico a propósito.
  const pasoLuma = 1.2 + t * 3.8; // 1.2..5
  // Correa global contra el color del clic: evita que muchos pasos mínimos terminen del otro
  // lado de la foto. Generosa, porque una pared con luz de ventana cambia mucho de punta a
  // punta; el que decide de verdad es el paso local.
  const lumaTol = 45 + t * 135; // 45..180
  // Resistencia alta ⇒ percentil bajo ⇒ frena en bordes más suaves.
  // 0 → p99 (casi no frena) · 50 → p87 · 100 → p75
  const edgeTol =
    edgeResistance <= 0 ? Infinity : img.gradPercentile[Math.round(99 - (edgeResistance / 100) * 24)];
  // Por defecto, media diagonal: no molesta en una pared normal, pero corta la fuga.
  const maxRadius = opts.maxRadius ?? Math.sqrt(w * w + h * h) * 0.5;
  const maxR2 = maxRadius > 0 ? maxRadius * maxRadius : 0;

  // ── Flood fill (BFS, 4-conectividad) ──
  // Cola sobre un typed array: sin allocations por píxel, sin recursión (evita stack overflow).
  const queue = new Int32Array(n);
  let head = 0;
  let tail = 0;
  queue[tail++] = seed;
  mask[seed] = 1;

  while (head < tail) {
    const i = queue[head++];
    const x = i % w;
    const y = (i - x) / w;

    // Vecinos 4-conectados: arriba, abajo, izquierda, derecha.
    for (let k = 0; k < 4; k++) {
      let nx = x;
      let ny = y;
      if (k === 0) nx = x - 1;
      else if (k === 1) nx = x + 1;
      else if (k === 2) ny = y - 1;
      else ny = y + 1;
      if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;

      const j = ny * w + nx;
      if (mask[j]) continue;

      // Contención por distancia (ver `maxRadius`).
      if (maxR2 > 0) {
        const ddx = nx - x0;
        const ddy = ny - y0;
        if (ddx * ddx + ddy * ddy > maxR2) continue;
      }

      // (3) No cruzar bordes estructurales.
      if (grad[j] > edgeTol) continue;

      // (1) Croma contra la SEMILLA: el tono de la superficie no cambia con la luz.
      const dCb = Cb[j] - refCb;
      const dCr = Cr[j] - refCr;
      if (dCb * dCb + dCr * dCr > chromaTol * chromaTol) continue;

      // (2) Luma: paso local (sigue el degradé) + correa global (no se va al otro extremo).
      if (Math.abs(Ys[j] - Ys[i]) > pasoLuma) continue;
      if (Math.abs(Y[j] - refY) > lumaTol) continue;

      mask[j] = 1;
      queue[tail++] = j;
    }
  }

  if (holes > 0) closeHoles(mask, w, h, holes);
  return mask;
}

/**
 * Cierre morfológico: dilatar y después erosionar con el mismo radio.
 * Tapa agujeros más chicos que el radio (enchufes, motas de textura) dejando el contorno
 * exterior donde estaba.
 */
function closeHoles(mask: Uint8Array, w: number, h: number, radius: number) {
  const dilated = new Uint8Array(mask.length);
  boxMorph(mask, dilated, w, h, radius, true);
  boxMorph(dilated, mask, w, h, radius, false);
}

/**
 * Dilatación/erosión separable con ventana cuadrada.
 * Se hace en dos pasadas 1D (horizontal y vertical) en vez de una 2D: O(n·r) → O(n).
 */
function boxMorph(src: Uint8Array, dst: Uint8Array, w: number, h: number, r: number, dilate: boolean) {
  const tmp = new Uint8Array(src.length);
  const hit = dilate ? 1 : 0;

  // Horizontal
  for (let y = 0; y < h; y++) {
    const row = y * w;
    for (let x = 0; x < w; x++) {
      let v = dilate ? 0 : 1;
      for (let d = -r; d <= r; d++) {
        const xx = x + d;
        if (xx < 0 || xx >= w) continue;
        if (src[row + xx] === hit) {
          v = hit;
          break;
        }
      }
      tmp[row + x] = v;
    }
  }

  // Vertical
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let v = dilate ? 0 : 1;
      for (let d = -r; d <= r; d++) {
        const yy = y + d;
        if (yy < 0 || yy >= h) continue;
        if (tmp[yy * w + x] === hit) {
          v = hit;
          break;
        }
      }
      dst[y * w + x] = v;
    }
  }
}
