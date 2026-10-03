const k = require("/workspaces/codespaces-blank/.auditoria/kit/navegador.cjs");
const FOTOS = "/workspaces/codespaces-blank/.auditoria/fotos";
(async () => {
  for (let i = 1; i <= 3; i++) {
    const { browser, page, eventos } = await k.abrir({ movil: false });
    try {
      await k.ir(page, "/simulador");
      await page.evaluate(() => { window.__logs = []; const o = console.error; console.error = (...a) => { window.__logs.push(String(a[0]).slice(0,120)); o(...a); }; });
      await page.setInputFiles('input[type=file]', `${FOTOS}/99-gigante.jpg`);
      const muestras = [];
      for (let t = 0; t < 8; t++) {
        await page.waitForTimeout(1500);
        muestras.push(await page.evaluate(() => {
          const lbl = document.querySelector('label');
          return { ms: Math.round(performance.now()), tieneMsg: (lbl?.innerText || '').includes('megap'), textoLabel: (lbl?.innerText || '').replace(/\s+/g,' ').slice(0, 120) };
        }));
      }
      console.log(JSON.stringify({ corrida: i, primeraConMsg: muestras.findIndex(m => m.tieneMsg), ultimo: muestras[muestras.length-1], logs: await page.evaluate(() => window.__logs), js: eventos.jsErrors.slice(0,2) }));
    } finally { await browser.close(); }
  }
})();
