const k = require("/workspaces/codespaces-blank/.auditoria/kit/navegador.cjs");
const { sacarRestricciones, contarPosts, textoLargo, XSS, SQLI } = require("./_ayuda.cjs");

const R = [];
function log(caso, detalle) {
  R.push({ caso, ...detalle });
  console.log("\n=== " + caso + " ===");
  console.log(JSON.stringify(detalle, null, 2));
}

async function leerValoresActuales(page) {
  return page.evaluate(() => ({
    full_name: document.querySelector('input[name="full_name"]')?.value ?? "",
    location: document.querySelector('input[name="location"]')?.value ?? "",
    phone: document.querySelector('input[name="phone"]')?.value ?? "",
    bio: document.querySelector('textarea[name="bio"]')?.value ?? "",
    pros: document.querySelector('textarea[name="pros"]')?.value ?? "",
    cons: document.querySelector('textarea[name="cons"]')?.value ?? "",
  }));
}

async function llenar(page, valores) {
  if (valores.full_name !== undefined) await page.fill('input[name="full_name"]', valores.full_name);
  if (valores.location !== undefined) await page.fill('input[name="location"]', valores.location);
  if (valores.phone !== undefined) await page.fill('input[name="phone"]', valores.phone);
  if (valores.bio !== undefined) await page.fill('textarea[name="bio"]', valores.bio);
  if (valores.pros !== undefined) await page.fill('textarea[name="pros"]', valores.pros);
  if (valores.cons !== undefined) await page.fill('textarea[name="cons"]', valores.cons);
}

(async () => {
  const { browser, page, eventos } = await k.abrir({ movil: false });
  try {
    await k.ingresar(page, "pintor3");
    await k.ir(page, "/dashboard/perfil");
    const original = await leerValoresActuales(page);
    log("Setup: valores originales de pintor3 (para restaurar al final)", original);

    // B: nombre de solo espacios (server: full_name.trim().length<2 → debería rechazar)
    await sacarRestricciones(page);
    await llenar(page, { full_name: "   ", bio: original.bio });
    await page.click('button[type="submit"]');
    await page.waitForTimeout(1500);
    const errorB = await page.locator('[role="alert"]').innerText().catch(() => null);
    log("B. Nombre de solo espacios", {
      esperado: "Rechazado con 'Ingresá tu nombre.'",
      mensajeError: errorB,
      urlActual: page.url(),
    });

    // C+D: bio de 10.000 caracteres con XSS/SQLi embebido
    await k.ir(page, "/dashboard/perfil");
    await sacarRestricciones(page);
    const bioHostil = `ZZAGENT ${XSS} ${SQLI} ` + textoLargo(10000);
    await llenar(page, { full_name: "ZZAGENT Pintor Tres", bio: bioHostil });
    await page.click('button[type="submit"]');
    await page.waitForTimeout(2000);
    log("C+D. Bio de ~10.000 caracteres con XSS/SQLi", {
      esperado: "El server no trunca `bio` (a diferencia de `comment` en reseñas) → posible rotura visual en /pintor/[id] público",
      urlFinalTrasGuardar: page.url(),
    });

    // Verificar impacto visual en el perfil público del pintor3 (Diego Sosa)
    await k.ir(page, "/pintores");
    const hrefPropio = await page.evaluate(() => {
      const link = [...document.querySelectorAll('a[href^="/pintor/"]')].find((a) =>
        a.innerText.includes("Diego"),
      );
      return link ? link.getAttribute("href") : null;
    });
    await k.ir(page, hrefPropio || "/pintor/no-encontrado");
    k.limpiarEventos(eventos);
    const auditPerfil = await k.auditar(page, eventos);
    log("Impacto visual: bio gigante en /pintor/[id] (perfil PÚBLICO)", {
      esperado: "No debería romper el layout de una página pública",
      scrollHorizontal: auditPerfil.scrollHorizontal,
      elementosFueraDePantalla: auditPerfil.elementosFueraDePantalla,
      textosProhibidos: auditPerfil.textosProhibidos,
    });

    // F: teléfono malformado (letras, símbolos) — server sólo hace trim+slice(40), sin regex
    await k.ir(page, "/dashboard/perfil");
    await sacarRestricciones(page);
    await llenar(page, { full_name: "ZZAGENT Pintor Tres", phone: "no-es-un-telefono !!! +++", bio: "ZZAGENT bio normal" });
    await page.click('button[type="submit"]');
    await page.waitForTimeout(1500);
    log('F. Teléfono = "no-es-un-telefono !!! +++"', {
      esperado: "El server no valida formato de teléfono (guarda cualquier string ≤40 caracteres) — mismo patrón que /registro",
      urlFinal: page.url(),
    });

    // H: clic triple en 'Guardar perfil' con datos válidos
    await k.ir(page, "/dashboard/perfil");
    await llenar(page, { full_name: "ZZAGENT Pintor Tres Triple", bio: "ZZAGENT bio triple click" });
    const posts = contarPosts(page);
    const boton = page.locator('button[type="submit"]');
    await Promise.all([boton.click(), boton.click(), boton.click()]);
    await page.waitForTimeout(2000);
    log("H. Clic triple en 'Guardar perfil'", {
      esperado: "Como es un UPDATE (no INSERT), duplicar el request no crea filas extra, pero no debería romper la UI",
      postsDisparados: posts.length,
      urlFinal: page.url(),
    });

    // --- RESTAURAR datos originales de pintor3 ---
    await k.ir(page, "/dashboard/perfil");
    await llenar(page, original);
    await page.click('button[type="submit"]');
    await page.waitForTimeout(1500);
    await k.ir(page, "/dashboard/perfil");
    const restaurado = await leerValoresActuales(page);
    log("Cleanup: restauración de valores originales de pintor3", { original, restaurado, coincide: JSON.stringify(original) === JSON.stringify(restaurado) });
  } finally {
    await browser.close();
  }
  console.log("\n\n########## RESUMEN perfil ##########");
  console.log(JSON.stringify(R, null, 2));
})();
