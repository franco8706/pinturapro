const k = require("/workspaces/codespaces-blank/.auditoria/kit/navegador.cjs");
const FOTOS = "/workspaces/codespaces-blank/.auditoria/fotos";
const estado = (page) => page.evaluate(() => ({
  inputs: document.querySelectorAll('input[type=file]').length,
  canvas: !!document.querySelector('canvas'),
  aviso: (document.body.innerText.match(/[^.\n]*(demasiado grande|megap|no pudimos|Analizando|muy pesada)[^.\n]*\.?/i) || [null])[0],
}));
(async () => {
  for (const intento of [1, 2]) {
    const { browser, page, eventos } = await k.abrir({ movil: false });
    const linea = [];
    try {
      await k.ir(page, "/simulador");
      await page.setInputFiles('input[type=file]', `${FOTOS}/99-gigante.jpg`);
      for (const ms of [500, 1500, 3000, 6000, 10000, 15000]) {
        await page.waitForTimeout(ms === 500 ? 500 : ms === 1500 ? 1000 : ms === 3000 ? 1500 : 3000);
        linea.push({ t: ms, ...(await estado(page)) });
      }
      // ¿se puede elegir otra foto después?
      let pudo = "no";
      try {
        await page.setInputFiles('input[type=file]', `${FOTOS}/01-living-luz.jpg`, { timeout: 8000 });
        await page.waitForTimeout(3000);
        pudo = (await page.evaluate(() => !!document.querySelector('canvas'))) ? "sí, y se abrió el editor" : "aceptó el archivo pero no abrió el editor";
      } catch (e) { pudo = "NO: no hay selector de archivos en la pantalla"; }
      console.log(JSON.stringify({ intento, linea, recuperacion: pudo, js: eventos.jsErrors.slice(0, 3) }, null, 2));
    } finally { await browser.close(); }
  }
})();
