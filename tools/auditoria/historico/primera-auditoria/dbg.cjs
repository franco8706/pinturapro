const k = require("/workspaces/codespaces-blank/.auditoria/kit/navegador.cjs");
(async () => {
  const { browser, page } = await k.abrir({ movil: false });
  try {
    await k.ir(page, "/simulador");
    await page.waitForLoadState("networkidle").catch(() => {});
    await page.waitForFunction(() => {
      const i = document.querySelector('input[type=file]');
      return i && Object.keys(i).some((k) => k.startsWith("__react"));
    }, { timeout: 30000 }).catch(() => {});
    await page.waitForTimeout(500);
    await page.setInputFiles('input[type=file]', "/workspaces/codespaces-blank/.auditoria/fotos/99-gigante.jpg");
    await page.waitForTimeout(9000);
    console.log(JSON.stringify(await page.evaluate(() => ({
      dbg: window.__dbg ?? null,
      labelTexto: (document.querySelector('label')?.innerText || '').replace(/\s+/g,' ').slice(0,150),
      canvas: !!document.querySelector('canvas'),
    })), null, 2));
  } finally { await browser.close(); }
})();
