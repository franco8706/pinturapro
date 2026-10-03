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
    await k.ir(page, "/trabajos");
    await page.waitForTimeout(300);

    const boton = await page.$('button:has-text("Cotizar este trabajo")');
    if (!boton) throw new Error("No encontre boton Cotizar este trabajo");
    await boton.click();
    await page.waitForTimeout(600);

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
          min: el.min || null,
          max: el.max || null,
        });
      });
      return out;
    });
    console.log("--- CAMPOS DEL FORM DE COTIZACION (tras click) ---");
    console.log(JSON.stringify(campos, null, 2));

    const texto = await page.evaluate(() => document.body.innerText.slice(0, 2500));
    console.log("--- TEXTO VISIBLE TRAS CLICK ---");
    console.log(texto);
  } finally {
    await browser.close();
  }
})();
