const k = require("/workspaces/codespaces-blank/.auditoria/kit/navegador.cjs");
(async () => {
  const { browser, page, eventos } = await k.abrir({ movil: false });
  const r = {};
  try {
    await k.ingresar(page, "pintor3");
    await k.ir(page, "/trabajos");
    const estado = () => page.evaluate(() => [...document.querySelectorAll("article")].map(a => ({
      titulo: a.querySelector("h2")?.textContent?.slice(0, 32),
      accion: a.querySelector("form") ? "formulario" : (a.querySelector(".mt-auto")?.textContent || "").replace(/\s+/g, " ").trim().slice(0, 50),
    })));
    r.antes = await estado();
    const cotizable = await page.evaluate(() => {
      const a = [...document.querySelectorAll("article")].find(x => /Cotizar este trabajo/.test(x.textContent));
      if (!a) return null;
      a.querySelector("button").click();     // abre el formulario
      return a.querySelector("h2").textContent;
    });
    await page.waitForTimeout(800);
    r.pedidoElegido = cotizable;
    if (cotizable) {
      await page.fill(`article:has-text("${cotizable}") input[name=amount]`, "654321");
      await page.fill(`article:has-text("${cotizable}") textarea[name=note]`, "ZZAGENT prueba ya cotizado");
      await page.click(`article:has-text("${cotizable}") form button[type=submit]`);
      await page.waitForTimeout(4000);
      await k.ir(page, "/trabajos");   // recargar de verdad
      r.despues = await estado();
    }
    r.js = eventos.jsErrors.slice(0, 3);
  } catch (e) { r.error = String(e).slice(0, 250); }
  finally { await browser.close(); }
  console.log(JSON.stringify(r, null, 2));
})();
