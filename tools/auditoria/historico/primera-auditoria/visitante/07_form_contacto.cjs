const k = require("/workspaces/codespaces-blank/.auditoria/kit/navegador.cjs");

(async () => {
  const { browser, page, eventos } = await k.abrir({ movil: false });
  try {
    k.limpiarEventos(eventos);
    await k.ir(page, "/contacto");
    // Inspeccionar el formulario antes de tocar nada
    const campos = await page.evaluate(() => {
      return [...document.querySelectorAll("form input, form textarea, form select")].map((el) => ({
        tag: el.tagName, type: el.type || null, name: el.name || null, id: el.id || null, required: el.required,
      }));
    });
    console.log("CAMPOS:", JSON.stringify(campos, null, 2));
    await page.screenshot({ path: "/workspaces/codespaces-blank/.auditoria/kit/visitante/contacto_antes.png" });
  } finally {
    await browser.close();
  }
})();
