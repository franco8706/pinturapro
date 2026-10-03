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
    const status = await k.ir(page, "/trabajos");
    k.limpiarEventos(eventos);
    await page.waitForTimeout(500);
    const auditoria = await k.auditar(page, eventos);
    console.log("STATUS:", status);
    console.log(JSON.stringify(auditoria, null, 2));
    const texto = await page.evaluate(() => document.body.innerText);
    console.log("--- TEXTO VISIBLE ---");
    console.log(texto);

    // Buscar botones/links de cotizar
    const cotizarBtns = await page.$$eval('button, a', (els) =>
      els.filter((e) => /cotizar/i.test(e.textContent || "")).map((e) => ({ tag: e.tagName, texto: e.textContent.trim() })),
    );
    console.log("--- BOTONES/LINKS CON 'cotizar' ---");
    console.log(JSON.stringify(cotizarBtns, null, 2));
  } finally {
    await browser.close();
  }
})();
