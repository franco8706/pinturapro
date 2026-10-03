const k = require("/workspaces/codespaces-blank/.auditoria/kit/navegador.cjs");

async function correr(movil) {
  const { browser, page, eventos } = await k.abrir({ movil });
  try {
    const urlLogin = await k.ingresar(page, "pintor2");
    console.log("=== LOGIN movil=" + movil + " url final:", urlLogin);
    const status = await k.ir(page, "/dashboard");
    k.limpiarEventos(eventos);
    await page.waitForTimeout(500);
    const auditoria = await k.auditar(page, eventos);
    console.log("STATUS:", status);
    console.log(JSON.stringify(auditoria, null, 2));
    // Extraer texto visible completo de contenido principal para revisar cifras
    const textoPrincipal = await page.evaluate(() => document.body.innerText.slice(0, 4000));
    console.log("--- TEXTO VISIBLE ---");
    console.log(textoPrincipal);
  } finally {
    await browser.close();
  }
}

(async () => {
  await correr(true);
  await correr(false);
})();
