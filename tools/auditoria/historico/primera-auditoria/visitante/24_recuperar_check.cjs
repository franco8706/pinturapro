const k = require("/workspaces/codespaces-blank/.auditoria/kit/navegador.cjs");
(async () => {
  const { browser, page, eventos } = await k.abrir({ movil: false });
  try {
    k.limpiarEventos(eventos);
    await k.ir(page, "/recuperar");
    await page.waitForTimeout(400);
    await page.fill('input[type="email"]', 'marina.acosta@pinturapro.demo');
    await page.click('button:has-text("Enviarme el enlace")');
    await page.waitForTimeout(1200);
    console.log((await page.evaluate(() => document.body.innerText)).slice(0, 700));
    console.log("REQUESTS FALLIDOS:", JSON.stringify(eventos.requests));
    console.log("CONSOLA:", JSON.stringify(eventos.consola));
  } finally {
    await browser.close();
  }
})();
