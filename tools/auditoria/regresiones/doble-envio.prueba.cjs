/**
 * Vigila el cerrojo contra el doble envío.
 *
 * Lo que se rompió: tres clics seguidos en /contacto creaban TRES consultas idénticas en la
 * bandeja del dueño. `disabled={pending}` no alcanza, porque el estado de React recién se ve
 * cuando la pantalla se vuelve a dibujar: los clics del mismo instante entran todos.
 *
 * Necesita la base: lo único que prueba el arreglo es CONTAR las filas que quedaron.
 */
const { execFileSync } = require("child_process");

module.exports = {
  nombre: "doble envío · tres clics en contacto crean UNA sola consulta",
  necesitaBase: true,

  async correr(t, { k, db }) {
    const marca = "ZZAGENT regresion " + Date.now().toString().slice(-7);
    const sql = (q) => execFileSync("psql", [db, "-X", "-q", "-t", "-A", "-c", q], { encoding: "utf8" }).trim();

    const { browser, page } = await k.abrir({ movil: false });
    try {
      await k.ir(page, "/contacto");
      await page.evaluate((marca) => {
        const set = (el, v) => {
          const proto = el.tagName === "TEXTAREA" ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
          Object.getOwnPropertyDescriptor(proto, "value").set.call(el, v);
          el.dispatchEvent(new Event("input", { bubbles: true }));
        };
        const f = [...document.querySelectorAll("form")].find((x) => x.querySelector("textarea"));
        const inputs = [...f.querySelectorAll("input")];
        set(inputs[0], marca);
        set(inputs[1], "zzagent@pinturapro.demo");
        set(f.querySelector("textarea"), "ZZAGENT prueba de regresión del doble envío");
        const b = f.querySelector("button[type=submit]");
        b.click();
        b.click();
        b.click();
      }, marca);
      await page.waitForTimeout(5000);

      const filas = Number(sql(`select count(*) from public.leads where name = '${marca}'`));
      t.igual(filas, 1, `tres clics dejaron ${filas} consultas en la bandeja (antes del arreglo eran 3)`);
    } finally {
      await browser.close();
      try {
        sql(`delete from public.leads where name = '${marca}'`);
      } catch {
        t.nota(`no pude borrar la consulta de prueba "${marca}"`);
      }
    }
  },
};
