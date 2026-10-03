const k = require("/workspaces/codespaces-blank/.auditoria/kit/navegador.cjs");

// Dos pestañas del MISMO browser/contexto (comparten cookies, como en la vida real).
// Cierro sesión en la pestaña 1 y veo qué pasa en la pestaña 2, que quedó con su propio
// estado de React (AuthNav) pensando que sigue logueada.
(async () => {
  const { browser, page: page1, eventos } = await k.abrir({ movil: false });
  const resultados = {};
  try {
    await k.ingresar(page1, "pintor3"); // Diego Sosa, cuenta poco usada por los otros tests
    console.log("Pestaña 1 logueada como pintor3. URL:", page1.url());

    const page2 = await page1.context().newPage();
    await page2.goto("http://localhost:3000/dashboard", { waitUntil: "domcontentloaded" });
    await page2.waitForTimeout(600);
    console.log("Pestaña 2 abierta en:", page2.url());
    resultados.pestaña2Inicial = { url: page2.url(), h1: await page2.locator("h1").allInnerTexts() };

    // Pestaña 1: navego a home y cierro sesión con el botón REAL del navbar (form POST).
    await page1.goto("http://localhost:3000/", { waitUntil: "domcontentloaded" });
    await page1.waitForTimeout(500);
    console.log("Cerrando sesión en pestaña 1 con el botón 'Salir'...");
    await page1.locator('form[action="/auth/signout"] button:has-text("Salir")').click();
    await page1.waitForTimeout(1200);
    resultados.pestaña1TrasSalir = { url: page1.url(), h1: await page1.locator("h1").allInnerTexts() };
    console.log("Pestaña 1 tras Salir -> url:", page1.url(), "h1:", resultados.pestaña1TrasSalir.h1);
    const navPestaña1 = await page1.locator("text=Ingresar").count();
    console.log("Pestaña 1: ¿el navbar ahora dice 'Ingresar'?", navPestaña1 > 0);

    // Sin recargar la pestaña 2: ¿el navbar se actualiza solo (onAuthStateChange/storage event)?
    await page2.waitForTimeout(1500);
    const navPestaña2SinRecargar = await page2.locator('form[action="/auth/signout"]').count();
    resultados.pestaña2SinRecargarSigueViendoSalir = navPestaña2SinRecargar > 0;
    console.log("Pestaña 2 (SIN recargar) -> ¿todavía muestra el botón 'Salir' como si siguiera logueada?", navPestaña2SinRecargar > 0);

    // En pestaña 2 (sin recargar), intento NAVEGAR a una ruta protegida distinta.
    k.limpiarEventos(eventos);
    const status = await k.ir(page2, "/dashboard/nueva-obra");
    resultados.pestaña2NavegoTrasLogout = { status, url: page2.url(), ...(await k.auditar(page2, eventos)) };
    console.log("Pestaña 2: al navegar a /dashboard/nueva-obra tras el logout en la otra pestaña -> status:", status, "url final:", page2.url(), "h1:", resultados.pestaña2NavegoTrasLogout.h1);

    // Y si además intenta usar una Server Action (crear obra) con la sesión ya cortada:
    const hayForm = await page2.locator('main form input[name="title"]').count();
    if (hayForm > 0) {
      await page2.locator('form:has(input[name="title"]) input[name="title"]').fill("ZZAGENT no debería crearse (sesión cortada)");
      k.limpiarEventos(eventos);
      await page2.locator('form:has(input[name="title"]) button:has-text("Publicar obra")').click();
      await page2.waitForTimeout(2000);
      resultados.pestaña2IntentoCrearTrasLogout = { url: page2.url(), ...(await k.auditar(page2, eventos)) };
      const alertTxt = await page2.locator('[role=alert]').innerText().catch(() => "(sin alert)");
      resultados.pestaña2IntentoCrearTrasLogout.alertTxt = alertTxt;
      console.log("Pestaña 2: intento de crear obra con sesión ya cortada -> url:", page2.url(), "| alert:", alertTxt);
    } else {
      console.log("Pestaña 2: no se mostró el formulario tras navegar (probablemente ya redirigió a /ingresar). Bien.");
    }
  } finally {
    await browser.close();
  }
  console.log("\n\nRESUMEN JSON:\n", JSON.stringify(resultados, null, 2));
})();
