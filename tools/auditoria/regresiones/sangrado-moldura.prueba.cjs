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
 * Dos mediciones (confirmado con el bug reintroducido a mano: da 19,7% y rojo en el umbral):
 *  1. % de toda la franja de moldura con un cambio de color notorio (umbral 6%: si empeora,
 *     el difuminado volvió a ser simétrico). Es la que detecta el bug histórico.
 *  2. Perfil del filo: 1 y 2 píxeles hacia adentro de la moldura, contados desde donde
 *     EMPIEZA el color de la pintura en cada fila (no desde la coordenada fotográfica fija:
 *     reducir la foto de 1200 a 1024 px ya mezcla ~1 píxel en cualquier borde nítido, pintura o
 *     no, y eso no tiene nada que ver con el bug). Ahí no debería haber NINGÚN cambio, ni
 *     parcial. Es un complemento más quirúrgico: como el filo se mide desde donde llegó la
 *     pintura, un difuminado simétrico que corre el filo entero no lo hace fallar solo (para
 *     eso está la medición 1), pero sí atraparía un sangrado asimétrico o localizado que el
 *     promedio de toda la franja diluye. La moldura tiene pared pintada de los dos lados (arriba
 *     de la moldura, entre el techo y ella, la pared es una sola franja continua), así que se
 *     mide en ambos bordes.
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

          // Filo, en 9 alturas repartidas en toda la franja. Se busca el borde REAL de la
          // pintura desde el centro de la moldura hacia cada lado (no la coordenada fotográfica
          // de generar.py: el resize a 1024 px ya mezcla ~1 píxel en el borde nítido, pintura o
          // no) y se mide el cambio 1 y 2 píxeles más allá de ese borde, hacia adentro de la
          // moldura — ahí tiene que ser exactamente cero.
          const xMid = Math.round((x0 + x1) / 2);
          let maxCambioBorde = 0;
          let bordesEncontrados = 0;
          for (let f = 0.1; f <= 0.9; f += 0.1) {
            const y = Math.round(y0 + f * (y1 - y0));

            let edgeR = -1;
            for (let x = xMid; x <= x1 + 15; x++) {
              if (cambio(x, y) > 12) { edgeR = x; break; }
            }
            let edgeL = -1;
            for (let x = xMid; x >= x0 - 15; x--) {
              if (cambio(x, y) > 12) { edgeL = x; break; }
            }

            if (edgeR >= 0) {
              bordesEncontrados++;
              maxCambioBorde = Math.max(maxCambioBorde, cambio(edgeR - 1, y), cambio(edgeR - 2, y));
            }
            if (edgeL >= 0) {
              bordesEncontrados++;
              maxCambioBorde = Math.max(maxCambioBorde, cambio(edgeL + 1, y), cambio(edgeL + 2, y));
            }
          }

          return { manchados, total, maxCambioBorde, bordesEncontrados };
        },
        { ORIG_W, ORIG_H, MOLDURA },
      );

      const pct = medido.total ? medido.manchados / medido.total : 0;
      t.nota(
        `moldura manchada: ${(pct * 100).toFixed(1)}% (${medido.manchados}/${medido.total} px) · ` +
          `bordes de pintura encontrados: ${medido.bordesEncontrados}/18 · ` +
          `máximo cambio 1-2 px hacia adentro de la moldura desde esos bordes: ${medido.maxCambioBorde.toFixed(1)}`,
      );
      t.cierto(
        medido.bordesEncontrados >= 14,
        `sólo encontré ${medido.bordesEncontrados}/18 bordes de pintura junto a la moldura: la selección no está llegando hasta ahí y el perfil del filo no está midiendo nada`,
      );
      t.cierto(
        pct <= UMBRAL_MANCHADO,
        `${(pct * 100).toFixed(1)}% de la moldura quedó manchada (umbral ${UMBRAL_MANCHADO * 100}%): el difuminado se está pasando hacia afuera de la selección otra vez`,
      );
      t.cierto(
        medido.maxCambioBorde <= UMBRAL_FILO,
        `1-2 px hacia adentro de la moldura desde el filo de la pintura cambiaron de color (delta ${medido.maxCambioBorde.toFixed(1)}, umbral ${UMBRAL_FILO}): el difuminado dejó de ser sólo hacia adentro de la máscara`,
      );
    } finally {
      await browser.close();
    }
  },
};
