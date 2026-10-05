/**
 * Vigila que el color que se ve en la pared sea el color que se eligió.
 *
 * Es la promesa entera del simulador, y hasta el 3/10/2026 no la cumplía:
 *  · La Intensidad arrancaba en 90 %, y ese 10 % que faltaba lo ponía la pared VIEJA. "Blanco
 *    Puro" sobre una pared roja salía rosado (ΔE 7,8 contra la muestra: otro color) y "Negro
 *    Mate" sobre una blanca, gris carbón (ΔE 5,4).
 *  · Los colores claros perdían saturación aun sobre una pared perfecta: el motor bajaba el
 *    croma según la distancia a la luminosidad 0,5, no según la distancia al color elegido.
 *    Marfil, Durazno, Celeste: entre 10 y 15 % más grises que la muestra.
 *
 * Mide en el navegador, con la Intensidad que trae la página: la mediana del color de la pared
 * pintada (sin los 4 px del borde, que mezclan pintura y foto) contra el hex de la muestra, en
 * ΔE2000 (< 1 no se ve; 1-2 se ve al lado; > 5 es otro color). Las fotos tienen un degradé de
 * luz suave, así que la mediana no cae exacta sobre la muestra: el umbral lo deja pasar.
 *
 * Necesita las fotos sintéticas: python3 tools/auditoria/generar.py
 */
const fs = require("fs");
const FOTOS = __dirname + "/../../../.fotos-prueba";
const MAXIMO_DE = 2;

const CASOS = [
  // [foto, color de la paleta (Alba, interior), hex] — una pared saturada y una clara
  ["04-pared-roja.jpg", "Blanco Puro", "#FAFAF7"],
  ["04-pared-roja.jpg", "Celeste Cielo", "#A9C6DC"],
  ["02-pared-plana.jpg", "Negro Mate", "#1C1C1A"],
  ["02-pared-plana.jpg", "Marfil", "#F1E9D2"],
  ["02-pared-plana.jpg", "Verde Agua", "#A8C7BB"],
];

// ── ΔE2000, sRGB D65 → CIELAB ──
function lab([r, g, b]) {
  const f = (v) => ((v /= 255) <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
  const R = f(r), G = f(g), B = f(b);
  const X = (0.4124 * R + 0.3576 * G + 0.1805 * B) / 0.95047;
  const Y = 0.2126 * R + 0.7152 * G + 0.0722 * B;
  const Z = (0.0193 * R + 0.1192 * G + 0.9505 * B) / 1.08883;
  const t = (v) => (v > 216 / 24389 ? Math.cbrt(v) : ((24389 / 27) * v + 16) / 116);
  return [116 * t(Y) - 16, 500 * (t(X) - t(Y)), 200 * (t(Y) - t(Z))];
}
function deltaE2000(c1, c2) {
  const [L1, a1, b1] = lab(c1), [L2, a2, b2] = lab(c2);
  const rad = Math.PI / 180;
  const Cm = (Math.hypot(a1, b1) + Math.hypot(a2, b2)) / 2;
  const G = 0.5 * (1 - Math.sqrt(Cm ** 7 / (Cm ** 7 + 25 ** 7)));
  const a1p = (1 + G) * a1, a2p = (1 + G) * a2;
  const C1p = Math.hypot(a1p, b1), C2p = Math.hypot(a2p, b2);
  const h = (b, a) => { const x = Math.atan2(b, a) / rad; return x < 0 ? x + 360 : x; };
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
const hexARgb = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));

module.exports = {
  nombre: "simulador · la pared pintada es del color elegido, tenga el color que tenga antes",

  async correr(t, { k }) {
    if (!fs.existsSync(`${FOTOS}/04-pared-roja.jpg`)) {
      t.nota(`faltan las fotos de prueba en ${FOTOS}: correr python3 tools/auditoria/generar.py`);
      return;
    }
    const porFoto = {};
    for (const [foto, color, hex] of CASOS) (porFoto[foto] ??= []).push([color, hex]);

    const { browser, page } = await k.abrir({ movil: false });
    try {
      for (const [foto, colores] of Object.entries(porFoto)) {
        await k.ir(page, "/simulador");
        await page.click(`button[aria-pressed]:has-text("${colores[0][0]}")`);
        await page.setInputFiles("input[type=file]", `${FOTOS}/${foto}`);
        await page.waitForSelector("canvas", { timeout: 40000 });
        await page.waitForTimeout(1500);
        await page.evaluate(() => {
          const c = document.querySelector("canvas");
          window.__antes = c.getContext("2d", { willReadFrequently: true }).getImageData(0, 0, c.width, c.height).data.slice();
          c.scrollIntoView({ block: "center" });
        });
        await page.waitForTimeout(400);
        const caja = await page.locator("canvas").boundingBox();
        await page.mouse.click(caja.x + caja.width * 0.4, caja.y + caja.height * 0.5);
        // La varita contesta desde un Web Worker: se espera a ver pintura, no un tiempo fijo.
        await page.waitForFunction(() => {
          const c = document.querySelector("canvas");
          const d = c.getContext("2d", { willReadFrequently: true }).getImageData(0, 0, c.width, c.height).data;
          let n = 0;
          for (let i = 0; i < d.length; i += 64) if (Math.abs(d[i] - window.__antes[i]) + Math.abs(d[i + 1] - window.__antes[i + 1]) + Math.abs(d[i + 2] - window.__antes[i + 2]) > 12) n++;
          return n > 500;
        }, null, { timeout: 15000 }).catch(() => {});

        for (const [color, hex] of colores) {
          await page.click(`button[aria-pressed]:has-text("${color}")`);
          await page.waitForTimeout(700);
          const mediana = await page.evaluate(() => {
            const c = document.querySelector("canvas");
            const W = c.width, H = c.height, R = 4;
            const d = c.getContext("2d", { willReadFrequently: true }).getImageData(0, 0, W, H).data;
            const a = window.__antes;
            const zona = new Uint8Array(W * H);
            for (let p = 0; p < zona.length; p++) {
              const i = p * 4;
              if (Math.abs(d[i] - a[i]) + Math.abs(d[i + 1] - a[i + 1]) + Math.abs(d[i + 2] - a[i + 2]) > 12) zona[p] = 1;
            }
            // Interior: un píxel cuenta si toda su vecindad de 4 px también está pintada.
            const canales = [[], [], []];
            for (let y = R; y < H - R; y += 2) {
              for (let x = R; x < W - R; x += 2) {
                if (!zona[y * W + x]) continue;
                let dentro = true;
                for (let dy = -R; dy <= R && dentro; dy += R) for (let dx = -R; dx <= R; dx += R) if (!zona[(y + dy) * W + x + dx]) { dentro = false; break; }
                if (!dentro) continue;
                const i = (y * W + x) * 4;
                canales[0].push(d[i]); canales[1].push(d[i + 1]); canales[2].push(d[i + 2]);
              }
            }
            if (canales[0].length < 500) return null;
            return canales.map((v) => { v.sort((p, q) => p - q); return v[v.length >> 1]; });
          });
          if (!mediana) {
            t.cierto(false, `${foto} + ${color}: el toque no pintó la pared, la prueba no puede medir`);
            continue;
          }
          const de = deltaE2000(hexARgb(hex), mediana);
          const visto = "#" + mediana.map((v) => v.toString(16).padStart(2, "0")).join("").toUpperCase();
          t.nota(`${foto} + ${color} (${hex}): la pared se ve ${visto}, ΔE ${de.toFixed(2)}`);
          t.cierto(de <= MAXIMO_DE, `${foto} pintada de ${color} (${hex}) se ve ${visto}: ΔE ${de.toFixed(2)}, más de ${MAXIMO_DE}. El color de la pared no es el elegido`);
        }
      }
    } finally {
      await browser.close();
    }
  },
};
