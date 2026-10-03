const k = require("/workspaces/codespaces-blank/.auditoria/kit/navegador.cjs");
const FOTOS = "/workspaces/codespaces-blank/.auditoria/fotos";
(async () => {
  const { browser, page, eventos } = await k.abrir({ movil: false });
  try {
    await k.ir(page, "/simulador");
    const antes = await page.evaluate(() => ({ inputs: document.querySelectorAll('input[type=file]').length, canvas: !!document.querySelector('canvas') }));
    await page.setInputFiles('input[type=file]', `${FOTOS}/99-gigante.jpg`);
    await page.waitForTimeout(9000);
    const despues = await page.evaluate(() => ({
      inputs: document.querySelectorAll('input[type=file]').length,
      canvas: !!document.querySelector('canvas'),
      canvasTam: (() => { const c = document.querySelector('canvas'); return c ? { w: c.width, h: c.height } : null; })(),
      botones: [...document.querySelectorAll('button,label')].map(b => b.textContent.trim().slice(0, 30)).filter(Boolean).slice(0, 25),
      texto: document.body.innerText.replace(/\s+/g, ' ').slice(0, 700),
    }));
    await page.screenshot({ path: "/workspaces/codespaces-blank/.auditoria/out/gigante.png" });
    console.log(JSON.stringify({ antes, despues, js: eventos.jsErrors.slice(0,3) }, null, 2));
  } finally { await browser.close(); }
})();
