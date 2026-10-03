const k = require("/workspaces/codespaces-blank/.auditoria/kit/navegador.cjs");
(async () => {
  const { browser, page, eventos } = await k.abrir({ movil: false });
  const out = [];
  try {
    for (const ruta of ["/obras", "/obras?tipo=Residencial", "/obras?tipo=Comercial", "/obras?tipo=Industrial", "/obras?tipo=cualquier-cosa"]) {
      const status = await k.ir(page, ruta);
      out.push({ ruta, status, ...(await page.evaluate(() => ({
        obras: document.querySelectorAll("article, a[href^='/obras/']").length,
        titulos: [...document.querySelectorAll("a[href^='/obras/']")].map(a => a.innerText.split("\n")[0]).filter(Boolean).slice(0, 5),
        activo: [...document.querySelectorAll("[aria-current='page']")].map(e => e.innerText.trim()),
        vacio: (document.body.innerText.match(/Todavía no hay obras[^\n]*/) || [null])[0],
      }))) });
    }
    console.log(JSON.stringify({ out, js: eventos.jsErrors.slice(0,3) }, null, 2));
  } finally { await browser.close(); }
})();
