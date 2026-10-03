const k = require("/workspaces/codespaces-blank/.auditoria/kit/navegador.cjs");
(async () => {
  const { browser, page, eventos } = await k.abrir({ movil: false });
  try {
    k.limpiarEventos(eventos);
    await k.ir(page, "/cotizar");
    await page.waitForTimeout(500);
    await page.click('text=Interior'); await page.waitForTimeout(250);
    await page.click('button:has-text("Continuar")'); await page.waitForTimeout(500);
    await page.click('button:has-text("70 m²")'); await page.waitForTimeout(250);
    await page.click('button:has-text("Continuar")'); await page.waitForTimeout(500);
    await page.click('button:has-text("Living")'); await page.waitForTimeout(250);
    await page.click('button:has-text("Continuar")'); await page.waitForTimeout(500);

    // Paso 4: llenar contacto con prefijo ZZAGENT
    const inputs = await page.$$('input');
    console.log("Cantidad de inputs paso 4:", inputs.length);
    for (const inp of inputs) {
      const tipo = await inp.getAttribute('type');
      const placeholder = await inp.getAttribute('placeholder');
      const name = await inp.getAttribute('name');
      console.log('input:', {tipo, placeholder, name});
    }
    // Llenar por placeholder/tipo heuristicamente
    if (await page.$('input[type="email"]')) await page.fill('input[type="email"]', 'zzagent.auditoria@example.com');
    if (await page.$('input[type="tel"]')) await page.fill('input[type="tel"]', '1122334455');
    // Nombre: primer input de texto que no sea email/tel
    const textInputs = await page.$$('input[type="text"], input:not([type])');
    if (textInputs.length) await textInputs[0].fill('ZZAGENT Auditoria Visitante');

    await page.screenshot({ path: "/workspaces/codespaces-blank/.auditoria/kit/visitante/cotizar_paso4_lleno.png" });

    k.limpiarEventos(eventos);
    await page.click('button:has-text("Pedir presupuesto")');
    await page.waitForTimeout(1500);
    console.log("URL tras enviar:", page.url());
    console.log((await page.evaluate(() => document.body.innerText)).slice(0, 1500));
    console.log("REQUESTS FALLIDOS:", JSON.stringify(eventos.requests));
    console.log("CONSOLA:", JSON.stringify(eventos.consola));
    console.log("JS ERRORS:", JSON.stringify(eventos.jsErrors));
    await page.screenshot({ path: "/workspaces/codespaces-blank/.auditoria/kit/visitante/cotizar_tras_enviar.png", fullPage: true });
  } finally {
    await browser.close();
  }
})();
