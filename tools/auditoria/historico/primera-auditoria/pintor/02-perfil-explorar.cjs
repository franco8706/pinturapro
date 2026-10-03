const k = require("/workspaces/codespaces-blank/.auditoria/kit/navegador.cjs");

(async () => {
  const { browser, page, eventos } = await k.abrir({ movil: false });
  try {
    await k.ingresar(page, "pintor2");
    const status = await k.ir(page, "/dashboard/perfil");
    k.limpiarEventos(eventos);
    await page.waitForTimeout(500);
    const auditoria = await k.auditar(page, eventos);
    console.log("STATUS:", status);
    console.log(JSON.stringify(auditoria, null, 2));

    // Listar todos los inputs/textareas del formulario con su valor actual
    const campos = await page.evaluate(() => {
      const out = [];
      document.querySelectorAll("input, textarea, select").forEach((el) => {
        out.push({
          tag: el.tagName,
          type: el.type || null,
          name: el.name || null,
          id: el.id || null,
          value: el.value,
          placeholder: el.placeholder || null,
        });
      });
      return out;
    });
    console.log("--- CAMPOS DEL FORMULARIO ---");
    console.log(JSON.stringify(campos, null, 2));

    const textoPrincipal = await page.evaluate(() => document.body.innerText.slice(0, 3000));
    console.log("--- TEXTO VISIBLE ---");
    console.log(textoPrincipal);
  } finally {
    await browser.close();
  }
})();
