const k = require("/workspaces/codespaces-blank/.auditoria/kit/navegador.cjs");

const NOTA_ZZAGENT = "ZZAGENT nota de cotización — prueba de botón atrás";

(async () => {
  const { browser, page, eventos } = await k.abrir({ movil: false });
  const resultados = {};
  try {
    // ── Parte A: pintor2 cotiza un trabajo en /trabajos, después atrás/adelante/reload ──
    await k.ingresar(page, "pintor2");
    console.log("Logueado como pintor2. URL:", page.url());
    await k.ir(page, "/"); // entrada intermedia en el historial, más realista que ir directo
    await k.ir(page, "/trabajos");

    const articulo = page.locator("article", { hasText: "Cotizar este trabajo" }).first();
    const hayTrabajo = await articulo.count();
    resultados.hayTrabajoParaCotizar = hayTrabajo > 0;
    if (hayTrabajo === 0) {
      console.log("No hay ningún pedido abierto para cotizar con pintor2 (puede que ya cotizó todos). Salteo parte A.");
    } else {
      const tituloTrabajo = await articulo.locator("h2").innerText();
      console.log("Voy a cotizar:", tituloTrabajo);
      // Uso un locator estable por TÍTULO (no por el texto del botón, que cambia al abrir el form).
      const art = page.locator("article", { hasText: tituloTrabajo });
      await art.getByText("Cotizar este trabajo").click();
      await art.locator('input[name="amount"]').fill("123456");
      await art.locator('textarea[name="note"]').fill(NOTA_ZZAGENT);
      k.limpiarEventos(eventos);
      await art.locator('button:has-text("Enviar cotización")').click();
      await page.waitForTimeout(1500);
      const confirmado = await page.locator("text=Cotización enviada").count();
      resultados.confirmacionInline = confirmado > 0;
      console.log("¿Mostró confirmación inline 'Cotización enviada'?", confirmado > 0);

      // Atrás
      k.limpiarEventos(eventos);
      await page.goBack({ waitUntil: "domcontentloaded" }).catch((e) => console.log("goBack error:", e.message));
      await page.waitForTimeout(800);
      resultados.trasAtras = { url: page.url(), ...(await k.auditar(page, eventos)) };
      console.log("Tras ATRÁS -> url:", page.url(), "| h1:", resultados.trasAtras.h1);

      // Adelante (vuelve a /trabajos)
      k.limpiarEventos(eventos);
      await page.goForward({ waitUntil: "domcontentloaded" }).catch((e) => console.log("goForward error:", e.message));
      await page.waitForTimeout(800);
      resultados.trasAdelante = { url: page.url(), ...(await k.auditar(page, eventos)) };
      const muestraCotizarDeNuevo = await page.locator("article", { hasText: tituloTrabajo }).getByText("Cotizar este trabajo").count();
      const muestraEnviada = await page.locator("article", { hasText: tituloTrabajo }).getByText("Cotización enviada").count();
      resultados.trasAdelante.muestraBotonCotizarDeNuevo = muestraCotizarDeNuevo > 0;
      resultados.trasAdelante.muestraConfirmacionCacheada = muestraEnviada > 0;
      console.log("Tras ADELANTE (bfcache/re-render) -> ¿vuelve a mostrar 'Cotizar este trabajo'?", muestraCotizarDeNuevo > 0, "| ¿mantiene 'Cotización enviada' (bfcache)?", muestraEnviada > 0);

      // Reload real (fuerza ida al servidor, no bfcache)
      k.limpiarEventos(eventos);
      await page.reload({ waitUntil: "domcontentloaded" });
      await page.waitForTimeout(1000);
      resultados.trasReload = { url: page.url(), ...(await k.auditar(page, eventos)) };
      const art2 = page.locator("article", { hasText: tituloTrabajo });
      const sigueOfreciendoCotizar = await art2.getByText("Cotizar este trabajo").count();
      resultados.trasReload.sigueOfreciendoCotizarSinAvisoDeYaCotizado = sigueOfreciendoCotizar > 0;
      console.log("Tras RELOAD real -> ¿el pedido ya cotizado sigue ofreciendo 'Cotizar este trabajo' sin avisar que ya coticé?", sigueOfreciendoCotizar > 0);

      if (sigueOfreciendoCotizar > 0) {
        // Intento de cotizar DE NUEVO el mismo pedido: ¿la base lo frena con mensaje claro?
        await art2.getByText("Cotizar este trabajo").click();
        await art2.locator('input[name="amount"]').fill("999999");
        await art2.locator('textarea[name="note"]').fill(NOTA_ZZAGENT + " (segundo intento)");
        k.limpiarEventos(eventos);
        await art2.locator('button:has-text("Enviar cotización")').click();
        await page.waitForTimeout(1500);
        const errorTxt = await art2.locator('[role=alert]').innerText().catch(() => null);
        resultados.segundoIntentoCotizar = { errorTxt, ...(await k.auditar(page, eventos)) };
        console.log("Segundo intento de cotizar el mismo pedido -> mensaje:", errorTxt);
      }
    }
    // Parte B (publicar un trabajo + atrás/adelante) se corrió por separado en
    // 01b-back-button-publicar.cjs.
  } finally {
    await browser.close();
  }
  console.log("\n\nRESUMEN JSON:\n", JSON.stringify(resultados, null, 2));
})();
