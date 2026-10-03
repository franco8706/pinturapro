const k = require("/workspaces/codespaces-blank/.auditoria/kit/navegador.cjs");

// El código de /dashboard/nueva-obra/page.tsx y la action createObra NO chequean
// profile.type (sólo que haya sesión). La defensa real está en la RLS (migración 0016:
// projects_insert_own exige type='service' OR es_pintor()). Este test verifica en el
// navegador, con una cuenta 'client', qué pasa en la práctica: ¿la UI deja pasar hasta
// la base y después traduce el error de RLS con gracia, o se rompe/crashea, o -peor-
// logra publicar la obra?
const TITULO = "ZZAGENT obra fantasma de cliente";

(async () => {
  const { browser, page, eventos } = await k.abrir({ movil: false });
  const resultados = {};
  try {
    await k.ingresar(page, "cliente3"); // Sofía Luna, cuenta de tipo client
    console.log("Logueado como cliente3. URL:", page.url());

    k.limpiarEventos(eventos);
    const status = await k.ir(page, "/dashboard/nueva-obra");
    resultados.cargaForm = { status, ...(await k.auditar(page, eventos)) };
    console.log("GET /dashboard/nueva-obra como cliente ->", status, "h1:", resultados.cargaForm.h1);

    const hayForm = await page.locator('main form input[name="title"]').count();
    resultados.formularioVisible = hayForm > 0;
    if (hayForm === 0) {
      console.log("No se mostró el formulario (bloqueado antes). Fin del test.");
    } else {
      await page.fill('main form input[name="title"]', TITULO);
      k.limpiarEventos(eventos);
      // OJO: el navbar tiene su propio <form action="/auth/signout"><button type=submit>Salir</button></form>.
      // Hay que apuntar puntualmente al botón "Publicar obra" del formulario principal, si no
      // Playwright hace click en el primer form/button del DOM (el de "Salir" del navbar).
      await page.click('main form button:has-text("Publicar obra")');
      await page.waitForTimeout(2500);
      resultados.trasEnviar = { url: page.url(), ...(await k.auditar(page, eventos)) };
      const mensajeError = await page.locator('[role=alert]').innerText().catch(() => null);
      resultados.mensajeError = mensajeError;
      console.log("Tras enviar -> url:", page.url());
      console.log("Mensaje de error mostrado:", mensajeError);
      console.log(JSON.stringify(resultados.trasEnviar, null, 2));
    }

    // Verificación real: ¿la obra ZZAGENT quedó publicada en /obras (pública)?
    const pagina = await page.context().newPage();
    await pagina.goto("http://localhost:3000/obras", { waitUntil: "domcontentloaded" });
    const bodyTxt = await pagina.locator("body").innerText();
    resultados.aparecioEnObrasPublico = bodyTxt.includes(TITULO);
    console.log("¿Aparece el título ZZAGENT en /obras público?", resultados.aparecioEnObrasPublico);
    await pagina.close();
  } finally {
    await browser.close();
  }
  console.log("\n\nRESUMEN JSON:\n", JSON.stringify(resultados, null, 2));
})();
