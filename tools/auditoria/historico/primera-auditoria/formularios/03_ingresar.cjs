const k = require("/workspaces/codespaces-blank/.auditoria/kit/navegador.cjs");
const { sacarRestricciones, textoLargo, XSS, SQLI } = require("./_ayuda.cjs");

const R = [];
function log(caso, detalle) {
  R.push({ caso, ...detalle });
  console.log("\n=== " + caso + " ===");
  console.log(JSON.stringify(detalle, null, 2));
}

async function intentarLogin(page, { email, password }, esperarMs = 2500) {
  await k.ir(page, "/ingresar");
  await page.waitForSelector("form input", { timeout: 10000 });
  await sacarRestricciones(page);
  await page.locator("form input").nth(0).fill(email);
  await page.locator("form input").nth(1).fill(password);
  await sacarRestricciones(page); // reafirmar noValidate por si un re-render lo tocó
  const respuestas = [];
  const listener = (r) => {
    if (r.url().includes("/auth/v1/token")) respuestas.push(r.status());
  };
  page.on("response", listener);
  // submit del <form> directo: más confiable que clickear el botón cuando el navegador
  // podría de todos modos interceptar el click en un input inválido.
  await page.evaluate(() => document.querySelector("form").requestSubmit());
  await page.waitForTimeout(esperarMs);
  page.off("response", listener);
  const alerts = await page.evaluate(() =>
    [...document.querySelectorAll('[role="alert"]')].map((e) => e.textContent).filter((t) => t && t.trim()),
  );
  return { alerts, respuestas, url: page.url() };
}

(async () => {
  const { browser, page } = await k.abrir({ movil: false });
  try {
    // A: vacío nativo (sin sacar restricciones)
    await k.ir(page, "/ingresar");
    await page.click("button[type=submit]");
    await page.waitForTimeout(500);
    log("A. Enviar vacío (nativo)", { esperado: "Bloqueado por required del navegador", urlActual: page.url() });

    // B: espacios (sin restricciones)
    const b = await intentarLogin(page, { email: "   ", password: "   " });
    log("B. Solo espacios en email/password", {
      esperado: "Rechazado con mensaje claro",
      resultado: b,
    });

    // D: SQLi en email, XSS en password
    const d = await intentarLogin(page, { email: `${SQLI}@x.com`, password: XSS });
    log("D. SQLi en email, XSS en password", {
      esperado: "Rechazado como credenciales inválidas, sin ejecutar script ni exponer error crudo de DB",
      resultado: d,
    });

    // C: contraseña de 10.000 caracteres contra cuenta real
    const c = await intentarLogin(page, { email: "martin.rojas@pinturapro.demo", password: textoLargo(10000) });
    log("C. Password de 10.000 caracteres contra cuenta real (martin.rojas)", {
      esperado: "Rechazado como credenciales incorrectas, sin 500 ni crash",
      resultado: c,
    });

    // F: emails malformados contra password real
    for (const emailMalo of ["a@", "sin-arroba", "+++123"]) {
      const f = await intentarLogin(page, { email: emailMalo, password: "Demo1234!" });
      log(`F. Email malformado de login "${emailMalo}"`, {
        esperado: "Rechazado con mensaje claro",
        resultado: f,
      });
    }

    // H: clic triple con credenciales VÁLIDAS
    await k.ir(page, "/ingresar");
    await page.fill("input[type=email]", "martin.rojas@pinturapro.demo");
    await page.fill("input[type=password]", "Demo1234!");
    const respuestasTriple = [];
    const listenerTriple = (r) => {
      if (r.url().includes("/auth/v1/token")) respuestasTriple.push(r.status());
    };
    page.on("response", listenerTriple);
    const boton = page.locator("button[type=submit]");
    for (let i = 0; i < 3; i++) {
      await boton.click({ timeout: 1500, force: true }).catch((e) => log("  (clic " + i + " falló)", { motivo: String(e).slice(0, 150) }));
    }
    await page.waitForTimeout(2500);
    page.off("response", listenerTriple);
    log("H. Clic triple en 'Ingresar' con credenciales válidas", {
      esperado: "Un solo POST /token debería viajar (o los adicionales no deberían causar problemas)",
      respuestasTriple,
      urlFinal: page.url(),
    });
  } finally {
    await browser.close();
  }
  console.log("\n\n########## RESUMEN ingresar ##########");
  console.log(JSON.stringify(R, null, 2));
})();
