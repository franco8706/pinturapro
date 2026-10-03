const k = require("/workspaces/codespaces-blank/.auditoria/kit/navegador.cjs");

(async () => {
  const { browser, page, eventos } = await k.abrir({ movil: false });
  const resultados = {};
  try {
    await k.ingresar(page, "pintor"); // Martín Rojas — dueño de estudio-nordelta, NO de loft-palermo
    console.log("Logueado como pintor. URL:", page.url());

    // 1) sanity check: editar SU PROPIA obra debe funcionar
    k.limpiarEventos(eventos);
    let status = await k.ir(page, "/dashboard/editar/estudio-nordelta");
    resultados.propia = { status, ...(await k.auditar(page, eventos)) };
    console.log("=== EDITAR PROPIA (estudio-nordelta) status:", status, "===");
    console.log(JSON.stringify(resultados.propia, null, 2));

    // 2) intento de editar obra AJENA (loft-palermo, de Lucía Fernández / pintor2)
    k.limpiarEventos(eventos);
    status = await k.ir(page, "/dashboard/editar/loft-palermo");
    resultados.ajena = { status, ...(await k.auditar(page, eventos)) };
    console.log("=== EDITAR AJENA (loft-palermo) status:", status, "===");
    console.log(JSON.stringify(resultados.ajena, null, 2));

    // Si por algún motivo cargó un formulario (no 404), ver si el título es el de la obra ajena
    // y probar si el botón "Guardar cambios" existe y qué pasa al enviarlo con un cambio marcado ZZAGENT.
    const cargoFormulario = await page.locator('form input[name="title"]').count();
    resultados.cargoFormularioAjeno = cargoFormulario > 0;
    if (cargoFormulario > 0) {
      const tituloActual = await page.locator('form input[name="title"]').inputValue();
      console.log("¡ALERTA! Cargó un formulario de edición para la obra ajena. Título actual:", tituloActual);
      // Intentar guardar un cambio marcado para verificar si efectivamente escribe en la obra ajena.
      await page.fill('form input[name="title"]', tituloActual + " ZZAGENT-INTENTO-EDICION-AJENA");
      k.limpiarEventos(eventos);
      await Promise.all([
        page.waitForURL((u) => true, { timeout: 8000 }).catch(() => {}),
        page.click('form button[type=submit]'),
      ]);
      await page.waitForTimeout(1000);
      resultados.intentoGuardar = { url: page.url(), ...(await k.auditar(page, eventos)) };
      console.log("=== INTENTO DE GUARDAR CAMBIO EN OBRA AJENA ===");
      console.log(JSON.stringify(resultados.intentoGuardar, null, 2));
    } else {
      console.log("No cargó formulario (probable notFound/404). Bien.");
    }

    // 3) Verificar en vivo público si loft-palermo cambió de título (persistencia real)
    const pagina = await page.context().newPage();
    await pagina.goto("http://localhost:3000/obras/loft-palermo", { waitUntil: "domcontentloaded" });
    const h1 = await pagina.locator("h1").first().innerText().catch(() => "(sin h1)");
    console.log("Título público actual de /obras/loft-palermo tras el intento:", h1);
    resultados.tituloPublicoTrasIntento = h1;
    await pagina.close();
  } finally {
    await browser.close();
  }
  console.log("\n\nRESUMEN JSON:\n", JSON.stringify(resultados, null, 2));
})();
