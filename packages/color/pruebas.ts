/**
 * Pruebas del motor de color del simulador. Se corren sin navegador:
 *   node packages/color/pruebas.ts
 *
 * Los archivos de `src/` se importan entre sí sin extensión (así los resuelve el empaquetador
 * de cada app); node exige la extensión, así que acá se le enseña a probar con `.ts` antes de
 * cargar nada.
 */
import { registerHooks } from "node:module";

registerHooks({
  resolve(especificador, contexto, siguiente) {
    try {
      return siguiente(especificador, contexto);
    } catch (e) {
      if (especificador.startsWith(".") && !especificador.endsWith(".ts")) return siguiente(`${especificador}.ts`, contexto);
      throw e;
    }
  },
});

const { rgbAOklab, oklabASrgb, rgbAOklch } = await import("./src/oklab.ts");
const P = await import("./src/pintura.ts");
// VARITA_DE permite correr las pruebas de la varita contra otra versión del archivo (para verlas
// fallar contra la de antes de un arreglo): VARITA_DE=/ruta/magic-wand.ts node packages/color/pruebas.ts
const V = await import(process.env.VARITA_DE ?? "./src/magic-wand.ts");
const { rellenarPoligono } = await import("./src/poligono.ts");
const { alfaDeLaSeleccion } = await import("./src/borde.ts");

let fallas = 0;
let pruebas = 0;
function cierto(condicion: boolean, que: string) {
  pruebas++;
  if (!condicion) {
    console.log(`  ✗ ${que}`);
    fallas++;
  }
}
function nota(texto: string) {
  console.log(`  · ${texto}`);
}

// ── Paredes sintéticas, deterministas ─────────────────────────────────────────
let semilla = 7;
const azar = () => (semilla = (semilla * 16807) % 2147483647) / 2147483647;
const gauss = () => Math.sqrt(-2 * Math.log(azar() + 1e-12)) * Math.cos(2 * Math.PI * azar());

/** Una pared de `ancho`×`alto` con degradé de luz (de `luzMin` a `luzMax`) y grano. */
function pared(base: [number, number, number], ancho: number, alto: number, grano: number, luzMin: number, luzMax: number) {
  const rgba = new Uint8ClampedArray(ancho * alto * 4);
  for (let y = 0; y < alto; y++) {
    for (let x = 0; x < ancho; x++) {
      const k = luzMin + (luzMax - luzMin) * (x / ancho);
      const e = gauss() * grano;
      const p = (y * ancho + x) * 4;
      rgba[p] = base[0] * k + e;
      rgba[p + 1] = base[1] * k + e;
      rgba[p + 2] = base[2] * k + e;
      rgba[p + 3] = 255;
    }
  }
  return rgba;
}

/** Máscara suave: todo pintado salvo un marco de 6 px, con un borde de 2 px difuminado. */
function mascara(ancho: number, alto: number) {
  const alfa = new Float32Array(ancho * alto);
  for (let y = 0; y < alto; y++) {
    for (let x = 0; x < ancho; x++) {
      const d = Math.min(x, y, ancho - 1 - x, alto - 1 - y) - 6;
      alfa[y * ancho + x] = d < 0 ? 0 : d >= 2 ? 1 : (d + 1) / 3;
    }
  }
  return alfa;
}

const W = 160;
const H = 100;
const PAREDES: Record<string, Uint8ClampedArray> = {
  "blanca pareja": pared([228, 225, 218], W, H, 3, 1, 1),
  "beige con luz de ventana": pared([196, 188, 174], W, H, 4, 0.75, 1.2),
  "azul grisácea oscura": pared([96, 104, 118], W, H, 4, 0.85, 1.15),
  roja: pared([168, 52, 44], W, H, 4, 0.9, 1.1),
};
const COLORES = ["#FAFAF7", "#F1E9D2", "#A9C6DC", "#A8C7BB", "#EBC2A0", "#9FB86B", "#D9A441", "#B5623F", "#2F5D50", "#28415F", "#6E2F33", "#1C1C1A"];

// ── 1. Las cuentas de OKLab ───────────────────────────────────────────────────
console.log("OKLab");
{
  // Valores de referencia publicados por Björn Ottosson para los primarios de sRGB.
  const ref: [number[], number[]][] = [
    [[255, 255, 255], [1.0, 0, 0]],
    [[255, 0, 0], [0.627955, 0.224863, 0.125846]],
    [[0, 255, 0], [0.86644, -0.233888, 0.179498]],
    [[0, 0, 255], [0.452014, -0.032457, -0.311528]],
  ];
  for (const [rgb, lab] of ref) {
    const [L, a, b] = rgbAOklab(rgb[0], rgb[1], rgb[2]);
    cierto(Math.abs(L - lab[0]) < 2e-4 && Math.abs(a - lab[1]) < 2e-4 && Math.abs(b - lab[2]) < 2e-4, `OKLab de ${rgb} = ${lab} (dio ${[L, a, b].map((v) => v.toFixed(6))})`);
  }
  // Ida y vuelta con una muestra grande de la pantalla: ningún canal se corre más de 1 nivel.
  let peor = 0;
  for (let r = 0; r < 256; r += 5) {
    for (let g = 0; g < 256; g += 5) {
      for (let b = 0; b < 256; b += 5) {
        const [L, a, bb] = rgbAOklab(r, g, b);
        const [r2, g2, b2] = oklabASrgb(L, a, bb);
        peor = Math.max(peor, Math.abs(r2 - r), Math.abs(g2 - g), Math.abs(b2 - b));
      }
    }
  }
  nota(`ida y vuelta sRGB → OKLab → sRGB: el peor canal se corre ${peor.toFixed(3)} niveles`);
  cierto(peor <= 1, `la ida y vuelta corre un canal ${peor.toFixed(3)} niveles (máximo 1)`);
}

// ── 1 bis. Lo que no entra en la pantalla pierde saturación, no tono ──────────────
// `oklabASrgb` baja el croma hasta que el color entre. El margen de "entra" estaba en luz
// LINEAL (0,5/255), que cerca del negro son 6,5 niveles de pantalla: un oscuro saturado que se
// salía por poco pasaba por bueno, y el recorte canal por canal le corría el tono (Rojo Teja
// en sombra, ΔE 2,5; medido por `simulador-fidelidad`, 3/10/2026).
console.log("Gama");
{
  let peor = 0;
  let caso = "";
  // Desde L = 0,15: más abajo la pantalla muestra el color con 20-38 niveles de brillo y el tono
  // ya no se distingue (con el margen viejo, a L = 0,15 el tono se corría 43,5°; ahora 2,7°).
  for (let L = 0.15; L <= 0.4; L += 0.01) {
    for (let grados = 0; grados < 360; grados += 10) {
      const h = (grados * Math.PI) / 180;
      const C = 0.2; // bien afuera de la pantalla a esta luminosidad
      const [r, g, b] = oklabASrgb(L, C * Math.cos(h), C * Math.sin(h));
      const salida = rgbAOklch(r, g, b);
      if (salida.C < 0.02) continue;
      let d = Math.abs(salida.h - h) * (180 / Math.PI);
      if (d > 180) d = 360 - d;
      if (d > peor) { peor = d; caso = `L=${L.toFixed(2)} tono ${grados}°`; }
    }
  }
  nota(`al recortar la gama de oscuros saturados, el tono se corre como máximo ${peor.toFixed(2)}° (${caso})`);
  cierto(peor <= 3, `un oscuro saturado fuera de la pantalla cambia de tono ${peor.toFixed(2)}° (${caso}) en vez de perder saturación`);
}

// ── 2. La tabla da lo mismo que la cuenta exacta ──────────────────────────────
// `curva` resuelve la pintura una vez por color y cada píxel interpola. Esta es la misma cuenta
// hecha píxel por píxel, sin tabla: si se apartan, la tabla está mal. (Hasta el 3/10/2026 esta
// sección comparaba contra el `repaint` que vivía en photo-simulator.tsx: daban igual —398 de
// 9,2 millones de canales a 1 nivel— y así se comprobó el traslado, commit 08737d4.)
function pintarExacto(src: Uint8ClampedArray, alfa: Float32Array, hex: string, intensidad: number) {
  const n = alfa.length;
  const foto = P.fotoPerceptual(src, n);
  const pintura = P.pinturaDesdeHex(hex)!;
  const anclaPared = P.ancla(foto, alfa, pintura);
  const data = new Uint8ClampedArray(src);
  const tl = pintura.L;
  const up = 1 - tl;
  const down = tl;
  for (let i = 0; i < n; i++) {
    const a0 = alfa[i];
    if (a0 <= 0) continue;
    const ol = foto.L[i];
    const shade = (ol - anclaPared) * P.CONTRASTE;
    let nl: number;
    if (shade >= 0) nl = up > 1e-6 ? tl + up * Math.tanh(shade / up) : tl;
    else nl = down > 1e-6 ? tl - down * Math.tanh(-shade / down) : tl;
    const nc = tl > 1e-6 ? (pintura.C * nl) / tl : pintura.C;
    const a = a0 * intensidad;
    const ia = 1 - a;
    const [fr, fg, fb] = oklabASrgb(nl * a + ol * ia, nc * pintura.cos * a + foto.ab[i * 2] * ia, nc * pintura.sen * a + foto.ab[i * 2 + 1] * ia);
    data[i * 4] = fr;
    data[i * 4 + 1] = fg;
    data[i * 4 + 2] = fb;
  }
  return data;
}

function pintarConMotor(src: Uint8ClampedArray, alfa: Float32Array, hex: string, intensidad: number) {
  const foto = P.fotoPerceptual(src, alfa.length);
  const pintura = P.pinturaDesdeHex(hex)!;
  const curva = P.curva(pintura, P.ancla(foto, alfa, pintura));
  const destino = new Uint8ClampedArray(src.length);
  P.componer(destino, src, foto, [{ alfa, curva }], intensidad, W);
  return destino;
}

console.log("La tabla contra la cuenta exacta");
{
  const alfa = mascara(W, H);
  let peor = 0;
  let distintos = 0;
  let total = 0;
  for (const src of Object.values(PAREDES)) {
    for (const hex of COLORES) {
      for (const intensidad of [1, 0.9, 0.4]) {
        const exacto = pintarExacto(src, alfa, hex, intensidad);
        const motor = pintarConMotor(src, alfa, hex, intensidad);
        for (let i = 0; i < exacto.length; i++) {
          const d = Math.abs(exacto[i] - motor[i]);
          if (d > 0) distintos++;
          peor = Math.max(peor, d);
          total++;
        }
      }
    }
  }
  nota(`${total} canales comparados: ${distintos} distintos, el peor por ${peor} nivel(es)`);
  cierto(peor <= 1, `la tabla se aparta ${peor} niveles de la cuenta exacta (máximo 1)`);
  cierto(distintos / total < 0.02, `la tabla difiere en ${((distintos / total) * 100).toFixed(2)}% de los canales (máximo 2%)`);
}

// ── 2 bis. El color de la pared es el de la muestra ───────────────────────────
// La promesa del simulador. Hasta el 3/10/2026 no se cumplía: la Intensidad arrancaba en 90 %
// (el 10 % restante lo ponía la pared vieja) y el croma bajaba según la distancia a L = 0,5,
// así que los claros salían más grises que su muestra aun en una pared perfecta (ΔE hasta 2,2
// al 100 %). Se mide la mediana de la pared pintada, sin borde, en ΔE2000.
function lab([r, g, b]: number[]) {
  const f = (v: number) => ((v /= 255) <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
  const R = f(r), G = f(g), B = f(b);
  const X = (0.4124 * R + 0.3576 * G + 0.1805 * B) / 0.95047;
  const Y = 0.2126 * R + 0.7152 * G + 0.0722 * B;
  const Z = (0.0193 * R + 0.1192 * G + 0.9505 * B) / 1.08883;
  const t = (v: number) => (v > 216 / 24389 ? Math.cbrt(v) : ((24389 / 27) * v + 16) / 116);
  return [116 * t(Y) - 16, 500 * (t(X) - t(Y)), 200 * (t(Y) - t(Z))];
}
function deltaE2000(c1: number[], c2: number[]) {
  const [L1, a1, b1] = lab(c1), [L2, a2, b2] = lab(c2);
  const rad = Math.PI / 180;
  const Cm = (Math.hypot(a1, b1) + Math.hypot(a2, b2)) / 2;
  const G = 0.5 * (1 - Math.sqrt(Cm ** 7 / (Cm ** 7 + 25 ** 7)));
  const a1p = (1 + G) * a1, a2p = (1 + G) * a2;
  const C1p = Math.hypot(a1p, b1), C2p = Math.hypot(a2p, b2);
  const h = (b: number, a: number) => { const x = Math.atan2(b, a) / rad; return x < 0 ? x + 360 : x; };
  const h1p = h(b1, a1p), h2p = h(b2, a2p);
  let dhp = 0;
  if (C1p * C2p) { dhp = h2p - h1p; if (dhp > 180) dhp -= 360; else if (dhp < -180) dhp += 360; }
  const dLp = L2 - L1, dCp = C2p - C1p, dHp = 2 * Math.sqrt(C1p * C2p) * Math.sin((dhp / 2) * rad);
  const Lpm = (L1 + L2) / 2, Cpm = (C1p + C2p) / 2;
  let hpm = h1p + h2p;
  if (C1p * C2p) { if (Math.abs(h1p - h2p) > 180) hpm += h1p + h2p < 360 ? 360 : -360; hpm /= 2; }
  const T = 1 - 0.17 * Math.cos((hpm - 30) * rad) + 0.24 * Math.cos(2 * hpm * rad) + 0.32 * Math.cos((3 * hpm + 6) * rad) - 0.2 * Math.cos((4 * hpm - 63) * rad);
  const Rc = 2 * Math.sqrt(Cpm ** 7 / (Cpm ** 7 + 25 ** 7));
  const Rt = -Math.sin(2 * 30 * Math.exp(-(((hpm - 275) / 25) ** 2)) * rad) * Rc;
  const Sl = 1 + (0.015 * (Lpm - 50) ** 2) / Math.sqrt(20 + (Lpm - 50) ** 2), Sc = 1 + 0.045 * Cpm, Sh = 1 + 0.015 * Cpm * T;
  return Math.sqrt((dLp / Sl) ** 2 + (dCp / Sc) ** 2 + (dHp / Sh) ** 2 + Rt * (dCp / Sc) * (dHp / Sh));
}
const hexARgbPrueba = (hex: string) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
/** Mediana por canal de lo pintado, sin el marco ni el borde difuminado. */
function medianaPintada(out: Uint8ClampedArray, alfa: Float32Array) {
  const canales: number[][] = [[], [], []];
  for (let i = 0; i < alfa.length; i++) {
    if (alfa[i] < 1) continue;
    for (let c = 0; c < 3; c++) canales[c].push(out[i * 4 + c]);
  }
  return canales.map((v) => { v.sort((p, q) => p - q); return v[v.length >> 1]; });
}

// Las 48 de la paleta, leídas de la web (si el archivo está); si no, la muestra de arriba.
let PALETA = COLORES;
try {
  const fs = await import("node:fs");
  const texto = fs.readFileSync(new URL("../../apps/web/lib/brands.ts", import.meta.url), "utf8");
  const hallados = texto.match(/hex: "#[0-9A-Fa-f]{6}"/g)?.map((m) => m.slice(6, 13)) ?? [];
  if (hallados.length >= 12) PALETA = hallados;
} catch {}

console.log(`El color de la pared es el de la muestra (${PALETA.length} colores)`);
{
  const alfa = mascara(W, H);
  // Paredes PAREJAS (grano, sin degradé de luz): ahí la mediana tiene que caer en la muestra.
  const parejas: Record<string, Uint8ClampedArray> = {
    blanca: pared([228, 225, 218], W, H, 3, 1, 1),
    roja: pared([168, 52, 44], W, H, 3, 1, 1),
    "azul oscura": pared([70, 80, 98], W, H, 3, 1, 1),
  };
  let peorMuestra = 0;
  let peorEntreParedes = 0;
  let peorCaso = "";
  for (const hex of PALETA) {
    const vistos: number[][] = [];
    for (const [nombre, src] of Object.entries(parejas)) {
      const visto = medianaPintada(pintarConMotor(src, alfa, hex, 1), alfa);
      const de = deltaE2000(hexARgbPrueba(hex), visto);
      if (de > peorMuestra) { peorMuestra = de; peorCaso = `${hex} sobre pared ${nombre} → ${visto}`; }
      vistos.push(visto);
    }
    for (let a = 0; a < vistos.length; a++) for (let b = a + 1; b < vistos.length; b++) peorEntreParedes = Math.max(peorEntreParedes, deltaE2000(vistos[a], vistos[b]));
  }
  nota(`contra la muestra, el peor: ΔE ${peorMuestra.toFixed(2)} (${peorCaso})`);
  nota(`el mismo color sobre tres paredes distintas, la peor diferencia: ΔE ${peorEntreParedes.toFixed(2)}`);
  cierto(peorMuestra <= 1, `una pared pareja pintada al 100 % se aparta de la muestra ΔE ${peorMuestra.toFixed(2)} (máximo 1): ${peorCaso}`);
  cierto(peorEntreParedes <= 1, `el mismo color se ve distinto según la pared de antes: ΔE ${peorEntreParedes.toFixed(2)} (máximo 1)`);
}

// ── 2 ter. La luz cambia la luminosidad, no el tono ───────────────────────────
console.log("Luces y sombras");
{
  let peorTono = 0;
  let peorCaso = "";
  let inversiones = 0;
  for (const hex of PALETA) {
    const pintura = P.pinturaDesdeHex(hex)!;
    const cv = P.curva(pintura, 0.6);
    let anterior = -1;
    for (let k = 0; k <= 1024; k += 8) {
      if (cv.L[k] < anterior - 1e-6) inversiones++;
      anterior = cv.L[k];
      if (pintura.C < 0.03) continue; // casi gris: el tono no se percibe
      const [r, g, b] = [cv.rgb[k * 3], cv.rgb[k * 3 + 1], cv.rgb[k * 3 + 2]];
      const { C, h } = rgbAOklch(r, g, b);
      if (C < 0.02) continue; // sombra tan profunda que ya no tiene color que medir
      const tono = Math.atan2(pintura.sen, pintura.cos);
      let d = Math.abs(h - tono) * (180 / Math.PI);
      if (d > 180) d = 360 - d;
      if (d > peorTono) { peorTono = d; peorCaso = `${hex} con la foto en L=${(k / 1024).toFixed(2)}`; }
    }
  }
  nota(`el tono se corre como máximo ${peorTono.toFixed(2)}° (${peorCaso})`);
  cierto(peorTono <= 3, `en luces o sombras el tono se corre ${peorTono.toFixed(2)}° (máximo 3°): ${peorCaso}`);
  cierto(inversiones === 0, `${inversiones} veces un píxel más claro en la foto quedó más oscuro pintado`);
}

// ── 2 quáter. La textura sobrevive igual con cualquier color ──────────────────
console.log("Textura");
{
  const alfa = mascara(W, H);
  const src = pared([200, 196, 188], W, H, 6, 1, 1);
  const okL = (d: Uint8ClampedArray, i: number) => rgbAOklab(d[i * 4], d[i * 4 + 1], d[i * 4 + 2])[0];
  const desvio = (d: Uint8ClampedArray) => {
    let s = 0, s2 = 0, n = 0;
    for (let i = 0; i < alfa.length; i++) if (alfa[i] >= 1) { const v = okL(d, i); s += v; s2 += v * v; n++; }
    return Math.sqrt(s2 / n - (s / n) ** 2);
  };
  const base = desvio(src);
  const medidas = PALETA.map((hex) => desvio(pintarConMotor(src, alfa, hex, 1)) / base);
  const min = Math.min(...medidas), max = Math.max(...medidas);
  nota(`textura conservada: entre ${min.toFixed(3)} y ${max.toFixed(3)} (objetivo ~${P.CONTRASTE})`);
  cierto(min >= 0.45 && max <= 0.7, `la textura conservada va de ${min.toFixed(3)} a ${max.toFixed(3)} (tiene que quedar entre 0,45 y 0,7 con cualquier color)`);
}

// ── 2 quinquies. La varita ────────────────────────────────────────────────────
console.log("Varita");
{
  /** Foto en escala de grises con grano: `valor(x, y)` da el gris de cada píxel. */
  const foto = (w: number, h: number, valor: (x: number, y: number) => number, grano = 2) => {
    const data = new Uint8ClampedArray(w * h * 4);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const v = valor(x, y) + gauss() * grano;
      const p = (y * w + x) * 4;
      data[p] = v; data[p + 1] = v - 3; data[p + 2] = v - 8; data[p + 3] = 255;
    }
    return V.prepareWandImage({ width: w, height: h, data } as ImageData);
  };
  const cuenta = (m: Uint8Array, w: number, x0: number, y0: number, x1: number, y1: number) => {
    let n = 0;
    for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) n += m[y * w + x];
    return n / ((x1 - x0) * (y1 - y0));
  };

  // Una pared ancha y lisa, tocada en un costado: tiene que pintarse entera. El tope de radio
  // (media diagonal) la cortaba en un arco de círculo en medio de la pared.
  {
    const w = 640, h = 200;
    const img = foto(w, h, (x) => 200 - x * 0.01);
    const m = V.magicWand(img, 20, 100, { tolerance: 26 });
    const cubierta = cuenta(m, w, 0, 0, w, h);
    nota(`pared ancha tocada en un costado: ${(cubierta * 100).toFixed(1)}% pintada`);
    cierto(cubierta >= 0.99, `una pared lisa tocada en un costado queda pintada al ${(cubierta * 100).toFixed(1)}% (se corta en arco)`);
  }

  // Pared y techo del mismo blanco, unidos por una esquina tenue (una línea un poco más oscura),
  // en una foto con muebles muy contrastados que suben el umbral de borde de la foto entera. El
  // toque en la pared no puede pasar al techo. Con la varita de antes pasaba por dos lados: la
  // línea quedaba por debajo del umbral de la foto, y el marco de la foto no tenía bordes (la
  // selección se escurría pegada a él y cruzaba la esquina ahí). Contra esa versión: techo 99 %.
  {
    const w = 400, h = 300;
    semilla = 7;
    const img = foto(w, h, (x, y) => {
      if (x >= 300) return ((x >> 2) + (y >> 2)) % 2 ? 40 : 230; // "muebles": bordes fuertes
      if (y === 100) return 196; // la esquina: una línea tenue
      return 206; // pared y techo del mismo blanco
    }, 1);
    const m = V.magicWand(img, 150, 200, { tolerance: 26 });
    const techo = cuenta(m, w, 0, 0, 300, 98);
    const pared = cuenta(m, w, 0, 103, 300, h);
    nota(`esquina tenue: pared ${(pared * 100).toFixed(1)}%, techo ${(techo * 100).toFixed(1)}%`);
    cierto(pared >= 0.95, `la pared quedó pintada al ${(pared * 100).toFixed(1)}% (mínimo 95%)`);
    cierto(techo <= 0.02, `el toque en la pared pintó el ${(techo * 100).toFixed(1)}% del techo, pasando una esquina`);
  }
}

// ── 2 sexies. Contorno ─────────────────────────────────────────────────────────
console.log("Contorno");
{
  const w = 100, h = 80;
  const contar = (m: Uint8Array) => m.reduce((a, b) => a + b, 0);
  // Un rectángulo de 30×20 desde (10, 10): exactamente 600 píxeles, ni uno de más en el borde.
  const m = new Uint8Array(w * h);
  rellenarPoligono(m, w, h, [[10, 10], [40, 10], [40, 30], [10, 30]], 1);
  cierto(contar(m) === 600, `un rectángulo de 30×20 pintó ${contar(m)} píxeles (tienen que ser 600)`);
  cierto(m[10 * w + 10] === 1 && m[29 * w + 39] === 1 && m[30 * w + 40] === 0 && m[9 * w + 10] === 0, "el borde del rectángulo cae corrido");
  // Una "L" (cóncava): el hueco de la L no se pinta.
  const l = new Uint8Array(w * h);
  rellenarPoligono(l, w, h, [[0, 0], [20, 0], [20, 40], [60, 40], [60, 60], [0, 60]], 1);
  cierto(contar(l) === 20 * 60 + 40 * 20, `una L pintó ${contar(l)} píxeles (tienen que ser 2000)`);
  cierto(l[10 * w + 40] === 0, "el hueco de una zona en L quedó pintado");
  // Quitar: el mismo rectángulo con valor 0 deja la máscara vacía. Y un polígono que se sale de
  // la foto se recorta sin romper nada.
  rellenarPoligono(m, w, h, [[10, 10], [40, 10], [40, 30], [10, 30]], 0);
  cierto(contar(m) === 0, "quitar con el mismo contorno no dejó la máscara vacía");
  const f = new Uint8Array(w * h);
  rellenarPoligono(f, w, h, [[-50, -50], [500, -50], [500, 500], [-50, 500]], 1);
  cierto(contar(f) === w * h, "un contorno más grande que la foto no la pintó entera");
  rellenarPoligono(f, w, h, [[1, 1], [2, 2]], 0);
  cierto(contar(f) === w * h, "dos puntos solos (no es una zona) tocaron la máscara");
}

// ── 2 septies. El borde: la transición se pinta en la proporción en que es pared ──
console.log("Borde");
{
  const w = 60, h = 20;
  /** Pared a la izquierda (gris `pared`), lo otro a la derecha (gris `otro`), y en x = 30 un
   *  píxel de transición que es 70 % pared. La selección llega hasta x = 29. */
  const caso = (pared: number, otro: number) => {
    const rgba = new Uint8ClampedArray(w * h * 4);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const v = x < 30 ? pared : x === 30 ? pared * 0.7 + otro * 0.3 : otro;
      const p = (y * w + x) * 4;
      rgba[p] = rgba[p + 1] = rgba[p + 2] = v;
      rgba[p + 3] = 255;
    }
    // La mezcla 70/30 se hace en luz lineal, como en una foto: así es una transición de verdad.
    const lin = (v: number) => ((v /= 255) <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
    const srgb = (v: number) => 255 * (v <= 0.0031308 ? v * 12.92 : 1.055 * v ** (1 / 2.4) - 0.055);
    for (let y = 0; y < h; y++) {
      const p = (y * w + 30) * 4;
      rgba[p] = rgba[p + 1] = rgba[p + 2] = srgb(0.7 * lin(pared) + 0.3 * lin(otro));
    }
    const mascara = new Uint8Array(w * h);
    for (let y = 0; y < h; y++) for (let x = 0; x < 30; x++) mascara[y * w + x] = 1;
    const alfa = new Float32Array(w * h);
    alfaDeLaSeleccion(mascara, alfa, P.fotoPerceptual(rgba, w * h), w, h);
    return (x: number) => alfa[10 * w + x];
  };
  // Pared oscura, lo otro claro (una pared verde oscura junto a un marco blanco).
  const a = caso(50, 225);
  nota(`borde oscuro/claro: transición ${a(30).toFixed(2)}, lo otro ${a(31).toFixed(2)} y ${a(32).toFixed(2)}, último de la pared ${a(29).toFixed(2)}`);
  cierto(a(30) > 0.55 && a(30) < 0.9, `el píxel que es 70 % pared se pinta al ${(a(30) * 100).toFixed(0)} % (tiene que rondar el 70 %): queda un contorno del color viejo`);
  cierto(a(31) === 0 && a(32) === 0, "la pintura invade lo que no es pared (el marco)");
  cierto(a(10) === 1 && a(29) > 0.5, "el interior de la pared no quedó pintado del todo");
  // Pared y techo casi iguales: no hay forma de saber la proporción; no se agrega nada.
  const b = caso(200, 206);
  cierto(b(30) === 0 && b(31) === 0, "con dos lados casi iguales, la pintura se extendió fuera de la selección");
}

// ── 2 octies. El borde no deja una línea adentro ni cruza una arista ───────────
// La varita suele frenar 1-2 px antes del objeto (ahí el gradiente ya es alto): esos píxeles
// son PARED y se pintan. Hasta el 4/10 el último píxel de la selección quedaba al 67 % por el
// difuminado hacia adentro, justo al lado de los de afuera pintados al 100 %: una línea gris de
// 1 px adentro de la pintura, en el 89 % del filo de la pared verde de r08 (`simulador-uso-real`).
// Y la desmezcla no puede saltar una arista: la tapa de una cómoda, casi del color de la pared,
// separada de ella por una línea más oscura, quedaba con pintura encima.
console.log("Borde sin línea");
{
  const w = 60, h = 20;
  const armar = (columna: (x: number) => number, hastaX: number) => {
    const rgba = new Uint8ClampedArray(w * h * 4);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const p = (y * w + x) * 4;
      rgba[p] = rgba[p + 1] = rgba[p + 2] = columna(x);
      rgba[p + 3] = 255;
    }
    const mascara = new Uint8Array(w * h);
    for (let y = 0; y < h; y++) for (let x = 0; x < hastaX; x++) mascara[y * w + x] = 1;
    const alfa = new Float32Array(w * h);
    alfaDeLaSeleccion(mascara, alfa, P.fotoPerceptual(rgba, w * h), w, h);
    return (x: number) => alfa[10 * w + x];
  };
  // Pared oscura hasta x=41; la selección llega hasta x=39 (le faltan dos píxeles de pared);
  // un objeto blanco desde x=42.
  const a = armar((x) => (x < 42 ? 50 : 230), 40);
  nota(`pared que la varita no tomó entera: ${[38, 39, 40, 41, 42].map((x) => a(x).toFixed(2)).join(" · ")} (x = 38…42)`);
  cierto(a(39) > 0.95, `el último píxel de la selección queda al ${(a(39) * 100).toFixed(0)} % entre píxeles pintados: línea gris adentro de la pintura`);
  cierto(a(40) > 0.9 && a(41) > 0.9, "los dos píxeles de pared que la varita dejó afuera no se pintan: contorno del color viejo");
  cierto(a(42) === 0, "la pintura se pasa al objeto blanco");
  // Pared gris clara (200); en x=40 una arista oscura (110); después la tapa de una cómoda casi
  // del color de la pared (206) y el frente, más oscuro (90). La selección llega hasta x=39.
  const c = armar((x) => (x < 40 ? 200 : x === 40 ? 110 : x < 44 ? 206 : 90), 40);
  nota(`arista y tapa del mueble: ${[39, 40, 41, 42].map((x) => c(x).toFixed(2)).join(" · ")} (x = 39…42)`);
  cierto(c(40) < 0.3 && c(41) === 0 && c(42) === 0, `la pintura cruza la arista y se mete en la tapa del mueble (${c(40).toFixed(2)}, ${c(41).toFixed(2)}, ${c(42).toFixed(2)})`);
}

// ── 3. Lo que no se pinta queda igual ─────────────────────────────────────────
console.log("Fuera de la máscara");
{
  const src = PAREDES["roja"];
  const alfa = mascara(W, H);
  const out = pintarConMotor(src, alfa, "#28415F", 1);
  let tocados = 0;
  for (let i = 0; i < alfa.length; i++) {
    if (alfa[i] > 0) continue;
    const p = i * 4;
    if (out[p] !== src[p] || out[p + 1] !== src[p + 1] || out[p + 2] !== src[p + 2] || out[p + 3] !== src[p + 3]) tocados++;
  }
  cierto(tocados === 0, `${tocados} píxeles fuera de la máscara cambiaron`);
  cierto(P.hexARgb("#abc")?.join() === "170,187,204", "#abc se lee como #aabbcc");
  cierto(P.hexARgb("rojo") === null && P.pinturaDesdeHex("#12345") === null, "un hex inválido no pinta");
}

console.log(fallas === 0 ? `\n✓ ${pruebas} pruebas del motor de color, todas en verde` : `\n✗ ${fallas} de ${pruebas} fallaron`);
process.exit(fallas === 0 ? 0 : 1);
