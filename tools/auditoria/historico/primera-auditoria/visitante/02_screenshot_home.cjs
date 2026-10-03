const k = require("/workspaces/codespaces-blank/.auditoria/kit/navegador.cjs");
(async () => {
  const { browser, page } = await k.abrir({ movil: false });
  try {
    await k.ir(page, "/");
    await page.screenshot({ path: "/workspaces/codespaces-blank/.auditoria/kit/visitante/home_desktop_full.png", fullPage: true });
  } finally {
    await browser.close();
  }
})();
