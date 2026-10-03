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
