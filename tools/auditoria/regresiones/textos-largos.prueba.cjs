/**
 * Vigila que un texto larguísimo no estire las páginas públicas.
 *
 * Lo que se rompió: un pedido publicado con un título de 10.000 caracteres sin espacios dejó
 * /trabajos —que la ve cualquiera— en 254.443 px de ancho, con scroll horizontal, para TODOS
 * los visitantes. Una sola fila rompía la pantalla de todo el mundo.
 *
 * Arreglado con `overflow-wrap: anywhere` (globals.css) + topes de largo en la base (0017).
 * Acá se prueba la defensa visual, que es la que aguanta aunque entre un dato raro por
 * cualquier otro camino.
 */
const RUTAS = ["/trabajos", "/obras", "/pintores"];

module.exports = {
  nombre: "textos largos · una palabra sin espacios no estira la página",

  async correr(t, { k }) {
    for (const movil of [true, false]) {
      const { browser, page } = await k.abrir({ movil });
      const etiqueta = movil ? "celular" : "escritorio";
      try {
        for (const ruta of RUTAS) {
          await k.ir(page, ruta);
          const r = await page.evaluate(() => {
            const ventana = window.innerWidth;
            const antes = document.documentElement.scrollWidth;
            // Meter el texto donde de verdad va: los títulos de las tarjetas.
            // Cada listado arma la tarjeta a su manera: /trabajos usa <article> con h2,
            // /obras y /pintores usan un <a> con h3 adentro.
            const objetivo =
              document.querySelector("article h2") ||
              document.querySelector("main a[href^='/obras/'] h3, main a[href^='/pintor/'] h3") ||
              document.querySelector("article h3, article p");
            if (objetivo) objetivo.textContent = "X".repeat(10000);
            const despues = document.documentElement.scrollWidth;
            return { ventana, antes, despues, hubo: !!objetivo };
          });
          if (!r.hubo) {
            t.nota(`${ruta} (${etiqueta}): sin tarjetas para probar, se saltea`);
            continue;
          }
          t.cierto(
            r.despues <= r.ventana + 2,
            `${ruta} (${etiqueta}): con un texto de 10.000 caracteres la página pasó a ${r.despues} px con una ventana de ${r.ventana} px`,
          );
        }
      } finally {
        await browser.close();
      }
    }
  },
};
