/**
 * ¿Cuánta textura de la pared sobrevive al pintar, según el color elegido?
 * Mide el desvío estándar de la luminosidad PERCEPTUAL (OKLab L) dentro de la zona
 * pintada, antes y después. Si el simulador es predecible, la retención debería ser
 * parecida para todos los colores.
 */
const k = require("/workspaces/codespaces-blank/.auditoria/kit/navegador.cjs");
const FOTOS = "/workspaces/codespaces-blank/.auditoria/fotos";

const COLORES = ["Blanco Puro", "Marfil", "Arena", "Gris Perla", "Azul Profundo", "Negro Mate"];

(async () => {
  const { browser, page, eventos } = await k.abrir({ movil: false });
  const filas = [];
  try {
    await k.ir(page, "/simulador");
    await page.setInputFiles('input[type=file]', `${FOTOS}/01-living-luz.jpg`);
    await page.waitForSelector("canvas", { timeout: 40000 });
    await page.waitForTimeout(2500);
    await page.click('button:has-text("Blanco Puro")');
    await page.waitForTimeout(600);

    // base + clic en la pared
    await page.evaluate(() => {
      const c = document.querySelector("canvas");
      window.__antes = c.getContext("2d", { willReadFrequently: true }).getImageData(0, 0, c.width, c.height).data.slice();
      window.__okL = (r, g, b) => {
        const f = (v) => { v /= 255; return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
        const R = f(r), G = f(g), B = f(b);
        const l = Math.cbrt(0.4122214708 * R + 0.5363325363 * G + 0.0514459929 * B);
        const m = Math.cbrt(0.2119034982 * R + 0.6806995451 * G + 0.1073969566 * B);
        const s = Math.cbrt(0.0883024619 * R + 0.2817188376 * G + 0.6299787005 * B);
        return 0.2104542553 * l + 0.7936177850 * m - 0.0040720468 * s;
      };
    });
    await page.evaluate(() => document.querySelector("canvas").scrollIntoView({ block: "center" }));
    await page.waitForTimeout(400);
    const box = await page.locator("canvas").boundingBox();
    await page.mouse.click(box.x + box.width * 0.22, box.y + box.height * 0.35);
    await page.waitForTimeout(2000);

    // zona pintada, fijada con el primer color
    await page.evaluate(() => {
      const c = document.querySelector("canvas");
      const ahora = c.getContext("2d", { willReadFrequently: true }).getImageData(0, 0, c.width, c.height).data;
      const zona = new Uint8Array(c.width * c.height);
      for (let i = 0, p = 0; p < zona.length; p++, i += 4) {
        const d = Math.abs(ahora[i] - window.__antes[i]) + Math.abs(ahora[i+1] - window.__antes[i+1]) + Math.abs(ahora[i+2] - window.__antes[i+2]);
        if (d > 12) zona[p] = 1;
      }
      // Sacar los píxeles del borde: ahí la máscara está difuminada y cada píxel es una
      // mezcla entre pared y pintura, así que infla la variación y castiga a los colores
      // más lejanos del color original de la pared. Erosión de 4 px.
      const W = c.width, H = c.height, R = 4;
      const dentro = new Uint8Array(zona.length);
      for (let y = 0; y < H; y++) {
        for (let x = 0; x < W; x++) {
          const i = y * W + x;
          if (!zona[i]) continue;
          let ok = 1;
          for (let dy = -R; dy <= R && ok; dy++) {
            for (let dx = -R; dx <= R; dx++) {
              const nx = x + dx, ny = y + dy;
              if (nx < 0 || ny < 0 || nx >= W || ny >= H || !zona[ny * W + nx]) { ok = 0; break; }
            }
          }
          dentro[i] = ok;
        }
      }
      window.__zona = dentro;
    });

    for (const nombre of COLORES) {
      await page.click(`button:has-text("${nombre}")`);
      await page.waitForTimeout(1200);
      filas.push({ color: nombre, ...(await page.evaluate(() => {
        const c = document.querySelector("canvas");
        const ahora = c.getContext("2d", { willReadFrequently: true }).getImageData(0, 0, c.width, c.height).data;
        const antes = window.__antes, zona = window.__zona, okL = window.__okL;
        let n = 0, sA = 0, sD = 0, s2A = 0, s2D = 0, iguales = 0;
        const vistos = new Set();
        for (let p = 0, i = 0; p < zona.length; p++, i += 4) {
          if (!zona[p]) continue;
          const a = okL(antes[i], antes[i+1], antes[i+2]);
          const d = okL(ahora[i], ahora[i+1], ahora[i+2]);
          n++; sA += a; sD += d; s2A += a*a; s2D += d*d;
          const clave = (ahora[i] << 16) | (ahora[i+1] << 8) | ahora[i+2];
          if (vistos.has(clave)) iguales++; else vistos.add(clave);
        }
        const sdA = Math.sqrt(s2A/n - (sA/n)**2), sdD = Math.sqrt(s2D/n - (sD/n)**2);
        return {
          luzMedia: +(sD/n).toFixed(3),
          texturaAntes: +sdA.toFixed(4),
          texturaDespues: +sdD.toFixed(4),
          retencion: +(sdD/sdA).toFixed(3),
          coloresDistintos: vistos.size,
        };
      })) });
    }
    console.log(JSON.stringify({ filas, js: eventos.jsErrors.slice(0,3) }, null, 2));
  } finally { await browser.close(); }
})();
