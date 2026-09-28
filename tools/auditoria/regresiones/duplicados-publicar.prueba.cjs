/**
 * Vigila que tres clics en "Publicar trabajo" no publiquen tres pedidos.
 *
 * Lo que se rompió (commit `7f8e0c2`, "el doble clic duplicaba envíos y un fallo dejaba el
 * botón clavado"): `MultiStepForm` sólo miraba `canAdvance` para habilitar el botón del
 * último paso, y el tipo de `onComplete` (`() => void`) descartaba en silencio que la
 * implementación real fuera async. Nadie esperaba nada: un doble clic en /publicar creaba dos
 * pedidos idénticos, y como cada envío arma su propio slug, el índice único de la tabla
 * tampoco lo frenaba. El arreglo puso un cerrojo síncrono (`enVuelo`, un `useRef`) DENTRO de
 * `MultiStepForm`, compartido por todos los asistentes de varios pasos del sitio (hoy
 * /publicar y /registro).
 *
 * Que sea compartido es la razón para tener esta prueba: si el cerrojo de `MultiStepForm` se
 * rompe, se rompe para todos los formularios que lo usan a la vez, y `doble-envio` (la única
 * prueba que hoy CUENTA filas tras un triple clic) sólo mira /contacto, que ni siquiera usa
 * este componente. Nadie volvía a medir cuántas filas quedan en `projects` después de
 * apretar el botón final tres veces seguidas.
 */
module.exports = {
  nombre: "duplicados · tres clics en 'Publicar trabajo' crean UN solo pedido",
  necesitaBase: true,

  async correr(t, { k, base }) {
    const marca = "ZZAGENT triple clic " + Date.now().toString().slice(-7);
    const filtro = `title=eq.${encodeURIComponent(marca)}`;

    const { browser, page } = await k.abrir({ movil: false });
    try {
      await k.ingresar(page, "cliente2");
      await k.ir(page, "/publicar");

      // Paso 1: título + tipo.
      await page.fill('input[placeholder^="Ej:"]', marca);
      await page.locator('button:has-text("interior")').first().click();
      await page.locator('button:has-text("Continuar")').click();
      await page.waitForTimeout(400);

      // Paso 2: superficie + zona.
      await page.locator('input[type=number]').fill("40");
      await page.locator('input[placeholder*="Palermo"]').fill("ZZAGENT zona triple clic");
      await page.locator('button:has-text("Continuar")').click();
      await page.waitForTimeout(400);

      // Paso 3 (presupuesto, "A definir" ya sirve: isValid=true siempre): tres clics en el
      // mismo instante sobre "Publicar trabajo", como una persona con doble clic en el mouse
      // o una conexión lenta que hace tocar de nuevo un botón que tarda en responder.
      const boton = await page.locator('button:has-text("Publicar trabajo")').elementHandle();
      t.cierto(!!boton, "no encontré el botón 'Publicar trabajo' en el paso final");
      if (boton) {
        await page.evaluate((b) => {
          b.click();
          b.click();
          b.click();
        }, boton);
      }

      await page
        .waitForFunction(() => /Tu trabajo está publicado/i.test(document.body.innerText), { timeout: 20000 })
        .catch(() => {});
      await page.waitForTimeout(1500); // por si un segundo/tercer envío llega detrás del primero

      const filas = await base.contar("projects", filtro);
      t.igual(filas, 1, `tres clics en 'Publicar trabajo' dejaron ${filas} pedidos publicados (debería ser 1)`);
    } finally {
      await browser.close();
      try {
        await base.borrar("projects", filtro);
      } catch {
        t.nota(`no pude borrar el/los pedido(s) de prueba "${marca}"`);
      }
    }
  },
};
