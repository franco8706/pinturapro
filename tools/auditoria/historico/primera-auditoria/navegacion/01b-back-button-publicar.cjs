const k = require("/workspaces/codespaces-blank/.auditoria/kit/navegador.cjs");

(async () => {
  const { browser, page, eventos } = await k.abrir({ movil: false });
  const resultados = {};
  try {
    await k.ingresar(page, "cliente2");
    console.log("Logueado como cliente2. URL:", page.url());
    await k.ir(page, "/");
    await k.ir(page, "/publicar");

    const TITULO_PUB = "ZZAGENT pedido de prueba botón atrás";
    await page.locator('label:has-text("Título") input, input[placeholder*="Pintura interior"]').fill(TITULO_PUB);
    await page.locator('button:has-text("interior")').first().click();
    await page.locator('button:has-text("Continuar")').first().click();
    await page.waitForTimeout(500);
    resultados.publicarPaso1 = await k.auditar(page, eventos);
    console.log("Paso1 -> h1:", resultados.publicarPaso1.h1);

    await page.locator('input[type=number]').fill("50");
    await page.locator('input[placeholder*="Palermo"]').fill("ZZAGENT Zona Test");
    await page.locator('button:has-text("Continuar")').first().click();
    await page.waitForTimeout(500);
    resultados.publicarPaso2 = await k.auditar(page, eventos);
    console.log("Paso2 -> h1:", resultados.publicarPaso2.h1);

    const btnPublicar = page.locator('button:has-text("Publicar trabajo")');
    const hayBtn = await btnPublicar.count();
    console.log("¿Aparece botón 'Publicar trabajo'?", hayBtn > 0);
    if (hayBtn > 0) {
      k.limpiarEventos(eventos);
      await btnPublicar.click();
      await page.waitForTimeout(2000);
    }
    resultados.publicarTrasEnviar = { url: page.url(), ...(await k.auditar(page, eventos)) };
    const huboConfirmacion = await page.locator("text=Tu trabajo está publicado").count();
    resultados.publicarConfirmado = huboConfirmacion > 0;
    console.log("¿Confirmó 'Tu trabajo está publicado'?", huboConfirmacion > 0, "| url:", page.url());

    // Atrás tras publicar
    k.limpiarEventos(eventos);
    await page.goBack({ waitUntil: "domcontentloaded" }).catch((e) => console.log("goBack error:", e.message));
    await page.waitForTimeout(800);
    resultados.publicarTrasAtras = { url: page.url(), ...(await k.auditar(page, eventos)) };
    console.log("PUBLICAR: tras ATRÁS -> url:", page.url(), "h1:", resultados.publicarTrasAtras.h1);

    // ¿El formulario, si vuelve, conserva los datos que se habían cargado, o aparece vacío
    // insinuando que se puede volver a completar y publicar por segunda vez?
    const tituloResidual = await page.locator('input[placeholder*="Pintura interior"]').inputValue().catch(() => null);
    resultados.tituloResidualTrasAtras = tituloResidual;
    console.log("¿El campo Título en la pantalla de ATRÁS conserva 'ZZAGENT...'?", tituloResidual);

    // Adelante: ¿vuelve a la confirmación, o intenta re-publicar?
    k.limpiarEventos(eventos);
    await page.goForward({ waitUntil: "domcontentloaded" }).catch((e) => console.log("goForward error:", e.message));
    await page.waitForTimeout(800);
    resultados.publicarTrasAdelante = { url: page.url(), ...(await k.auditar(page, eventos)) };
    console.log("PUBLICAR: tras ADELANTE -> url:", page.url(), "h1:", resultados.publicarTrasAdelante.h1);

    // Verificación real: ¿se publicó UNA sola vez o dos (por el back+forward)?
    const cotiz = await page.context().newPage();
    await cotiz.goto("http://localhost:3000/cotizaciones", { waitUntil: "domcontentloaded" });
    // cotizaciones no lista pedidos sin cotizar; en su lugar reviso /trabajos como pintor sería
    // otro rol. En cambio, contamos cuántas veces aparece el título en el propio panel de cliente.
    const panelCliente = await page.context().newPage();
    await panelCliente.goto("http://localhost:3000/cliente", { waitUntil: "domcontentloaded" });
    const apariciones = await panelCliente.locator(`text=${TITULO_PUB}`).count();
    resultados.aparicionesEnPanelCliente = apariciones;
    console.log(`¿Cuántas veces aparece "${TITULO_PUB}" en /cliente?`, apariciones, "(1 = bien, publicado una sola vez; >1 = duplicado)");
    await cotiz.close();
    await panelCliente.close();
  } finally {
    await browser.close();
  }
  console.log("\n\nRESUMEN JSON:\n", JSON.stringify(resultados, null, 2));
})();
