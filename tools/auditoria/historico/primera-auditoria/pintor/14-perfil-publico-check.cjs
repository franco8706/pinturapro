const k = require("/workspaces/codespaces-blank/.auditoria/kit/navegador.cjs");

(async () => {
  const { browser, page, eventos } = await k.abrir({ movil: false });
  try {
    await k.ir(page, "/pintores");
    await page.waitForTimeout(500);
    const link = await page.$('a:has-text("Lucía Fernández")');
    if (!link) {
      console.log("No encontre el link a Lucia Fernandez en /pintores");
      const texto = await page.evaluate(() => document.body.innerText.slice(0, 1500));
      console.log(texto);
      return;
    }
    const href = await link.getAttribute("href");
    console.log("Link publico de Lucia:", href);
    k.limpiarEventos(eventos);
    await k.ir(page, href);
    await page.waitForTimeout(500);
    console.log(JSON.stringify(await k.auditar(page, eventos), null, 2));
    const texto = await page.evaluate(() => document.body.innerText.slice(0, 2000));
    console.log("--- TEXTO PERFIL PUBLICO ---");
    console.log(texto);
  } finally {
    await browser.close();
  }
})();
