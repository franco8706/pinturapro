const k = require("/workspaces/codespaces-blank/.auditoria/kit/navegador.cjs");

const BIO_ORIGINAL = "Comercial e interiores con mirada de diseño. Locales y oficinas.";
const BIO_NUEVA = BIO_ORIGINAL + " ZZAGENT";

async function leerBio(page) {
  return page.$eval('textarea[name="bio"]', (el) => el.value);
}

async function guardar(page) {
  // Buscar el botón "Guardar perfil"
  const boton = await page.$('button:has-text("Guardar perfil")');
  if (!boton) throw new Error("No encontré el botón Guardar perfil");
  await boton.click();
  await page.waitForTimeout(1500);
}

async function ingresarConReintento(page, rol, intentos = 3) {
  for (let i = 1; i <= intentos; i++) {
    await k.ingresar(page, rol);
    if (!page.url().includes("/ingresar")) return page.url();
    console.log(`Login intento ${i} fallo, reintentando...`);
    await page.waitForTimeout(1000);
  }
  throw new Error("No se pudo loguear tras varios intentos");
}

(async () => {
  const { browser, page, eventos } = await k.abrir({ movil: false });
  try {
    await ingresarConReintento(page, "pintor2");
    let status = await k.ir(page, "/dashboard/perfil");
    console.log("STATUS carga inicial:", status, page.url());
    if (page.url().includes("/ingresar")) {
      // sesion se perdio al navegar, reintentar login
      await ingresarConReintento(page, "pintor2");
      status = await k.ir(page, "/dashboard/perfil");
      console.log("STATUS tras reintento login:", status, page.url());
    }

    const bioInicial = await leerBio(page);
    console.log("BIO ANTES DE TOCAR (debe ser el original):", JSON.stringify(bioInicial));

    k.limpiarEventos(eventos);

    // Paso 1: editar bio agregando sufijo ZZAGENT
    await page.fill('textarea[name="bio"]', BIO_NUEVA);
    console.log("Valor tipeado en textarea bio:", JSON.stringify(await leerBio(page)));

    await guardar(page);
    const auditoriaGuardado = await k.auditar(page, eventos);
    console.log("--- AUDITORIA TRAS GUARDAR (con ZZAGENT) ---");
    console.log(JSON.stringify(auditoriaGuardado, null, 2));

    // Mensaje de éxito/error visible
    const textoTrasGuardar = await page.evaluate(() => document.body.innerText.slice(0, 1500));
    console.log("--- TEXTO VISIBLE TRAS GUARDAR ---");
    console.log(textoTrasGuardar);

    // Paso 2: recargar página para verificar persistencia
    status = await k.ir(page, "/dashboard/perfil");
    const bioTrasRecargar = await leerBio(page);
    console.log("STATUS recarga:", status);
    console.log("BIO TRAS RECARGAR (debe tener ZZAGENT):", JSON.stringify(bioTrasRecargar));
    console.log("COINCIDE CON LO ESPERADO:", bioTrasRecargar === BIO_NUEVA);

    // Paso 3: restaurar valor original
    k.limpiarEventos(eventos);
    await page.fill('textarea[name="bio"]', BIO_ORIGINAL);
    await guardar(page);
    const auditoriaRestauracion = await k.auditar(page, eventos);
    console.log("--- AUDITORIA TRAS RESTAURAR ---");
    console.log(JSON.stringify(auditoriaRestauracion, null, 2));

    // Paso 4: recargar y confirmar restauración
    status = await k.ir(page, "/dashboard/perfil");
    const bioFinal = await leerBio(page);
    console.log("STATUS recarga final:", status);
    console.log("BIO FINAL (debe ser el original):", JSON.stringify(bioFinal));
    console.log("RESTAURACION EXITOSA:", bioFinal === BIO_ORIGINAL);
  } finally {
    await browser.close();
  }
})();
