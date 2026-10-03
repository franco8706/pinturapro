const k = require("/workspaces/codespaces-blank/.auditoria/kit/navegador.cjs");
const { contarPosts, sacarRestricciones, textoLargo, XSS, SQLI } = require("./_ayuda.cjs");

const R = [];
function log(caso, detalle) {
  R.push({ caso, ...detalle });
  console.log("\n=== " + caso + " ===");
  console.log(JSON.stringify(detalle, null, 2));
}

async function llenar(page, { nombre, email, password }) {
  await page.fill("input[type=text]", nombre ?? "");
  const emailSel = (await page.$("input[type=email]")) ? "input[type=email]" : "input[type=text] >> nth=1";
  await page.fill(emailSel, email ?? "");
  await page.fill("input[type=password]", password ?? "");
}

(async () => {
  const { browser, page, eventos } = await k.abrir({ movil: false });
  try {
    // --- Caso A: vacío, con las restricciones nativas intactas (debe bloquear el navegador) ---
    await k.ir(page, "/crear-cuenta");
    const posts0 = contarPosts(page);
    await page.click("button[type=submit]");
    await page.waitForTimeout(500);
    log("A. Enviar todo vacío (nativo)", {
      esperado: "El navegador bloquea el submit (required); no debería salir ningún POST a Supabase",
      postsDisparados: posts0.length,
      urlActual: page.url(),
    });

    // --- Caso B: solo espacios, sacando restricciones nativas ---
    await k.ir(page, "/crear-cuenta");
    await sacarRestricciones(page);
    await llenar(page, { nombre: "   ", email: "   ", password: "   " });
    const postsB = contarPosts(page);
    await page.click("button[type=submit]");
    await page.waitForTimeout(1200);
    const errorB = await page.locator("[role=alert]").innerText().catch(() => null);
    log("B. Solo espacios (sin required/type)", {
      esperado: "El servidor (Supabase Auth) debería rechazar email vacío/inválido con mensaje claro",
      postsDisparados: postsB.length,
      mensajeError: errorB,
      urlActual: page.url(),
    });

    // --- Caso C: 10.000 caracteres en nombre ---
    await k.ir(page, "/crear-cuenta");
    await sacarRestricciones(page);
    const emailUnico1 = `zzagent-formularios+c${Date.now()}@example.com`;
    await llenar(page, { nombre: "ZZAGENT " + textoLargo(10000), email: emailUnico1, password: "Demo1234!" });
    const postsC = contarPosts(page);
    await page.click("button[type=submit]");
    await page.waitForTimeout(2500);
    const errorC = await page.locator("[role=alert]").innerText().catch(() => null);
    log("C. Nombre con 10.000 caracteres", {
      esperado: "El servidor debería truncar o rechazar un nombre absurdamente largo",
      postsDisparados: postsC.length,
      mensajeError: errorC,
      urlActual: page.url(),
      textosProhibidos: (await k.auditar(page, eventos)).textosProhibidos,
    });

    // --- Caso D: XSS y SQLi en nombre ---
    await k.ir(page, "/crear-cuenta");
    await sacarRestricciones(page);
    const emailUnico2 = `zzagent-formularios+d${Date.now()}@example.com`;
    await llenar(page, { nombre: `ZZAGENT ${XSS} ${SQLI}`, email: emailUnico2, password: "Demo1234!" });
    const postsD = contarPosts(page);
    await page.click("button[type=submit]");
    await page.waitForTimeout(2500);
    const errorD = await page.locator("[role=alert]").innerText().catch(() => null);
    log("D. XSS/SQLi en nombre", {
      esperado: "No debería ejecutarse ningún script; el nombre debería guardarse tal cual (escapado) o rechazarse",
      postsDisparados: postsD.length,
      mensajeError: errorD,
      urlActual: page.url(),
      huboAlertJs: eventos.jsErrors,
    });

    // --- Caso F: emails malformados ---
    for (const emailMalo of ["a@", "sin-arroba", "+++123", "a@b", "a@b."]) {
      await k.ir(page, "/crear-cuenta");
      await sacarRestricciones(page);
      await llenar(page, { nombre: "ZZAGENT prueba email", email: emailMalo, password: "Demo1234!" });
      const postsF = contarPosts(page);
      await page.click("button[type=submit]");
      await page.waitForTimeout(1500);
      const errorF = await page.locator("[role=alert]").innerText().catch(() => null);
      log(`F. Email malformado "${emailMalo}"`, {
        esperado: "Debería rechazarse con mensaje claro",
        postsDisparados: postsF.length,
        mensajeError: errorF,
        urlActual: page.url(),
      });
    }

    // --- Caso H: clic triple con datos válidos (posible cuenta duplicada) ---
    await k.ir(page, "/crear-cuenta");
    const emailTriple = `zzagent-formularios+triple${Date.now()}@example.com`;
    await page.fill("input[type=text]", "ZZAGENT Triple Clic");
    await page.fill("input[type=email]", emailTriple);
    await page.fill("input[type=password]", "Demo1234!");
    const postsH = contarPosts(page);
    const boton = await page.$("button[type=submit]");
    await Promise.all([boton.click(), boton.click(), boton.click()]);
    await page.waitForTimeout(3000);
    log("H. Clic triple en 'Crear cuenta' (mismo email)", {
      esperado: "Debería dispararse UN solo POST a Supabase signUp (o el botón debe deshabilitarse tras el primer clic)",
      postsDisparados: postsH.length,
      posts: postsH,
      urlActual: page.url(),
      emailUsado: emailTriple,
    });
  } finally {
    await browser.close();
  }
  console.log("\n\n########## RESUMEN crear-cuenta ##########");
  console.log(JSON.stringify(R, null, 2));
})();
