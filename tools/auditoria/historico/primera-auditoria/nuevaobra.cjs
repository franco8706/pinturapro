const k = require("/workspaces/codespaces-blank/.auditoria/kit/navegador.cjs");
(async () => {
  const out = [];
  for (const rol of ["cliente3", "pintor2"]) {
    const { browser, page } = await k.abrir({ movil: false });
    try {
      await k.ingresar(page, rol);
      const status = await k.ir(page, "/dashboard/nueva-obra");
      out.push({ rol, status, ...(await page.evaluate(() => ({
        url: location.pathname,
        h1: (document.querySelector("h1")?.innerText || "").slice(0, 30),
        hayFormulario: !!document.querySelector('input[name=title]'),
      }))) });
    } finally { await browser.close(); }
  }
  console.log(JSON.stringify(out, null, 2));
})();
