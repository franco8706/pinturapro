const k = require("/workspaces/codespaces-blank/.auditoria/kit/navegador.cjs");
(async () => {
  const { browser, page, eventos } = await k.abrir({ movil: false });
  try {
    await k.ingresar(page, "admin");
    await k.ir(page, "/panel");
    const panel = await page.evaluate(() => document.body.innerText.replace(/\s+/g, " ").slice(0, 900));
    await k.ir(page, "/admin");
    const admin = await page.evaluate(() => document.body.innerText.replace(/\s+/g, " ").slice(0, 700));
    console.log(JSON.stringify({ panel, admin, js: eventos.jsErrors.slice(0, 3), req: eventos.requestsFallidos }, null, 2));
  } finally { await browser.close(); }
})();
