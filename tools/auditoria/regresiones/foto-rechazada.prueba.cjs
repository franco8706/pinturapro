/**
 * Vigila que una foto rechazada NO deje al simulador sin salida.
 *
 * Lo que se rompía (20/9): al rechazar la foto (por tamaño o por no ser una imagen legible),
 * el estado pasaba a "error" — pero el selector de archivos sólo se dibuja en el estado
 * "empty" (ver photo-simulator.tsx, el `return` que sigue a cada `setErrorMsg`). Con "error"
 * quedaba el editor abierto con el lienzo vacío y SIN forma de elegir otra foto: la única
 * salida era recargar la página. Medido, reproducible 2 de 2.
 *
 * El arreglo vuelve a "empty" en los dos rechazos (tope de megapíxeles y archivo ilegible),
 * que es el único estado donde React dibuja el `<input type=file>`.
 *
 * Necesita la foto de 30 MP generada con `pnpm fotos-prueba` (.fotos-prueba/99-gigante.jpg).
 */
const fs = require("fs");
const os = require("os");
const path = require("path");
const FOTOS = __dirname + "/../../../.fotos-prueba";

/** Radiografía común a los dos casos: ¿quedó forma de elegir otra foto? */
async function medirPantalla(page) {
  return page.evaluate(() => {
    const input = document.querySelector("input[type=file]");
    const label = input ? input.closest("label") : null;
    const r = label ? label.getBoundingClientRect() : null;
    return {
      selectorVisible: !!r && r.width > 0 && r.height > 0,
      hayCanvas: !!document.querySelector("canvas"),
      texto: document.body.innerText || "",
    };
  });
}

module.exports = {
  nombre: "simulador · una foto rechazada deja el selector para elegir otra",

  async correr(t, { k }) {
    const gigante = `${FOTOS}/99-gigante.jpg`;
    if (!fs.existsSync(gigante)) {
      t.nota(`falta ${gigante}: correr "pnpm fotos-prueba"`);
      return;
    }

    // ---- Caso 1: foto de 30 MP (el tope es 24) ----
    {
      const { browser, page } = await k.abrir({ movil: false });
      try {
        await k.ir(page, "/simulador");
        await page.setInputFiles("input[type=file]", gigante);
        await page
          .waitForFunction(() => /demasiado grande/i.test(document.body.innerText || ""), { timeout: 20000 })
          .catch(() => {});

        const m = await medirPantalla(page);
        t.contiene(m.texto, "demasiado grande", "aviso tras subir la foto de 30 MP");
        t.cierto(
          m.selectorVisible,
          "el selector de archivos no está visible tras rechazar la foto de 30 MP (quedaría sin forma de elegir otra sin recargar la página)",
        );
        t.cierto(!m.hayCanvas, "hay un <canvas> en pantalla tras el rechazo: el editor se abrió vacío en vez de volver a la pantalla de carga");
      } finally {
        await browser.close();
      }
    }

    // ---- Caso 2: un archivo que no es una imagen, renombrado a .jpg ----
    {
      const falso = path.join(os.tmpdir(), `zzagent-no-es-imagen-${Date.now()}.jpg`);
      fs.writeFileSync(falso, "ZZAGENT esto no es una imagen, es texto plano\n".repeat(50));
      const { browser, page } = await k.abrir({ movil: false });
      try {
        await k.ir(page, "/simulador");
        await page.setInputFiles("input[type=file]", falso);
        await page
          .waitForFunction(() => /no pudimos leer esa imagen/i.test(document.body.innerText || ""), { timeout: 15000 })
          .catch(() => {});

        const m = await medirPantalla(page);
        t.contiene(m.texto, "No pudimos leer esa imagen", "aviso tras subir un archivo que no es imagen");
        t.cierto(
          m.selectorVisible,
          "el selector de archivos no está visible tras rechazar el archivo inválido (quedaría sin forma de elegir otra sin recargar la página)",
        );
        t.cierto(!m.hayCanvas, "hay un <canvas> en pantalla tras rechazar un archivo que no es imagen");
      } finally {
        await browser.close();
        fs.rmSync(falso, { force: true });
      }
    }
  },
};
