/**
 * Vigila el cerrojo contra el doble envío.
 *
 * Lo que se rompió: tres clics seguidos en /contacto creaban TRES consultas idénticas en la
 * bandeja del dueño. `disabled={pending}` no alcanza, porque el estado de React recién se ve
 * cuando la pantalla se vuelve a dibujar: los clics del mismo instante entran todos.
 *
 * Necesita la base: lo único que prueba el arreglo es CONTAR las filas que quedaron.
 *
 * Estuvo salteada en todas las corridas desde que se escribió: pedía `psql` y una conexión
 * directa a Postgres que desde este Codespace no existe. Ahora cuenta por la API REST
 * (`base.cjs`), con la misma clave de servicio que ya usa la web.
 */

module.exports = {
  nombre: "doble envío · tres clics en contacto crean UNA sola consulta",
  necesitaBase: true,

  async correr(t, { k, base }) {
    const marca = "ZZAGENT regresion " + Date.now().toString().slice(-7);
    const filtro = `name=eq.${encodeURIComponent(marca)}`;

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
      // Esperar la confirmación, no un tiempo fijo. Con 5 segundos fijos la prueba contaba
      // ANTES de que el guardado terminara cada vez que el servidor estaba cargado (una ronda
      // con seis agentes a la vez): daba 0 consultas, falla falsa, y encima la consulta que
      // llegaba tarde quedaba sin borrar, porque la limpieza ya había pasado.
      await page
        .waitForFunction(() => /Gracias|recibimos|enviad/i.test(document.body.innerText), { timeout: 45000 })
        .catch(() => {});
      await page.waitForTimeout(1500); // por si un segundo envío (el bug) llega detrás del primero

      const filas = await base.contar("leads", filtro);
      t.igual(filas, 1, `tres clics dejaron ${filas} consultas en la bandeja (antes del arreglo eran 3)`);
    } finally {
      await browser.close();
      try {
        await base.borrar("leads", filtro);
      } catch {
        t.nota(`no pude borrar la consulta de prueba "${marca}"`);
      }
    }
  },
};
