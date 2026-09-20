/**
 * Vigila el ciclo completo de una cotización desde el lado del pintor.
 *
 * Lo que se rompió: un pintor que ya había cotizado un pedido seguía viendo "Cotizar este
 * trabajo". Completaba monto y nota, enviaba, y recién ahí la base le decía "Ya enviaste una
 * cotización para este pedido". El índice único hacía bien su trabajo; el que perdía el
 * tiempo era el pintor.
 *
 * La prueba limpia lo suyo: retira la cotización al final, así el pedido queda disponible
 * para la próxima corrida. Si algo explota a mitad de camino, el `finally` igual la retira.
 */
const { execFileSync } = require("child_process");

const MONTO = "654321";
const NOTA = "ZZAGENT regresión: cotización de prueba, se retira sola";

module.exports = {
  nombre: "cotizar · el pintor ve que ya cotizó en vez de llenar el formulario al pedo",

  async correr(t, { k, db }) {
    const { browser, page } = await k.abrir({ movil: false });
    let cotizó = false;
    try {
      await k.ingresar(page, "pintor3");
      await k.ir(page, "/trabajos");

      const titulo = await page.evaluate(() => {
        const a = [...document.querySelectorAll("article")].find((x) => /Cotizar este trabajo/.test(x.textContent));
        if (!a) return null;
        a.querySelector("button").click(); // el formulario se abre al apretar
        return a.querySelector("h2").textContent;
      });
      if (!titulo) {
        t.nota("no había ningún pedido cotizable para este pintor; la prueba no puede correr");
        return;
      }
      await page.waitForTimeout(800);

      await page.fill(`article:has-text("${titulo}") input[name=amount]`, MONTO);
      await page.fill(`article:has-text("${titulo}") textarea[name=note]`, NOTA);
      await page.click(`article:has-text("${titulo}") form button[type=submit]`);
      await page.waitForTimeout(4000);
      cotizó = true;

      // No se busca el cartel "Cotización enviada": la página se revalida sola y la tarjeta
      // pasa al estado siguiente, así que ese texto es fugaz. Lo que importa es el estado
      // final, que es lo que ve la persona.

      // Recarga de verdad: es donde antes volvía a aparecer el formulario.
      await k.ir(page, "/trabajos");
      const estado = await page.evaluate((titulo) => {
        const a = [...document.querySelectorAll("article")].find((x) => x.textContent.includes(titulo));
        return a ? { texto: a.textContent.replace(/\s+/g, " "), hayBoton: /Cotizar este trabajo/.test(a.textContent) } : null;
      }, titulo);
      if (estado) {
        t.contiene(estado.texto, "Ya cotizaste este pedido", "falta el aviso de que ya cotizó");
        t.cierto(!estado.hayBoton, "vuelve a ofrecer cotizar un pedido que este pintor ya cotizó");
      } else {
        t.nota("el pedido desapareció del tablero después de cotizar (puede ser correcto si otro lo ganó)");
      }

      // Y la cotización tiene que estar en su panel.
      await k.ir(page, "/dashboard");
      t.contiene(await page.evaluate(() => document.body.innerText), titulo.slice(0, 20), "la cotización no aparece en el panel del pintor");
    } finally {
      if (cotizó) {
        try {
          await k.ir(page, "/dashboard");
          const retirado = await page.evaluate(() => {
            const b = [...document.querySelectorAll("button")].find((x) => /Retirar cotización/.test(x.textContent));
            if (!b) return false;
            b.click();
            return true;
          });
          if (retirado) {
            await page.waitForTimeout(1200);
            // Suele pedir confirmación en línea.
            await page.evaluate(() => {
              const b = [...document.querySelectorAll("button")].find((x) => /Confirmar|Sí|Retirar/.test(x.textContent));
              if (b) b.click();
            });
            await page.waitForTimeout(3000);
          }
        } catch {
          t.nota("no pude retirar la cotización de prueba: buscá la nota que empieza con ZZAGENT");
        }
        // Retirarla la deja en 'cancelled', que no molesta a nadie pero se acumula una por
        // corrida. Con acceso a la base se borra del todo.
        if (db) {
          try {
            execFileSync("psql", [db, "-X", "-q", "-c", `delete from public.jobs where note = '${NOTA}'`], { encoding: "utf8" });
          } catch {
            t.nota("no pude borrar la fila de prueba de la base");
          }
        }
      }
      await browser.close();
    }
  },
};
