/**
 * Vigila que el simulador se pueda usar SIN mouse.
 *
 * El lienzo es un canvas y todo se hacía con clics: un canvas no entra en el recorrido del
 * tabulador, no tiene nombre y no escucha el teclado. Para quien navega con teclado —o usa un
 * lector de pantalla— el simulador entero, que es la función principal del sitio, no existía.
 * Ni siquiera había un aviso que lo dijera.
 *
 * Ahora el lienzo se enfoca con Tab, las flechas mueven una mira y Enter hace lo mismo que un
 * clic. Esta prueba no toca el mouse en ningún momento: si alguna vez vuelve a hacer falta
 * uno, falla.
 *
 * Necesita las fotos de prueba: python3 tools/auditoria/generar.py && python3 tools/auditoria/mascara.py
 */
const fs = require("fs");
const FOTOS = __dirname + "/../../../.fotos-prueba";

module.exports = {
  nombre: "simulador · se puede pintar una pared sin tocar el mouse",

  async correr(t, { k }) {
    const foto = `${FOTOS}/02-pared-plana.jpg`;
    if (!fs.existsSync(foto)) {
      t.nota(`faltan las fotos de prueba en ${FOTOS}: correr generar.py y mascara.py (ver LEEME.md)`);
      return;
    }

    const { browser, page } = await k.abrir({});
    try {
      await k.ir(page, "/simulador");
      // Subir la foto es lo único que no se hace con teclas: el diálogo de archivos es del
      // sistema operativo y no se puede manejar desde acá. El campo SÍ es alcanzable con Tab
      // (por eso está `sr-only` y no `hidden`), que es lo que importa.
      await page.setInputFiles("input[type=file]", foto);
      await page.waitForSelector("canvas", { timeout: 40000 });
      await page.waitForTimeout(1200);

      // ── 1. ¿Se llega al lienzo tabulando? ──
      const llegada = await page.evaluate(() => {
        const c = document.querySelector("canvas");
        return {
          enfocable: c ? c.tabIndex >= 0 : false,
          nombre: c ? (c.getAttribute("aria-label") || "").length > 0 : false,
          ayuda: (() => {
            const id = c && c.getAttribute("aria-describedby");
            return !!(id && document.getElementById(id));
          })(),
        };
      });
      t.cierto(llegada.enfocable, "el lienzo no se puede enfocar con el teclado");
      t.cierto(llegada.nombre, "el lienzo no tiene nombre: un lector de pantalla no sabe qué es");
      t.cierto(llegada.ayuda, "el lienzo no explica cómo se maneja con teclado");

      // ── 2. Mover la mira y aplicar, sólo con teclas ──
      await page.focus("canvas");
      t.cierto(
        await page.evaluate(() => document.activeElement?.tagName === "CANVAS"),
        "el foco no se queda en el lienzo",
      );

      // La mira arranca en el centro; la bajamos un poco para caer en la pared y no en el techo.
      for (let i = 0; i < 2; i++) await page.keyboard.press("ArrowDown");
      t.cierto(
        await page.evaluate(() => !!document.querySelector('[style*="left:"][style*="top:"] .rounded-full')),
        "las flechas no dibujan ninguna mira: no hay forma de saber dónde se va a aplicar",
      );

      const antes = await page.evaluate(() => document.querySelector("canvas").toDataURL().length);
      await page.keyboard.press("Enter");
      await page.waitForTimeout(1500);

      const seleccionado = await page.evaluate(() =>
        [...document.querySelectorAll("button")].some((b) => /Limpiar selección/i.test(b.textContent || "")),
      );
      t.cierto(seleccionado, "Enter sobre el lienzo no seleccionó ninguna superficie");

      // ── 3. ¿Se entera quien no ve la pantalla? ──
      const hablado = await page.evaluate(() => {
        const vivo = document.querySelector('[role=status][aria-live]');
        return vivo ? (vivo.textContent || "").trim() : "";
      });
      t.cierto(
        /seleccionad|superficie/i.test(hablado),
        `nada se anuncia después de Enter (la zona hablada dice "${hablado}")`,
      );

      // ── 4. Elegir un color y comprobar que la foto cambió, también con teclado ──
      const enfocado = await page.evaluate(() => {
        const b = [...document.querySelectorAll("button")].find((x) => /Negro Mate/i.test(x.textContent || ""));
        if (!b) return false;
        b.focus();
        return document.activeElement === b;
      });
      t.cierto(enfocado, "el color Negro Mate no se puede enfocar con el teclado");
      await page.keyboard.press("Enter");
      await page.waitForTimeout(1200);

      const despues = await page.evaluate(() => document.querySelector("canvas").toDataURL().length);
      t.cierto(
        Math.abs(despues - antes) > 200,
        "la foto no cambió: se pudo navegar todo con teclado pero no se llegó a pintar nada",
      );
    } finally {
      await browser.close();
    }
  },
};
