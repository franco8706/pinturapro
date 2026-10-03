const k = require("/workspaces/codespaces-blank/.auditoria/kit/navegador.cjs");

// Segunda verificación, con otro par de cuentas, del hallazgo crítico del punto 5 de la
// tarea: pintor2 (Lucía, dueña de loft-palermo) intenta editar estudio-nordelta (obra de
// Martín / cuenta "pintor").
(async () => {
  const { browser, page, eventos } = await k.abrir({ movil: false });
  const resultados = {};
  try {
    await k.ingresar(page, "pintor2");
    console.log("Logueado como pintor2 (Lucía). URL:", page.url());

    k.limpiarEventos(eventos);
    const status = await k.ir(page, "/dashboard/editar/estudio-nordelta");
    resultados.ajena = { status, ...(await k.auditar(page, eventos)) };
    console.log("Intento de editar estudio-nordelta (obra de Martín) como Lucía -> status:", status, "h1:", resultados.ajena.h1);

    const cargoFormulario = await page.locator('form input[name="title"]').count();
    resultados.cargoFormulario = cargoFormulario > 0;
    console.log("¿Cargó formulario de edición?", cargoFormulario > 0);

    const pub = await page.context().newPage();
    await pub.goto("http://localhost:3000/obras/estudio-nordelta", { waitUntil: "domcontentloaded" });
    resultados.tituloPublico = await pub.locator("h1, .font-display").first().innerText().catch(() => "?");
    console.log("Título público de estudio-nordelta tras el intento:", resultados.tituloPublico);
    await pub.close();
  } finally {
    await browser.close();
  }
  console.log("\n\nRESUMEN JSON:\n", JSON.stringify(resultados, null, 2));
})();
