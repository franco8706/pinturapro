const k = require("/workspaces/codespaces-blank/.auditoria/kit/navegador.cjs");
(async () => {
  const { browser, page, eventos } = await k.abrir({ movil: false });
  try {
    const status = await k.ir(page, "/obras/no-existe-esta-obra");
    await page.waitForTimeout(2500);
    const info = await page.evaluate(() => ({
      bodyHijos: document.body.children.length,
      bodyHTML: document.body.innerHTML.slice(0, 200),
      templates: document.querySelectorAll("template").length,
      texto: (document.body.innerText || "").slice(0, 60),
    }));
    console.log(JSON.stringify({ status, info, consola: eventos.consola.slice(0, 5), js: eventos.jsErrors.slice(0, 5) }, null, 2));
  } finally { await browser.close(); }
})();
