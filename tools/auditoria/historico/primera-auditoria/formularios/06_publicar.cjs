const k = require("/workspaces/codespaces-blank/.auditoria/kit/navegador.cjs");
const { sacarRestricciones, contarPosts, textoLargo, XSS, SQLI } = require("./_ayuda.cjs");

const R = [];
function log(caso, detalle) {
  R.push({ caso, ...detalle });
  console.log("\n=== " + caso + " ===");
  console.log(JSON.stringify(detalle, null, 2));
}

async function completarWizard(page, { titulo, tipo, superficie, zona }) {
  const inputs1 = page.locator("main input");
  await inputs1.nth(0).fill(titulo);
  await page.getByRole("button", { name: tipo, exact: true }).click();
  await sacarRestricciones(page);
  await page.getByRole("button", { name: "Continuar →" }).click();
  await page.waitForTimeout(300);

  const inputs2 = page.locator("main input");
  await inputs2.nth(0).fill(String(superficie));
  await inputs2.nth(1).fill(zona);
  await sacarRestricciones(page);
  await page.getByRole("button", { name: "Continuar →" }).click();
  await page.waitForTimeout(300);
  // Paso presupuesto: dejamos "A definir" sin elegir nada (isValid=true siempre)
}

(async () => {
  const { browser, page, eventos } = await k.abrir({ movil: false });
  try {
    await k.ingresar(page, "cliente");

    // Caso 1: título con XSS/SQLi + zona con XSS + superficie enorme
    await k.ir(page, "/publicar");
    await completarWizard(page, {
      titulo: `ZZAGENT ${XSS} ${SQLI} publicar1`,
      tipo: "interior",
      superficie: "999999999",
      zona: `ZZAGENT zona ${XSS}`,
    });
    const posts1 = contarPosts(page);
    await page.getByRole("button", { name: /Publicar trabajo/ }).click();
    await page.waitForTimeout(2000);
    const body1 = await page.locator("main").innerText();
    log("1. Título/zona con XSS+SQLi, superficie=999999999", {
      esperado: "No debería ejecutar script; superficie no se usa en el payload real (no es columna), pero no debería romper nada",
      exito: /está publicado/i.test(body1),
      postsDisparados: posts1.length,
      erroresJs: eventos.jsErrors,
    });

    // Caso 2: título de 10.000 caracteres
    await k.ir(page, "/publicar");
    await completarWizard(page, {
      titulo: "ZZAGENT " + textoLargo(10000),
      tipo: "exterior",
      superficie: "50",
      zona: "ZZAGENT zona normal",
    });
    await page.getByRole("button", { name: /Publicar trabajo/ }).click();
    await page.waitForTimeout(2000);
    const body2 = await page.locator("main").innerText();
    const error2 = await page.locator("[role=alert]").first().innerText().catch(() => null);
    log("2. Título de 10.000 caracteres", {
      esperado: "El servidor debería truncar o rechazar un título absurdamente largo (revisar si projects.title tiene límite)",
      exito: /está publicado/i.test(body2),
      mensajeError: error2,
    });

    // Caso H: clic triple en "Publicar trabajo"
    await k.ir(page, "/publicar");
    const tituloTriple = `ZZAGENT triple publicar ${Date.now()}`;
    await completarWizard(page, { titulo: tituloTriple, tipo: "ambos", superficie: "40", zona: "ZZAGENT zona triple" });
    const postsTriple = contarPosts(page);
    const boton = page.getByRole("button", { name: /Publicar trabajo/ });
    await Promise.all([boton.click(), boton.click(), boton.click()]);
    await page.waitForTimeout(2500);
    const bodyTriple = await page.locator("main").innerText();
    log("H. Clic triple en 'Publicar trabajo'", {
      esperado: "Debería crearse UN solo pedido (projects type=service), no varios con el mismo título",
      postsDisparados: postsTriple.length,
      posts: postsTriple,
      exito: /está publicado/i.test(bodyTriple),
      tituloUsado: tituloTriple,
    });
  } finally {
    await browser.close();
  }
  console.log("\n\n########## RESUMEN publicar ##########");
  console.log(JSON.stringify(R, null, 2));
})();
