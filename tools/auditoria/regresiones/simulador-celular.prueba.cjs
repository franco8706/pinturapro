/**
 * Vigila que en el celular se puedan ver la pared y los colores a la vez.
 *
 * Hasta el 3/10/2026, en una pantalla de 390×844 la foto terminaba en y=777 y el primer color
 * empezaba en y=1407: cada prueba de color era bajar, tocar el color y volver a subir para ver la
 * pared (medido por `simulador-uso-real`). Ahora hay una tira de colores pegada a la foto.
 *
 * Necesita las fotos sintéticas: python3 tools/auditoria/generar.py
 */
const fs = require("fs");
const FOTOS = __dirname + "/../../../.fotos-prueba";

module.exports = {
  nombre: "simulador · en el celular la tira de colores queda pegada a la foto y pinta",

  async correr(t, { k }) {
    if (!fs.existsSync(`${FOTOS}/02-pared-plana.jpg`)) {
      t.nota("faltan las fotos de prueba: python3 tools/auditoria/generar.py");
      return;
    }
    const { browser, page } = await k.abrir({ movil: true });
    try {
      await k.ir(page, "/simulador");
      await page.setInputFiles("input[type=file]", `${FOTOS}/02-pared-plana.jpg`);
      await page.waitForSelector("canvas", { timeout: 40000 });
      await page.waitForTimeout(1200);
      const tira = page.locator('[role=group][aria-label="Colores"] button[aria-label="Verde Agua"]');
      t.cierto((await tira.count()) === 1, "no hay tira de colores debajo de la foto en el celular");
      if ((await tira.count()) !== 1) return;
      const distancia = await page.evaluate(() => {
        const lienzo = document.querySelector("canvas").getBoundingClientRect();
        const boton = document.querySelector('[role=group][aria-label="Colores"] button').getBoundingClientRect();
        return Math.round(boton.top - lienzo.bottom);
      });
      t.nota(`de la foto al primer color: ${distancia} px`);
      t.cierto(distancia >= 0 && distancia < 120, `el primer color queda a ${distancia} px de la foto (antes, 630): no se ven juntos`);

      // Tocar la pared y después el color de la tira: la pared se pinta.
      await page.evaluate(() => {
        const c = document.querySelector("canvas");
        window.__antes = c.getContext("2d", { willReadFrequently: true }).getImageData(0, 0, c.width, c.height).data.slice();
        c.scrollIntoView({ block: "center" });
      });
      await page.waitForTimeout(300);
      const b = await page.locator("canvas").boundingBox();
      await page.touchscreen.tap(b.x + b.width * 0.4, b.y + b.height * 0.5);
      await page.waitForTimeout(1500);
      await tira.tap();
      await page.waitForTimeout(800);
      const visto = await page.evaluate(() => {
        const c = document.querySelector("canvas"), x = Math.round(c.width * 0.4), y = Math.round(c.height * 0.5);
        const d = c.getContext("2d", { willReadFrequently: true }).getImageData(x, y, 1, 1).data;
        return [d[0], d[1], d[2]];
      });
      const verde = [168, 199, 187];
      const lejos = Math.hypot(visto[0] - verde[0], visto[1] - verde[1], visto[2] - verde[2]);
      t.cierto(lejos < 30, `tocar Verde Agua en la tira dejó la pared en ${visto}, lejos de Verde Agua (${verde})`);
      t.cierto((await tira.getAttribute("aria-pressed")) === "true", "el color elegido en la tira no queda marcado (aria-pressed)");
      // La Intensidad también va pegada a la foto: en la ficha del color quedaba 1.000 px más abajo
      // y se movía sin ver la pared (`rendimiento`, 4/10).
      const lejosIntensidad = await page.evaluate(() => {
        const lienzo = document.querySelector("canvas").getBoundingClientRect();
        const r = [...document.querySelectorAll("input[type=range]")].find(
          (x) => x.offsetParent !== null && /Intensidad/.test(x.closest("label")?.innerText || ""),
        );
        return r ? Math.round(r.getBoundingClientRect().top - lienzo.bottom) : null;
      });
      t.nota(`de la foto al control de Intensidad: ${lejosIntensidad} px`);
      t.cierto(lejosIntensidad !== null && lejosIntensidad >= 0 && lejosIntensidad < 200, `en el celular el control de Intensidad queda a ${lejosIntensidad} px de la foto: se mueve sin ver la pared`);
    } finally {
      await browser.close();
    }
  },
};
