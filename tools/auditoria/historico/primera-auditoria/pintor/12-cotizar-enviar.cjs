const k = require("/workspaces/codespaces-blank/.auditoria/kit/navegador.cjs");

const MONTO = "1000000";
const NOTA = "ZZAGENT cotizacion de prueba de auditoria. Incluye materiales, mano de obra y tratamiento de la humedad en la pared del patio.";

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
    k.limpiarEventos(eventos);

    const abrirBtn = await page.$('button:has-text("Cotizar este trabajo")');
    if (!abrirBtn) throw new Error("No encontre boton Cotizar este trabajo");
    await abrirBtn.click();
    await page.waitForTimeout(400);

    await page.fill('input[name="amount"]', MONTO);
    await page.fill('textarea[name="note"]', NOTA);

    const enviarBtn = await page.$('button:has-text("Enviar cotización")');
    if (!enviarBtn) throw new Error("No encontre boton Enviar cotizacion");
    await enviarBtn.click();

    // Esperar confirmacion real (texto de exito), sin timeout fijo arbitrario
    await page.waitForSelector('text=Cotización enviada', { timeout: 20000 }).catch(async () => {
      console.log("NO aparecio el mensaje de exito en 20s. Revisando estado/errores...");
    });
    await page.waitForTimeout(300);

    const auditoria = await k.auditar(page, eventos);
    console.log("--- AUDITORIA TRAS ENVIAR COTIZACION ---");
    console.log(JSON.stringify(auditoria, null, 2));

    const texto = await page.evaluate(() => document.body.innerText.slice(0, 2000));
    console.log("--- TEXTO VISIBLE TRAS ENVIAR ---");
    console.log(texto);
  } finally {
    await browser.close();
  }
})();
