const k = require("/workspaces/codespaces-blank/.auditoria/kit/navegador.cjs");
const { sacarRestricciones, textoLargo, XSS, SQLI } = require("./_ayuda.cjs");

const R = [];
function log(caso, detalle) {
  R.push({ caso, ...detalle });
  console.log("\n=== " + caso + " ===");
  console.log(JSON.stringify(detalle, null, 2));
}

async function estadoFinal(page) {
  const body = await page.locator("body").innerText();
  const exito = /Revisá tu email/i.test(body);
  const errorEl = await page.locator("[role=alert]").first();
  const error = (await errorEl.count()) ? await errorEl.innerText() : null;
  return { exito, error };
}

async function intentar(page, { nombre, email, password }, esperarMs = 3000) {
  await k.ir(page, "/crear-cuenta");
  await page.waitForSelector("form input", { timeout: 10000 });
  await sacarRestricciones(page);
  await page.locator("form input").nth(0).fill(nombre);
  await page.locator("form input").nth(1).fill(email);
  await page.locator("form input").nth(2).fill(password);
  const respuestas = [];
  page.on("response", (r) => {
    if (r.url().includes("/auth/v1/signup")) respuestas.push(r.status());
  });
  await page.click("button[type=submit]");
  await page.waitForTimeout(esperarMs);
  const fin = await estadoFinal(page);
  return { ...fin, respuestasSignup: respuestas };
}

(async () => {
  const { browser, page } = await k.abrir({ movil: false });
  try {
    // B: contraseña de 8 espacios (>=6 de largo, pasa el check de longitud del cliente)
    const b = await intentar(page, {
      nombre: "ZZAGENT espacios",
      email: `zzagent-formularios+esp${Date.now()}@example.com`,
      password: "        ", // 8 espacios
    });
    log("B2. Contraseña de solo espacios (8 espacios, pasa length>=6)", {
      esperado: "Debería rechazarse una contraseña sin contenido real, o al menos no crear la cuenta silenciosamente",
      resultado: b,
    });

    // B3: nombre y email de solo espacios (email queda "   " tras trim? no hay trim en el form)
    const b3 = await intentar(page, { nombre: "   ", email: "   ", password: "Demo1234!" });
    log("B3. Nombre y EMAIL de solo espacios", {
      esperado: "El servidor debería rechazar un email de solo espacios",
      resultado: b3,
    });

    // C: nombre con 10.000 caracteres
    const c = await intentar(page, {
      nombre: "ZZAGENT " + textoLargo(10000),
      email: `zzagent-formularios+c2_${Date.now()}@example.com`,
      password: "Demo1234!",
    });
    log("C2. Nombre con 10.000 caracteres", {
      esperado: "El servidor debería truncar/rechazar un nombre absurdamente largo",
      resultado: { exito: c.exito, error: c.error, respuestasSignup: c.respuestasSignup },
    });

    // D: XSS/SQLi en nombre
    const d = await intentar(page, {
      nombre: `ZZAGENT ${XSS} ${SQLI}`,
      email: `zzagent-formularios+d2_${Date.now()}@example.com`,
      password: "Demo1234!",
    });
    log("D2. XSS/SQLi en nombre", {
      esperado: "No debería ejecutarse script; se guarda como texto o se rechaza",
      resultado: { exito: d.exito, error: d.error, respuestasSignup: d.respuestasSignup },
    });

    // F: emails malformados, uno por uno con más tiempo de espera
    for (const emailMalo of ["a@", "sin-arroba", "+++123", "a@b", "a@b."]) {
      const f = await intentar(
        page,
        { nombre: "ZZAGENT prueba email", email: emailMalo, password: "Demo1234!" },
        3000,
      );
      log(`F2. Email malformado "${emailMalo}"`, {
        esperado: "Debería rechazarse con mensaje claro (Supabase valida el formato en el servidor)",
        resultado: f,
      });
    }

    // H: clic triple, mirando también el status code de cada respuesta
    await k.ir(page, "/crear-cuenta");
    const emailTriple = `zzagent-formularios+tripleB${Date.now()}@example.com`;
    await page.fill("input[type=text]", "ZZAGENT Triple Clic B");
    await page.fill("input[type=email]", emailTriple);
    await page.fill("input[type=password]", "Demo1234!");
    const respuestasTriple = [];
    page.on("response", (r) => {
      if (r.url().includes("/auth/v1/signup")) {
        r.text().then((t) => respuestasTriple.push({ status: r.status(), cuerpo: t.slice(0, 300) })).catch(() => {
          respuestasTriple.push({ status: r.status(), cuerpo: "(no se pudo leer)" });
        });
      }
    });
    const boton = await page.$("button[type=submit]");
    await Promise.all([boton.click(), boton.click(), boton.click()]);
    await page.waitForTimeout(3500);
    const finTriple = await estadoFinal(page);
    log("H2. Clic triple en 'Crear cuenta' (con status code de cada respuesta)", {
      esperado: "Un solo signup debería viajar; si viajan 2+, el segundo debería ser rechazado sin romper la UI",
      emailUsado: emailTriple,
      respuestas: respuestasTriple,
      estadoFinalUI: finTriple,
    });
  } finally {
    await browser.close();
  }
  console.log("\n\n########## RESUMEN crear-cuenta v2 ##########");
  console.log(JSON.stringify(R, null, 2));
})();
