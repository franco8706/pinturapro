const k = require("/workspaces/codespaces-blank/.auditoria/kit/navegador.cjs");

const TITULO = "ZZAGENT pintura living";
const DESCRIPCION = "ZZAGENT descripcion de prueba de auditoria, ignorar y borrar";
const UBICACION = "ZZAGENT CABA";

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
    await k.ir(page, "/dashboard/nueva-obra");
    await page.waitForTimeout(300);
    k.limpiarEventos(eventos);

    await page.fill('input[name="title"]', TITULO);
    await page.fill('textarea[name="description"]', DESCRIPCION);
    await page.fill('input[name="location"]', UBICACION);
    // Dejamos categoria default (Residencial) y sin foto (probamos sin foto para ver si valida).

    const boton = await page.$('button:has-text("Publicar obra")');
    if (!boton) throw new Error("No encontre el boton Publicar obra");

    const [nav] = await Promise.all([
      page.waitForURL((u) => u.pathname !== "/dashboard/nueva-obra", { timeout: 20000 }).catch((e) => ({ error: String(e) })),
      boton.click(),
    ]);
    console.log("Resultado espera de navegacion tras publicar:", nav && nav.error ? nav.error : "OK, fue a " + page.url());

    if (page.url().includes("/dashboard/nueva-obra")) {
      const textoError = await page.evaluate(() => {
        const alerta = document.querySelector('[role="alert"]');
        return alerta ? alerta.textContent : document.body.innerText.slice(0, 800);
      });
      console.log("SIGUE EN nueva-obra. Mensaje/estado visible:", textoError);
    }

    await page.waitForTimeout(500);
    const auditoria = await k.auditar(page, eventos);
    console.log("--- AUDITORIA TRAS PUBLICAR ---");
    console.log(JSON.stringify(auditoria, null, 2));

    // Verificar en /dashboard que aparece la obra nueva
    await k.ir(page, "/dashboard");
    await page.waitForTimeout(500);
    const textoDashboard = await page.evaluate(() => document.body.innerText);
    const apareceEnDashboard = textoDashboard.includes(TITULO);
    console.log("APARECE EN /dashboard:", apareceEnDashboard);
    const idxObras = textoDashboard.indexOf("Tus obras");
    console.log("--- FRAGMENTO 'Tus obras' EN DASHBOARD ---");
    console.log(textoDashboard.slice(idxObras, idxObras + 600));
  } finally {
    await browser.close();
  }
})();
