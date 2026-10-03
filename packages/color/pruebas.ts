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

// ── 2. El motor nuevo da lo mismo que el `repaint` de antes ────────────────────
// Copia literal del bucle que vivía en photo-simulator.tsx (hasta el 3/10/2026). Mientras el
// motor no cambie de modelo a propósito, cualquier diferencia es un error del traslado.
function repaintViejo(src: Uint8ClampedArray, alfa: Float32Array, hex: string, strength: number) {
  const n = alfa.length;
  const luma = new Float32Array(n);
  const croma = new Float32Array(n * 2);
  for (let i = 0; i < n; i++) {
    const [L, a, b] = rgbAOklab(src[i * 4], src[i * 4 + 1], src[i * 4 + 2]);
    luma[i] = L;
    croma[i * 2] = a;
    croma[i * 2 + 1] = b;
  }
  const data = new Uint8ClampedArray(src);
  const c = hex.replace("#", "");
  const { L: tl, C: tc, h: th } = rgbAOklch(parseInt(c.slice(0, 2), 16), parseInt(c.slice(2, 4), 16), parseInt(c.slice(4, 6), 16));
  const cosH = Math.cos(th);
  const senH = Math.sin(th);
  const pct = Math.max(12, Math.min(88, 50 + (tl - 0.5) * 70));
  const muestras: number[] = [];
  const paso = Math.max(1, Math.floor(n / 20000));
  for (let i = 0; i < n; i += paso) if (alfa[i] > 0.5) muestras.push(luma[i]);
  muestras.sort((x, y) => x - y);
  const k = (muestras.length - 1) * (pct / 100);
  const f = Math.floor(k);
  const cc = Math.min(f + 1, muestras.length - 1);
  const anchor = muestras[f] + (muestras[cc] - muestras[f]) * (k - f);
  const up = 1 - tl;
  const down = tl;
  for (let i = 0; i < n; i++) {
    const a0 = alfa[i];
    if (a0 <= 0) continue;
    const p = i * 4;
    const shade = (luma[i] - anchor) * 0.6;
    let nl: number;
    if (shade >= 0) nl = up > 1e-6 ? tl + up * Math.tanh(shade / up) : tl;
    else nl = down > 1e-6 ? tl - down * Math.tanh(-shade / down) : tl;
    const rd = Math.abs(nl - 0.5) * 2;
    const nc = tc * (1 - rd * rd * 0.35);
    const a = a0 * strength;
    const ia = 1 - a;
    const [fr, fg, fb] = oklabASrgb(nl * a + luma[i] * ia, nc * cosH * a + croma[i * 2] * ia, nc * senH * a + croma[i * 2 + 1] * ia);
    data[p] = fr;
    data[p + 1] = fg;
    data[p + 2] = fb;
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

console.log("Motor contra el repaint de antes");
{
  const alfa = mascara(W, H);
  let peor = 0;
  let distintos = 0;
  let total = 0;
  for (const src of Object.values(PAREDES)) {
    for (const hex of COLORES) {
      for (const intensidad of [0.9, 1, 0.4]) {
        const viejo = repaintViejo(src, alfa, hex, intensidad);
        const nuevo = pintarConMotor(src, alfa, hex, intensidad);
        for (let i = 0; i < viejo.length; i++) {
          const d = Math.abs(viejo[i] - nuevo[i]);
          if (d > 0) distintos++;
          peor = Math.max(peor, d);
          total++;
        }
      }
    }
  }
  nota(`${total} canales comparados: ${distintos} distintos, el peor por ${peor} nivel(es)`);
  cierto(peor <= 1, `el motor se aparta ${peor} niveles del repaint de antes (máximo 1)`);
  cierto(distintos / total < 0.02, `el motor difiere en ${((distintos / total) * 100).toFixed(2)}% de los canales (máximo 2%)`);
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
