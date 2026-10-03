const k = require("/workspaces/codespaces-blank/.auditoria/kit/navegador.cjs");

const BIO_ORIGINAL = "Comercial e interiores con mirada de diseño. Locales y oficinas.";

async function ingresarConReintento(page, rol, intentos = 3) {
  for (let i = 1; i <= intentos; i++) {
    await k.ingresar(page, rol);
    if (!page.url().includes("/ingresar")) return page.url();
    await page.waitForTimeout(1000);
  }
  throw new Error("No se pudo loguear tras varios intentos");
}

async function leerCampos(page) {
  return page.evaluate(() => ({
    full_name: document.querySelector('input[name="full_name"]')?.value,
    location: document.querySelector('input[name="location"]')?.value,
    phone: document.querySelector('input[name="phone"]')?.value,
    bio: document.querySelector('textarea[name="bio"]')?.value,
    pros: document.querySelector('textarea[name="pros"]')?.value,
    cons: document.querySelector('textarea[name="cons"]')?.value,
  }));
}

(async () => {
  const { browser, page, eventos } = await k.abrir({ movil: false });
  try {
    await ingresarConReintento(page, "pintor2");
    await k.ir(page, "/dashboard/perfil");
    await page.waitForTimeout(300);

    const antes = await leerCampos(page);
    console.log("CAMPOS ANTES DE RESTAURAR:", JSON.stringify(antes, null, 2));

    // Corregir SOLO la bio, dejando el resto intacto (ya está en sus valores originales)
    await page.fill('textarea[name="bio"]', BIO_ORIGINAL);

    const boton = await page.$('button:has-text("Guardar perfil")');
    if (!boton) throw new Error("No encontré el botón Guardar perfil");

    // Click y esperar la navegación REAL de éxito (el server action hace redirect a /dashboard)
    // en vez de un timeout fijo, para no repetir la corrida en la que se interrumpió el guardado.
    const [nav] = await Promise.all([
      page.waitForURL((u) => u.pathname === "/dashboard", { timeout: 20000 }).catch((e) => ({ error: String(e) })),
      boton.click(),
    ]);
    console.log("Resultado espera de navegacion a /dashboard:", nav && nav.error ? nav.error : "OK, redirigio a " + page.url());

    // Si no redirigio (hubo error de validacion), revisar mensaje de error en pantalla
    if (page.url().includes("/dashboard/perfil")) {
      const textoError = await page.evaluate(() => {
        const alerta = document.querySelector('[role="alert"]');
        return alerta ? alerta.textContent : null;
      });
      console.log("SIGUE EN /dashboard/perfil. Mensaje de error visible:", textoError);
    }

    await page.waitForTimeout(500);

    // Ahora navegar de nuevo (fresco) a /dashboard/perfil para confirmar el estado guardado
    await k.ir(page, "/dashboard/perfil");
    await page.waitForTimeout(300);
    const despues = await leerCampos(page);
    console.log("CAMPOS DESPUES DE RESTAURAR (carga fresca):", JSON.stringify(despues, null, 2));
    console.log("BIO EXACTA AL ORIGINAL:", despues.bio === BIO_ORIGINAL, "| largo:", despues.bio.length, "esperado:", BIO_ORIGINAL.length);
  } finally {
    await browser.close();
  }
})();
