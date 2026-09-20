/**
 * Vigila la calidad del simulador con números, no con impresiones.
 *
 * Dos cosas que se rompieron y no se veían "rotas" en una captura:
 *  · La varita agarraba el 54% de una pared con luz de ventana (comparaba cada píxel contra
 *    el color del clic, y una pared iluminada no es un color sino un rango).
 *  · La textura que sobrevivía al pintar dependía del color elegido: 0,48 con Marfil y 0,79
 *    con Negro Mate, cuando debería ser siempre la misma. Con un color oscuro la pared salía
 *    MÁS contrastada que la foto real, que es lo que delata un montaje.
 *
 * Necesita las fotos de prueba:  python3 tools/auditoria/generar.py && python3 tools/auditoria/mascara.py
 */
const fs = require("fs");
const FOTOS = __dirname + "/../../../.fotos-prueba";
const PISO_RECALL = 0.72;      // hoy da 0,82; se avisa si baja de acá
const PISO_PRECISION = 0.95;   // hoy da 0,99
const TEXTURA_OBJETIVO = 0.63; // el factor con el que se conserva el revoque
const TEXTURA_TOLERANCIA = 0.06;

module.exports = {
  nombre: "simulador · agarra la pared y conserva la textura con cualquier color",

  async correr(t, { k }) {
    const foto = `${FOTOS}/01-living-luz.jpg`;
    if (!fs.existsSync(foto)) {
      t.nota(`faltan las fotos de prueba en ${FOTOS}: correr generar.py y mascara.py (ver LEEME.md)`);
      return;
    }
    const pared = JSON.parse(fs.readFileSync(`${FOTOS}/01-living-luz-pared.json`, "utf8"));

    const { browser, page } = await k.abrir({ movil: false });
    try {
      await k.ir(page, "/simulador");
      await page.click('button:has-text("Azul Profundo")');
      await page.setInputFiles('input[type=file]', foto);
      await page.waitForSelector("canvas", { timeout: 40000 });
      await page.waitForTimeout(2500);

      await page.evaluate(() => {
        const c = document.querySelector("canvas");
        window.__antes = c.getContext("2d", { willReadFrequently: true }).getImageData(0, 0, c.width, c.height).data.slice();
        c.scrollIntoView({ block: "center" });
      });
      await page.waitForTimeout(500);
      const caja = await page.locator("canvas").boundingBox();
      await page.mouse.click(caja.x + caja.width * 0.22, caja.y + caja.height * 0.35);
      await page.waitForTimeout(2200);

      const GX = 120, GY = 80;
      const grilla = await page.evaluate(({ GX, GY }) => {
        const c = document.querySelector("canvas");
        const ahora = c.getContext("2d", { willReadFrequently: true }).getImageData(0, 0, c.width, c.height).data;
        const antes = window.__antes;
        const acum = new Float32Array(GX * GY), tot = new Float32Array(GX * GY);
        for (let y = 0; y < c.height; y++) {
          const gy = Math.min(GY - 1, ((y / c.height) * GY) | 0);
          for (let x = 0; x < c.width; x++) {
            const gx = Math.min(GX - 1, ((x / c.width) * GX) | 0);
            const i = (y * c.width + x) * 4, g = gy * GX + gx;
            tot[g]++;
            if (Math.abs(ahora[i] - antes[i]) + Math.abs(ahora[i + 1] - antes[i + 1]) + Math.abs(ahora[i + 2] - antes[i + 2]) > 12) acum[g]++;
          }
        }
        return Array.from(acum, (v, i) => (tot[i] ? v / tot[i] : 0));
      }, { GX, GY });

      let inter = 0, pint = 0, ref = 0;
      for (let i = 0; i < grilla.length; i++) {
        inter += Math.min(grilla[i], pared[i]);
        pint += grilla[i];
        ref += pared[i];
      }
      const recall = inter / ref, precision = pint ? inter / pint : 0;
      t.nota(`pared agarrada ${(recall * 100).toFixed(1)}% · precisión ${(precision * 100).toFixed(1)}%`);
      t.cierto(recall >= PISO_RECALL, `la varita agarra ${(recall * 100).toFixed(1)}% de la pared (mínimo ${PISO_RECALL * 100}%)`);
      t.cierto(precision >= PISO_PRECISION, `precisión ${(precision * 100).toFixed(1)}% (mínimo ${PISO_PRECISION * 100}%): se está pintando lo que no es pared`);

      // Textura conservada, con varios colores: tiene que dar lo mismo con todos.
      for (const color of ["Blanco Puro", "Negro Mate"]) {
        await page.click(`button:has-text("${color}")`);
        await page.waitForTimeout(1200);
        const ret = await page.evaluate(() => {
          const c = document.querySelector("canvas");
          const ahora = c.getContext("2d", { willReadFrequently: true }).getImageData(0, 0, c.width, c.height).data;
          const antes = window.__antes;
          const okL = (r, g, b) => {
            const f = (v) => { v /= 255; return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
            const R = f(r), G = f(g), B = f(b);
            const l = Math.cbrt(0.4122214708 * R + 0.5363325363 * G + 0.0514459929 * B);
            const m = Math.cbrt(0.2119034982 * R + 0.6806995451 * G + 0.1073969566 * B);
            const s = Math.cbrt(0.0883024619 * R + 0.2817188376 * G + 0.6299787005 * B);
            return 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s;
          };
          // Sólo el interior de la zona pintada: el borde difuminado mezcla pared y pintura
          // y ensucia la medición (castiga a los colores más lejanos al de la pared).
          const W = c.width, H = c.height, R = 4;
          const zona = new Uint8Array(W * H);
          for (let p = 0, i = 0; p < zona.length; p++, i += 4) {
            if (Math.abs(ahora[i] - antes[i]) + Math.abs(ahora[i + 1] - antes[i + 1]) + Math.abs(ahora[i + 2] - antes[i + 2]) > 12) zona[p] = 1;
          }
          let n = 0, sA = 0, sD = 0, s2A = 0, s2D = 0;
          for (let y = R; y < H - R; y++) {
            for (let x = R; x < W - R; x++) {
              const i0 = y * W + x;
              if (!zona[i0]) continue;
              let dentro = true;
              for (let dy = -R; dy <= R && dentro; dy++) for (let dx = -R; dx <= R; dx++) if (!zona[(y + dy) * W + x + dx]) { dentro = false; break; }
              if (!dentro) continue;
              const i = i0 * 4;
              const a = okL(antes[i], antes[i + 1], antes[i + 2]);
              const d = okL(ahora[i], ahora[i + 1], ahora[i + 2]);
              n++; sA += a; sD += d; s2A += a * a; s2D += d * d;
            }
          }
          if (n < 100) return null;
          const sdA = Math.sqrt(s2A / n - (sA / n) ** 2), sdD = Math.sqrt(s2D / n - (sD / n) ** 2);
          return sdA > 0 ? sdD / sdA : null;
        });
        if (ret === null) { t.nota(`${color}: zona pintada muy chica para medir la textura`); continue; }
        t.nota(`textura conservada con ${color}: ${ret.toFixed(3)}`);
        t.cierto(
          Math.abs(ret - TEXTURA_OBJETIVO) <= TEXTURA_TOLERANCIA,
          `con ${color} la textura queda en ${ret.toFixed(3)} y debería estar cerca de ${TEXTURA_OBJETIVO} (si depende del color, el motor volvió a trabajar en HSL)`,
        );
      }
    } finally {
      await browser.close();
    }
  },
};
