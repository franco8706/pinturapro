/**
 * Vigila que los filtros de /obras filtren de verdad.
 *
 * Lo que se rompió: eran `<button>{categoria}</button>` sin `onClick` ni estado. Apretar
 * "Industrial" —una categoría sin ninguna obra— seguía mostrando las tres obras. Parecía que
 * andaban, y por eso pasó tanto tiempo sin que nadie lo notara.
 */
module.exports = {
  nombre: "filtros de obras · filtran, marcan el activo y avisan cuando no hay nada",

  async correr(t, { k }) {
    const { browser, page } = await k.abrir({ movil: false });
    try {
      const leer = async (ruta) => {
        await k.ir(page, ruta);
        return page.evaluate(() => ({
          tarjetas: document.querySelectorAll("a[href^='/obras/']").length,
          activo: [...document.querySelectorAll("[aria-current='page']")].map((e) => e.innerText.trim()),
          vacio: /Todavía no hay obras/.test(document.body.innerText),
        }));
      };

      const todas = await leer("/obras");
      t.igual(todas.activo, ["Todas"], "sin filtro, el botón activo debería ser 'Todas'");
      t.cierto(todas.tarjetas > 0, "no hay obras cargadas: la prueba no puede decir nada");

      const industrial = await leer("/obras?tipo=Industrial");
      t.igual(industrial.activo, ["Industrial"], "el filtro elegido no queda marcado");
      t.cierto(industrial.tarjetas < todas.tarjetas || industrial.tarjetas === 0, "el filtro no redujo la lista");
      if (industrial.tarjetas === 0) {
        t.cierto(industrial.vacio, "con cero resultados no aparece el aviso de que no hay obras de ese tipo");
      }

      // Un valor inventado en la dirección no deja la pantalla vacía sin explicación.
      const basura = await leer("/obras?tipo=no-existe-esta-categoria");
      t.igual(basura.activo, ["Todas"], "un tipo inventado debería caer en 'Todas'");
      t.igual(basura.tarjetas, todas.tarjetas, "un tipo inventado cambió la cantidad de obras");
    } finally {
      await browser.close();
    }
  },
};
