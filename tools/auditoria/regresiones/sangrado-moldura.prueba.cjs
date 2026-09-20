/**
 * Vigila que la pintura no se pase sobre la moldura clara de la foto.
 *
 * Lo que se rompía: `featherMask` difuminaba el borde de la máscara de forma simétrica,
 * ablandando el filo hacia los dos lados — así que la pintura se pasaba ~2 px sobre lo que no
 * es pared. Medido sobre la moldura clara de "01-living-luz.jpg" (franja x=70..96, y=120..730
 * en la foto original de 1200×800; ver tools/auditoria/generar.py línea 54): 16,8% de la
 * moldura terminaba con color encima. El arreglo anula el alfa fuera de la máscara
 * (`alpha[i] = mask[i] ? sum / win : 0`), dejando el difuminado sólo hacia ADENTRO: ahora 2,5%.
 *
 * Dos mediciones:
 *  1. % de toda la franja de moldura con un cambio de color notorio (umbral 6%: si empeora,
 *     el difuminado volvió a ser simétrico).
 *  2. Perfil del filo: las dos columnas de moldura pegadas a la pared seleccionada (1 y 2 px
 *     "hacia afuera" de la máscara), en varias alturas — ahí no debería haber NINGÚN cambio,
 *     ni parcial. Es más exigente que el promedio: un filo manchado en una sola franja angosta
 *     puede diluirse en el porcentaje global y no en este perfil.
 *
 * Necesita la foto 01-living-luz.jpg (pnpm fotos-prueba).
 */
const fs = require("fs");
const FOTOS = __dirname + "/../../../.fotos-prueba";

const UMBRAL_MANCHADO = 0.06; // hoy da ~2.5%; antes del arreglo, 16.8%
const UMBRAL_FILO = 12; // mismo umbral de "cambio notorio" que el resto de las pruebas del simulador
const ORIG_W = 1200;
const ORIG_H = 800;
const MOLDURA = { x0: 70, x1: 96, y0: 120, y1: 730 }; // igual que generar.py línea 54

module.exports = {
  nombre: "simulador · la pintura no se pasa sobre la moldura clara",

  async correr(t, { k }) {
    const foto = `${FOTOS}/01-living-luz.jpg`;
    if (!fs.existsSync(foto)) {
      t.nota(`falta ${foto}: correr "pnpm fotos-prueba"`);
      return;
    }

    const { browser, page } = await k.abrir({ movil: false });
    try {
      await k.ir(page, "/simulador");
      await page.click('button:has-text("Azul Profundo")'); // fuerte contraste contra pared y moldura
      await page.setInputFiles("input[type=file]", foto);
      await page.waitForSelector("canvas", { timeout: 40000 });
      await page.waitForTimeout(2000);

      await page.evaluate(() => {
        const c = document.querySelector("canvas");
        window.__antes = c.getContext("2d", { willReadFrequently: true }).getImageData(0, 0, c.width, c.height).data.slice();
        c.scrollIntoView({ block: "center" });
      });
      await page.waitForTimeout(500);

      const caja = await page.locator("canvas").boundingBox();
      // Mismo punto de clic que "simulador-calidad": pared abierta que llega hasta el borde
      // derecho de la moldura en toda su altura.
      await page.mouse.click(caja.x + caja.width * 0.22, caja.y + caja.height * 0.35);
      await page.waitForTimeout(2200);

      const medido = await page.evaluate(
        ({ ORIG_W, ORIG_H, MOLDURA }) => {
          const c = document.querySelector("canvas");
          const ahora = c.getContext("2d", { willReadFrequently: true }).getImageData(0, 0, c.width, c.height).data;
          const antes = window.__antes;
          const W = c.width;
          const H = c.height;
          const sx = W / ORIG_W;
          const sy = H / ORIG_H;
          const cambio = (x, y) => {
            const i = (y * W + x) * 4;
            return Math.abs(ahora[i] - antes[i]) + Math.abs(ahora[i + 1] - antes[i + 1]) + Math.abs(ahora[i + 2] - antes[i + 2]);
          };

          const x0 = Math.max(0, Math.round(MOLDURA.x0 * sx));
          const x1 = Math.min(W - 1, Math.round(MOLDURA.x1 * sx));
          const y0 = Math.max(0, Math.round(MOLDURA.y0 * sy));
          const y1 = Math.min(H - 1, Math.round(MOLDURA.y1 * sy));

          let manchados = 0;
          let total = 0;
          for (let y = y0; y <= y1; y++) {
            for (let x = x0; x <= x1; x++) {
              total++;
              if (cambio(x, y) > 12) manchados++;
            }
          }

          // Filo: última columna de moldura (toca la pared seleccionada) y la anterior,
          // en 9 alturas repartidas en toda la franja.
          const filo = x1;
          let maxCambioBorde = 0;
          for (let f = 0.1; f <= 0.9; f += 0.1) {
            const y = Math.round(y0 + f * (y1 - y0));
            for (const dx of [0, 1]) {
              const x = filo - dx;
              if (x < 0) continue;
              maxCambioBorde = Math.max(maxCambioBorde, cambio(x, y));
            }
          }

          return { manchados, total, maxCambioBorde };
        },
        { ORIG_W, ORIG_H, MOLDURA },
      );

      const pct = medido.total ? medido.manchados / medido.total : 0;
      t.nota(
        `moldura manchada: ${(pct * 100).toFixed(1)}% (${medido.manchados}/${medido.total} px) · ` +
          `máximo cambio en el filo, 1-2 px hacia afuera de la máscara: ${medido.maxCambioBorde.toFixed(1)}`,
      );
      t.cierto(
        pct <= UMBRAL_MANCHADO,
        `${(pct * 100).toFixed(1)}% de la moldura quedó manchada (umbral ${UMBRAL_MANCHADO * 100}%): el difuminado se está pasando hacia afuera de la selección otra vez`,
      );
      t.cierto(
        medido.maxCambioBorde <= UMBRAL_FILO,
        `el filo de la moldura (1-2 px hacia afuera de la máscara) cambió de color (delta ${medido.maxCambioBorde.toFixed(1)}, umbral ${UMBRAL_FILO}): el difuminado dejó de ser sólo hacia adentro`,
      );
    } finally {
      await browser.close();
    }
  },
};
