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
  const { browser, page, eventos } = await k.abrir({ movil: true });
  try {
    await ingresarConReintento(page, "pintor2");
    await k.ir(page, "/dashboard/nueva-obra");
    k.limpiarEventos(eventos);
    await page.waitForTimeout(500);
    console.log("--- /dashboard/nueva-obra MOVIL ---");
    console.log(JSON.stringify(await k.auditar(page, eventos), null, 2));

    await k.ir(page, "/dashboard");
    k.limpiarEventos(eventos);
    await page.waitForTimeout(500);
    console.log("--- /dashboard MOVIL (con obra nueva y ver tarjeta) ---");
    console.log(JSON.stringify(await k.auditar(page, eventos), null, 2));
    const texto = await page.evaluate(() => document.body.innerText);
    const idx = texto.indexOf("Tus obras");
    console.log(texto.slice(idx, idx + 400));
  } finally {
    await browser.close();
  }
})();
