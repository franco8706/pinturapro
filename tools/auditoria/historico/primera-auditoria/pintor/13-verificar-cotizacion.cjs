const k = require("/workspaces/codespaces-blank/.auditoria/kit/navegador.cjs");

async function ingresarConReintento(page, rol, intentos = 3) {
  for (let i = 1; i <= intentos; i++) {
    await k.ingresar(page, rol);
    if (!page.url().includes("/ingresar")) return page.url();
    await page.waitForTimeout(1000);
  }
  throw new Error("No se pudo loguear tras varios intentos");
}

async function correr(movil) {
  const { browser, page, eventos } = await k.abrir({ movil });
  try {
    await ingresarConReintento(page, "pintor2");

    // Paso 5: /cotizaciones como pintor
    const status1 = await k.ir(page, "/cotizaciones");
    console.log(`=== movil=${movil} /cotizaciones STATUS:`, status1, "URL final:", page.url());
    k.limpiarEventos(eventos);
    await page.waitForTimeout(400);
    console.log(JSON.stringify(await k.auditar(page, eventos), null, 2));

    // Paso 6: /dashboard, ver si se refleja la cotizacion
    const status2 = await k.ir(page, "/dashboard");
    console.log(`=== movil=${movil} /dashboard STATUS:`, status2);
    k.limpiarEventos(eventos);
    await page.waitForTimeout(400);
    console.log(JSON.stringify(await k.auditar(page, eventos), null, 2));

    const texto = await page.evaluate(() => document.body.innerText);
    const idxMetrics = texto.indexOf("Trabajos completados");
    console.log("--- METRICAS ---");
    console.log(texto.slice(idxMetrics - 20, idxMetrics + 150));
    const idxTrabajos = texto.indexOf("Tus trabajos");
    const idxObras = texto.indexOf("Tus obras");
    console.log("--- TUS TRABAJOS (incluye Barracas si aparece) ---");
    console.log(texto.slice(idxTrabajos, idxObras));
  } finally {
    await browser.close();
  }
}

(async () => {
  await correr(false);
  await correr(true);
})();
