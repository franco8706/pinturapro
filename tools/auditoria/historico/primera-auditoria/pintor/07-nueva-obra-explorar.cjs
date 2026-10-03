const k = require("/workspaces/codespaces-blank/.auditoria/kit/navegador.cjs");

async function ingresarConReintento(page, rol, intentos = 3) {
  for (let i = 1; i <= intentos; i++) {
    await k.ingresar(page, rol);
    if (!page.url().includes("/ingresar")) return page.url();
    await page.waitForTimeout(1000);
  }
  throw new Error("No se pudo loguear tras varios intentos");
}

(async () => {
  const { browser, page, eventos } = await k.abrir({ movil: false });
  try {
    await ingresarConReintento(page, "pintor2");
    const status = await k.ir(page, "/dashboard/nueva-obra");
    k.limpiarEventos(eventos);
    await page.waitForTimeout(500);
    const auditoria = await k.auditar(page, eventos);
    console.log("STATUS:", status);
    console.log(JSON.stringify(auditoria, null, 2));

    const campos = await page.evaluate(() => {
      const out = [];
      document.querySelectorAll("input, textarea, select").forEach((el) => {
        out.push({
          tag: el.tagName,
          type: el.type || null,
          name: el.name || null,
          required: el.required || false,
          value: el.value,
          placeholder: el.placeholder || null,
          options: el.tagName === "SELECT" ? [...el.options].map((o) => o.value + ":" + o.textContent) : undefined,
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
