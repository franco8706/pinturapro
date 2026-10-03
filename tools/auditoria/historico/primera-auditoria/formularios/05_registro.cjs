const k = require("/workspaces/codespaces-blank/.auditoria/kit/navegador.cjs");
const { sacarRestricciones, contarPosts, textoLargo, XSS, SQLI } = require("./_ayuda.cjs");

const R = [];
function log(caso, detalle) {
  R.push({ caso, ...detalle });
  console.log("\n=== " + caso + " ===");
  console.log(JSON.stringify(detalle, null, 2));
}

// Completa los 4 pasos del wizard de /registro y hace click en "Continuar"/"Enviar postulación".
async function completarWizard(page, { nombre, years, email, phone }) {
  // Paso 1: nombre + años
  const inputs1 = page.locator("main input");
  await inputs1.nth(0).fill(nombre);
  await inputs1.nth(1).fill(String(years));
  await sacarRestricciones(page);
  await page.getByRole("button", { name: "Continuar →" }).click();
  await page.waitForTimeout(300);

  // Paso 2: zona (botón fijo)
  await page.getByRole("button", { name: "CABA" }).click();
  await page.waitForTimeout(300);
  await page.getByRole("button", { name: "Continuar →" }).click();
  await page.waitForTimeout(300);

  // Paso 3: especialidad (botón fijo)
  await page.getByRole("button", { name: "Residencial" }).click();
  await page.waitForTimeout(300);
  await page.getByRole("button", { name: "Continuar →" }).click();
  await page.waitForTimeout(300);

  // Paso 4: email + telefono
  const inputs4 = page.locator("main input");
  await inputs4.nth(0).fill(email);
  await inputs4.nth(1).fill(phone);
  await sacarRestricciones(page);
}

(async () => {
  const { browser, page, eventos } = await k.abrir({ movil: false });
  try {
    // Caso 1: años de experiencia absurdo (999999999) + resto válido -> ¿el server lo acepta sin tope?
    await k.ir(page, "/registro");
    await completarWizard(page, {
      nombre: "ZZAGENT Postulante Absurdo",
      years: "999999999",
      email: `zzagent-formularios+registro1_${Date.now()}@example.com`,
      phone: "1155550000",
    });
    const posts1 = contarPosts(page);
    await page.getByRole("button", { name: /Enviar postulación/ }).click();
    await page.waitForTimeout(2000);
    const body1 = await page.locator("main").innerText();
    log("1. Años de experiencia = 999999999 (sin tope)", {
      esperado: "El server debería acotar un valor de experiencia absurdo, o al menos no romper nada",
      exito: /Bienvenido/i.test(body1),
      postsDisparados: posts1.length,
      erroresJs: eventos.jsErrors,
    });

    // Caso 2: XSS/SQLi en nombre, email al límite de la regex del servidor
    await k.ir(page, "/registro");
    await completarWizard(page, {
      nombre: `ZZAGENT ${XSS} ${SQLI}`,
      years: "5",
      email: `zzagent-formularios+registro2_${Date.now()}@example.com`,
      phone: "1155550001",
    });
    await page.getByRole("button", { name: /Enviar postulación/ }).click();
    await page.waitForTimeout(2000);
    const body2 = await page.locator("main").innerText();
    log("2. XSS/SQLi en nombre", {
      esperado: "No debería ejecutarse ningún script; se guarda como texto",
      exito: /Bienvenido/i.test(body2),
      tituloConNombreCrudo: body2.slice(0, 200),
      erroresJs: eventos.jsErrors,
    });

    // Caso 3: email al límite (1 char de TLD) que pasa el regex laxo del cliente pero no el
    // estricto del servidor (EMAIL_RE exige 2+ caracteres tras el último punto)
    await k.ir(page, "/registro");
    await completarWizard(page, {
      nombre: "ZZAGENT Email Limite",
      years: "3",
      email: "zzagent-formularios-limite@x.c", // 1 solo caracter de TLD
      phone: "1155550002",
    });
    await page.getByRole("button", { name: /Enviar postulación/ }).click();
    await page.waitForTimeout(2000);
    const body3 = await page.locator("main").innerText();
    const error3 = await page.locator("[role=alert]").innerText().catch(() => null);
    log("3. Email 'x@y.c' (pasa el regex laxo del cliente, no el estricto del server)", {
      esperado: "El servidor debería rechazarlo igual, mostrando el error debajo del formulario (no una pantalla en blanco)",
      exito: /Bienvenido/i.test(body3),
      mensajeError: error3,
    });

    // Caso 4: teléfono con basura (letras) - cliente sólo chequea length>=6
    await k.ir(page, "/registro");
    await completarWizard(page, {
      nombre: "ZZAGENT Telefono Basura",
      years: "2",
      email: `zzagent-formularios+registro4_${Date.now()}@example.com`,
      phone: "abcdef",
    });
    await page.getByRole("button", { name: /Enviar postulación/ }).click();
    await page.waitForTimeout(2000);
    const body4 = await page.locator("main").innerText();
    log("4. Teléfono = 'abcdef' (6 letras, pasa length>=6 del cliente)", {
      esperado: "El servidor guarda el teléfono tal cual (no valida formato) — comportamiento documentado como laxo a propósito en guardarTelefono, pero acá es un lead nuevo: revisar si corresponde",
      exito: /Bienvenido/i.test(body4),
    });

    // Caso H: clic triple en "Enviar postulación" con datos válidos nuevos
    await k.ir(page, "/registro");
    const emailTriple = `zzagent-formularios+registroTriple_${Date.now()}@example.com`;
    await completarWizard(page, {
      nombre: "ZZAGENT Triple Postulacion",
      years: "4",
      email: emailTriple,
      phone: "1155550099",
    });
    const postsTriple = contarPosts(page);
    const boton = page.getByRole("button", { name: /Enviar postulación/ });
    await Promise.all([boton.click(), boton.click(), boton.click()]);
    await page.waitForTimeout(2500);
    const bodyTriple = await page.locator("main").innerText();
    log("H. Clic triple en 'Enviar postulación'", {
      esperado: "Debería crearse UN solo lead 'painter_application' (el mismo patrón que se corrigió en /contacto)",
      postsDisparados: postsTriple.length,
      posts: postsTriple,
      exito: /Bienvenido/i.test(bodyTriple),
      emailUsado: emailTriple,
    });
  } finally {
    await browser.close();
  }
  console.log("\n\n########## RESUMEN registro ##########");
  console.log(JSON.stringify(R, null, 2));
})();
