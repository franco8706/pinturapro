/** Aunque entre un texto larguísimo, ¿la página se estira? */
const k = require("/workspaces/codespaces-blank/.auditoria/kit/navegador.cjs");
(async () => {
  const out = [];
  for (const movil of [true, false]) {
    const { browser, page } = await k.abrir({ movil });
    try {
      await k.ir(page, "/trabajos");
      const antes = await page.evaluate(() => document.documentElement.scrollWidth);
      const despues = await page.evaluate(() => {
        const h = document.querySelector("article h2");
        if (h) h.textContent = "X".repeat(10000);
        return document.documentElement.scrollWidth;
      });
      out.push({ pantalla: movil ? "celular" : "escritorio", ventana: await page.evaluate(() => window.innerWidth), anchoAntes: antes, anchoConTextoLargo: despues });
    } finally { await browser.close(); }
  }
  console.log(JSON.stringify(out, null, 2));
})();
