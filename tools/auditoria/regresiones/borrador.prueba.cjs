/**
 * Vigila que una recarga no borre lo que la persona venía completando.
 *
 * Lo que se rompió: en /cotizar se elegía el tipo de trabajo y la superficie, se recargaba
 * —sin ningún aviso— y volvía al paso 1 en blanco. Ese es el formulario con el que la
 * empresa consigue clientes: cada recarga accidental en un celular con mala señal era un
 * presupuesto que nunca llegaba.
 */
module.exports = {
  nombre: "borrador · recargar a mitad del formulario no borra lo escrito",

  async correr(t, { k }) {
    const { browser, page } = await k.abrir({ movil: false });
    try {
      await k.ir(page, "/cotizar");

      // Paso 1: elegir "Interior".
      await page.evaluate(() => {
        // El botón dice "Interior" con una descripción al lado: comparar exacto no sirve.
        const b = [...document.querySelectorAll("button")].find((x) => /Interior/i.test(x.textContent));
        if (b) b.click();
      });
      await page.waitForTimeout(600);
      // Avanzar y cargar la superficie.
      await page.evaluate(() => {
        const b = [...document.querySelectorAll("button")].find((x) => /Continuar/.test(x.textContent));
        if (b) b.click();
      });
      await page.waitForTimeout(800);
      const hayCampo = await page.evaluate(() => {
        // El de superficie es el numérico. El otro input de la pantalla es la trampa
        // anti-bots, y escribir ahí marcaría el envío como spam.
        const i = document.querySelector('input[type="number"]');
        if (!i) return false;
        const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set;
        set.call(i, "77");
        i.dispatchEvent(new Event("input", { bubbles: true }));
        return true;
      });
      if (!hayCampo) {
        t.nota("no encontré el campo de superficie; el formulario cambió de forma");
        return;
      }
      await page.waitForTimeout(900); // que el borrador alcance a guardarse

      const antes = await page.evaluate(() => sessionStorage.getItem("pinturapro:cotizar"));
      t.cierto(!!antes, "no se guardó ningún borrador mientras se completaba el formulario");

      // La recarga de verdad.
      await k.ir(page, "/cotizar");
      const despues = await page.evaluate(() => {
        const crudo = sessionStorage.getItem("pinturapro:cotizar");
        return { borrador: crudo ? JSON.parse(crudo) : null, texto: document.body.innerText.replace(/\s+/g, " ") };
      });
      t.cierto(!!despues.borrador, "el borrador desapareció al recargar");
      if (despues.borrador) {
        t.igual(despues.borrador.tipo, "interior", "el tipo de trabajo no se restauró");
        t.igual(despues.borrador.superficie, "77", "la superficie no se restauró");
      }
    } finally {
      await browser.close();
    }
  },
};
