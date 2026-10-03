const k = require("/workspaces/codespaces-blank/.auditoria/kit/navegador.cjs");
(async () => {
  const { browser, page } = await k.abrir({ movil: false });
  const out = [];
  try {
    for (const ruta of ["/obras/no-existe-esta-obra", "/pintor/00000000-0000-0000-0000-000000000000", "/pintor/basura-no-uuid", "/pagina-que-no-existe"]) {
      const status = await k.ir(page, ruta);
      out.push({ ruta, status, ...(await page.evaluate(() => ({
        h1: (document.querySelector("h1")?.innerText || "").slice(0, 40),
        links: document.querySelectorAll("a").length,
        textoVisible: (document.body.innerText || "").replace(/\s+/g, " ").trim().slice(0, 80),
      }))) });
    }
    console.log(JSON.stringify(out, null, 2));
  } finally { await browser.close(); }
})();
