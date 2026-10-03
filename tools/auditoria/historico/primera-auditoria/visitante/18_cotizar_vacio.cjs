const k = require("/workspaces/codespaces-blank/.auditoria/kit/navegador.cjs");
(async () => {
  const { browser, page, eventos } = await k.abrir({ movil: false });
  try {
    await k.ir(page, "/cotizar");
    await page.waitForTimeout(500);
    await page.click('text=Interior'); await page.waitForTimeout(250);
    await page.click('button:has-text("Continuar")'); await page.waitForTimeout(500);
    await page.click('button:has-text("70 m²")'); await page.waitForTimeout(250);
    await page.click('button:has-text("Continuar")'); await page.waitForTimeout(500);
    await page.click('button:has-text("Living")'); await page.waitForTimeout(250);
    await page.click('button:has-text("Continuar")'); await page.waitForTimeout(500);

    // NO llenar ningún campo. Intentar enviar directamente.
    k.limpiarEventos(eventos);
    const botonEnviar = await page.$('button:has-text("Pedir presupuesto")');
    const disabled = await botonEnviar.isDisabled();
    console.log("¿Botón 'Pedir presupuesto' deshabilitado con todo vacío?", disabled);
    await botonEnviar.click();
    await page.waitForTimeout(1200);
    console.log("URL tras click con todo vacío:", page.url());
    console.log((await page.evaluate(() => document.body.innerText)).slice(0, 900));
    console.log("REQUESTS FALLIDOS:", JSON.stringify(eventos.requests));
  } finally {
    await browser.close();
  }
})();
