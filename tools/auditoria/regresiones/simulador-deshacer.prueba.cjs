/**
 * Vigila que en el simulador se pueda volver un paso atrás.
 *
 * No existía "Deshacer": sólo "Limpiar selección", que borra todo. Un clic de más —la varita
 * agarró el techo, una pincelada se fue de la pared— obligaba a empezar de nuevo. Estuvo
 * abierto en la BITÁCORA desde las primeras rondas; se agregó el 2/10/2026, un solo nivel.
 *
 * Mide píxeles pintados (los que cambiaron respecto de la foto original), no textos:
 *   clic en la pared → hay pintura · Deshacer → no queda nada y el botón desaparece ·
 *   clic de nuevo → la misma cantidad · Limpiar selección → nada · Deshacer → vuelve igual.
 */
const fs = require("fs");
const FOTOS = __dirname + "/../../../.fotos-prueba";

module.exports = {
  nombre: "simulador · Deshacer vuelve un paso atrás, e Intensidad va después de los colores",

  async correr(t, { k }) {
    const foto = `${FOTOS}/01-living-luz.jpg`;
    if (!fs.existsSync(foto)) {
      t.nota(`faltan las fotos de prueba en ${FOTOS}: correr \`pnpm fotos-prueba\``);
      return;
    }
    const { browser, page } = await k.abrir({ movil: false });
    try {
      await k.ir(page, "/simulador");
      await page.click('button:has-text("Azul Profundo")');
      await page.setInputFiles("input[type=file]", foto);
      await page.waitForSelector("canvas", { timeout: 40000 });
      await page.waitForTimeout(2500);
      await page.evaluate(() => {
        const c = document.querySelector("canvas");
        window.__antes = c.getContext("2d", { willReadFrequently: true }).getImageData(0, 0, c.width, c.height).data.slice();
        c.scrollIntoView({ block: "center" });
      });
      await page.waitForTimeout(500);

      const pintados = () =>
        page.evaluate(() => {
          const c = document.querySelector("canvas");
          const ahora = c.getContext("2d", { willReadFrequently: true }).getImageData(0, 0, c.width, c.height).data;
          const antes = window.__antes;
          let n = 0;
          for (let i = 0; i < ahora.length; i += 4)
            if (Math.abs(ahora[i] - antes[i]) + Math.abs(ahora[i + 1] - antes[i + 1]) + Math.abs(ahora[i + 2] - antes[i + 2]) > 12) n++;
          return n;
        });
      const hayBoton = (texto) => page.evaluate((tx) => [...document.querySelectorAll("button")].some((b) => b.innerText.trim() === tx), texto);
      const clicEnLaPared = async () => {
        const caja = await page.locator("canvas").boundingBox();
        await page.mouse.click(caja.x + caja.width * 0.22, caja.y + caja.height * 0.35);
        await page.waitForTimeout(2000); // la varita contesta un instante después (Web Worker)
      };

      t.cierto(!(await hayBoton("Deshacer")), "hay un botón Deshacer antes de haber hecho nada");

      await clicEnLaPared();
      const p1 = await pintados();
      t.cierto(p1 > 1000, `el clic en la pared no pintó nada (${p1} píxeles): la prueba no puede medir`);
      t.cierto(await hayBoton("Deshacer"), "después de pintar una pared no aparece Deshacer");

      await page.click("button:has-text('Deshacer')");
      await page.waitForTimeout(800);
      t.igual(await pintados(), 0, "Deshacer no sacó la pintura del último clic");
      t.cierto(!(await hayBoton("Deshacer")), "Deshacer sigue ofreciéndose después de usarlo (es un solo nivel)");

      await clicEnLaPared();
      t.igual(await pintados(), p1, "el mismo clic, después de deshacer, pintó otra cantidad");

      await page.click("button:has-text('Limpiar selección')");
      await page.waitForTimeout(800);
      t.igual(await pintados(), 0, "Limpiar selección dejó pintura");
      await page.click("button:has-text('Deshacer')");
      await page.waitForTimeout(800);
      t.igual(await pintados(), p1, "Deshacer después de Limpiar no devolvió la selección que había");

      // De paso, el orden del teclado: "Intensidad" se usa DESPUÉS de elegir un color, y vivía
      // antes de la grilla de colores — volver costaba de 7 a 14 Shift+Tab. Ahora está después.
      const orden = await page.evaluate(() => {
        const control = [...document.querySelectorAll("input[type=range]")].find((r) =>
          /Intensidad/.test(r.closest("label")?.innerText || ""),
        );
        const colores = [...document.querySelectorAll("button")].filter((b) => /Azul Profundo|Negro Mate|Blanco Puro/.test(b.innerText));
        const ultimo = colores[colores.length - 1];
        if (!control || !ultimo) return null;
        return !!(ultimo.compareDocumentPosition(control) & Node.DOCUMENT_POSITION_FOLLOWING);
      });
      t.cierto(orden === true, "el control Intensidad no está después de los colores en el orden del teclado");
    } finally {
      await browser.close();
    }
  },
};
