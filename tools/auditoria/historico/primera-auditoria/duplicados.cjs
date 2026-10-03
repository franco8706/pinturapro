const k = require("/workspaces/codespaces-blank/.auditoria/kit/navegador.cjs");
const marca = "ZZAGENT dup " + Date.now().toString().slice(-6);

(async () => {
  const { browser, page, eventos } = await k.abrir({ movil: false });
  const r = { marca };
  try {
    await k.ingresar(page, "pintor2");
    await k.ir(page, "/dashboard/nueva-obra");
    await page.fill('input[name=title]', marca + " obra");
    await page.fill('textarea[name=description]', "ZZAGENT prueba de doble envío");
    await page.fill('input[name=location]', "ZZAGENT zona");
    // tres clics en el mismo tick
    r.textoBoton = await page.evaluate(() => {
      const form = document.querySelector('input[name=title]').closest('form');
      const b = form.querySelector('button[type=submit]');
      const t = b.textContent.trim();
      b.click(); b.click(); b.click();
      return t;
    });
    await page.waitForTimeout(6000);
    r.urlDespues = page.url();
    r.js = eventos.jsErrors.slice(0, 3);
  } catch (e) {
    r.error = String(e).slice(0, 300);
  } finally {
    await browser.close();
  }
  console.log(JSON.stringify(r, null, 2));
})();
