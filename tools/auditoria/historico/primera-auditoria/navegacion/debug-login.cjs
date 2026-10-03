const k = require("/workspaces/codespaces-blank/.auditoria/kit/navegador.cjs");
(async () => {
  const { browser, page, eventos } = await k.abrir({ movil: false });
  try {
    const t0 = Date.now();
    await k.ir(page, "/ingresar");
    await page.fill("input[type=email]", k.CUENTAS.cliente3);
    await page.fill("input[type=password]", k.PASS);
    await page.click("button[type=submit]");
    for (let i = 0; i < 20; i++) {
      await page.waitForTimeout(1000);
      console.log(((Date.now() - t0) / 1000).toFixed(1) + "s", page.url());
    }
    const h1 = await page.locator("h1").allInnerTexts();
    console.log("h1:", h1);
    console.log("body text (primeros 300):", (await page.locator("body").innerText()).slice(0, 300));
    console.log("Consola:", eventos.consola);
    console.log("JS errors:", eventos.jsErrors);
  } finally {
    await browser.close();
  }
})();
