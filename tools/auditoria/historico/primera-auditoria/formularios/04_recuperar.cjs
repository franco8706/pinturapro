const k = require("/workspaces/codespaces-blank/.auditoria/kit/navegador.cjs");
const { sacarRestricciones, XSS, SQLI } = require("./_ayuda.cjs");

const R = [];
function log(caso, detalle) {
  R.push({ caso, ...detalle });
  console.log("\n=== " + caso + " ===");
  console.log(JSON.stringify(detalle, null, 2));
}

async function estado(page) {
  const body = await page.locator("body").innerText();
  const alerts = await page.evaluate(() =>
    [...document.querySelectorAll('[role="alert"]')].map((e) => e.textContent).filter((t) => t && t.trim()),
  );
  return { mostroRevisaCorreo: /Revisá tu correo/i.test(body), alerts };
}

(async () => {
  const { browser, page } = await k.abrir({ movil: false });
  try {
    // A: vacío nativo
    await k.ir(page, "/recuperar");
    await page.click("button[type=submit]");
    await page.waitForTimeout(500);
    log("A. Enviar vacío (nativo)", { esperado: "Bloqueado por required", urlActual: page.url() });

    // B: solo espacios, sin restricciones nativas
    await k.ir(page, "/recuperar");
    await sacarRestricciones(page);
    await page.locator("input").first().fill("   ");
    const respuestasB = [];
    page.on("response", (r) => {
      if (r.url().includes("/auth/v1/recover")) respuestasB.push(r.status());
    });
    await page.evaluate(() => document.querySelector("form").requestSubmit());
    await page.waitForTimeout(2000);
    const b = await estado(page);
    log("B. Email de solo espacios", {
      esperado: "Mismo mensaje genérico 'revisá tu correo' (no debería confirmar/negar cuentas), o un error claro de formato",
      respuestas: respuestasB,
      resultado: b,
    });

    // D: XSS/SQLi como "email"
    await k.ir(page, "/recuperar");
    await sacarRestricciones(page);
    await page.locator("input").first().fill(`${SQLI}${XSS}@x.com`);
    const respuestasD = [];
    page.on("response", (r) => {
      if (r.url().includes("/auth/v1/recover")) respuestasD.push(r.status());
    });
    await page.evaluate(() => document.querySelector("form").requestSubmit());
    await page.waitForTimeout(2000);
    const d = await estado(page);
    log("D. XSS/SQLi como email", {
      esperado: "Rechazado o tratado como email inválido, sin ejecutar script ni exponer nada",
      respuestas: respuestasD,
      resultado: d,
    });

    // H: clic triple con email real de un pintor (no debería revelar ni duplicar nada, sólo
    // nos interesa que no rompa la UI ni dispare docenas de requests)
    await k.ir(page, "/recuperar");
    await page.fill("input[type=email]", "martin.rojas@pinturapro.demo");
    const respuestasH = [];
    page.on("response", (r) => {
      if (r.url().includes("/auth/v1/recover")) respuestasH.push(r.status());
    });
    const boton = page.locator("button[type=submit]");
    for (let i = 0; i < 3; i++) {
      await boton.click({ timeout: 1500 }).catch((e) => log("  (clic " + i + " falló)", { motivo: String(e).slice(0, 150) }));
    }
    await page.waitForTimeout(2500);
    const h = await estado(page);
    log("H. Clic triple en 'Enviarme el enlace' (email real)", {
      esperado: "Debería viajar 1 solo POST /recover (o los extra no deberían mandar más emails)",
      respuestas: respuestasH,
      resultado: h,
    });
  } finally {
    await browser.close();
  }
  console.log("\n\n########## RESUMEN recuperar ##########");
  console.log(JSON.stringify(R, null, 2));
})();
