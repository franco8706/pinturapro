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
    await k.ir(page, "/dashboard/perfil");
    k.limpiarEventos(eventos);
    await page.waitForTimeout(500);
    const auditoria = await k.auditar(page, eventos);
    console.log(JSON.stringify(auditoria, null, 2));
    const bio = await page.$eval('textarea[name="bio"]', (el) => el.value);
    console.log("BIO EN MOVIL (solo lectura, no se toca):", JSON.stringify(bio));
  } finally {
    await browser.close();
  }
})();
