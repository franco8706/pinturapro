/**
 * Vigila que una recarga no borre lo que la persona venía completando.
 *
 * Lo que se rompió: en /cotizar se elegía el tipo de trabajo y la superficie, se recargaba
 * —sin ningún aviso— y volvía al paso 1 en blanco. Cada recarga accidental en un celular con
 * mala señal era un pedido que nunca llegaba.
 *
 * /cotizar ya no existe: Pintura Pro es un marketplace puro y la puerta de entrada es
 * publicar un pedido (/cotizar redirige a /publicar). El borrador es el mismo mecanismo
 * (`hooks/use-borrador.ts`), así que se vigila donde vive ahora. Nada se publica: la prueba
 * recarga a mitad del formulario y nunca lo envía.
 */
module.exports = {
  nombre: "borrador · recargar a mitad del formulario no borra lo escrito",

  async correr(t, { k }) {
    const { browser, page } = await k.abrir({ movil: false });
    try {
      await k.ingresar(page, "cliente");
      await k.ir(page, "/publicar");

      // Paso 1: título y tipo de trabajo.
      const listo = await page.evaluate(() => {
        const titulo = document.querySelector('input[placeholder^="Ej:"]');
        if (!titulo) return false;
        const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set;
        set.call(titulo, "ZZAGENT borrador que sobrevive");
        titulo.dispatchEvent(new Event("input", { bubbles: true }));
        const b = [...document.querySelectorAll("button")].find((x) => x.textContent.trim().toLowerCase() === "exterior");
        if (b) b.click();
        return !!b;
      });
      if (!listo) {
        t.nota("no encontré el título o el tipo de trabajo en /publicar; el formulario cambió de forma");
        return;
      }
      await page.waitForTimeout(900); // que el borrador alcance a guardarse

      const antes = await page.evaluate(() => sessionStorage.getItem("pinturapro:publicar"));
      t.cierto(!!antes, "no se guardó ningún borrador mientras se completaba el formulario");

      // La recarga de verdad.
      await k.ir(page, "/publicar");
      const despues = await page.evaluate(() => {
        const crudo = sessionStorage.getItem("pinturapro:publicar");
        const titulo = document.querySelector('input[placeholder^="Ej:"]');
        return { borrador: crudo ? JSON.parse(crudo) : null, enPantalla: titulo ? titulo.value : null };
      });
      t.cierto(!!despues.borrador, "el borrador desapareció al recargar");
      if (despues.borrador) {
        t.igual(despues.borrador.tipo, "exterior", "el tipo de trabajo no se restauró");
        t.igual(despues.borrador.title, "ZZAGENT borrador que sobrevive", "el título no se restauró en el borrador");
      }
      t.igual(despues.enPantalla, "ZZAGENT borrador que sobrevive", "el título no volvió a aparecer en el formulario");
    } finally {
      await browser.close();
    }
  },
};
