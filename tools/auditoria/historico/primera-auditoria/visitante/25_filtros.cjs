const k = require("/workspaces/codespaces-blank/.auditoria/kit/navegador.cjs");
(async () => {
  const { browser, page, eventos } = await k.abrir({ movil: false });
  try {
    // /obras filtros
    k.limpiarEventos(eventos);
    await k.ir(page, "/obras");
    await page.waitForTimeout(500);
    await page.click('button:has-text("Residencial")');
    await page.waitForTimeout(500);
    const cantResidencial = (await page.$$('a[href^="/obras/"]')).length;
    console.log("Obras tras filtro Residencial:", cantResidencial, JSON.stringify(eventos.requests));
    await page.click('button:has-text("Industrial")');
    await page.waitForTimeout(500);
    const textoIndustrial = await page.evaluate(() => document.body.innerText.includes("no encontramos") || document.body.innerText.includes("No hay") || document.body.innerText.includes("Sin resultados"));
    const cantIndustrial = (await page.$$('a[href^="/obras/"]')).length;
    console.log("Obras tras filtro Industrial:", cantIndustrial, "mensaje vacio detectado:", textoIndustrial);
    console.log("Texto visible tras Industrial:", (await page.evaluate(()=>document.body.innerText)).slice(400,900));

    // /pintores filtros
    k.limpiarEventos(eventos);
    await k.ir(page, "/pintores");
    await page.waitForTimeout(500);
    await page.click('button:has-text("Zona Norte")');
    await page.waitForTimeout(500);
    const cantZonaNorte = (await page.$$('a[href^="/pintor/"]')).length;
    console.log("Pintores tras filtro Zona Norte:", cantZonaNorte, JSON.stringify(eventos.requests));
    await page.click('button:has-text("Master")');
    await page.waitForTimeout(500);
    const cantCombinado = (await page.$$('a[href^="/pintor/"]')).length;
    console.log("Pintores tras Zona Norte + Master (combinación sin resultados esperada):", cantCombinado);
    console.log("Texto:", (await page.evaluate(()=>document.body.innerText)).slice(300,700));
  } finally {
    await browser.close();
  }
})();
