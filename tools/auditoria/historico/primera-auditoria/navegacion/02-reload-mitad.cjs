const k = require("/workspaces/codespaces-blank/.auditoria/kit/navegador.cjs");

// Ni /cotizar ni /publicar ni /dashboard/nueva-obra tienen un handler `beforeunload` en el
// código (grep confirmado). Los tres son wizards multi-paso con estado 100% en React
// (useState), sin persistir nada en localStorage/sessionStorage. Este test confirma en el
// navegador qué pasa si alguien recarga a mitad de camino: ¿pierde todo en silencio, sin
// ningún aviso ("¿Perderás los cambios?"), o el navegador society interviene?
(async () => {
  const { browser, page, eventos } = await k.abrir({ movil: false });
  const resultados = {};
  let huboDialogoConfirmacion = false;
  page.on("dialog", async (d) => {
    huboDialogoConfirmacion = true;
    console.log("¡Apareció un diálogo nativo del navegador!:", d.type(), d.message());
    await d.dismiss().catch(() => {});
  });

  try {
    // ── /cotizar: público, sin login ──
    await k.ir(page, "/cotizar");
    await page.locator('button:has-text("Interior")').first().click();
    await page.waitForTimeout(300);
    await page.locator('button:has-text("Continuar")').first().click();
    await page.waitForTimeout(300);
    await page.locator('input[type=number]').fill("77"); // m² a mitad del paso 2, SIN avanzar
    resultados.cotizarAntesDeRecargar = await k.auditar(page, eventos);
    console.log("/cotizar: cargado paso 2 con 77m², sin avanzar. h1:", resultados.cotizarAntesDeRecargar.h1);

    k.limpiarEventos(eventos);
    huboDialogoConfirmacion = false;
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.waitForTimeout(800);
    resultados.cotizarTrasRecargar = { huboDialogoConfirmacion, ...(await k.auditar(page, eventos)) };
    const superficieResidual = await page.locator('input[type=number]').inputValue().catch(() => null);
    resultados.cotizarTrasRecargar.superficieResidual = superficieResidual;
    console.log("/cotizar tras reload: h1:", resultados.cotizarTrasRecargar.h1, "| ¿hubo diálogo nativo?", huboDialogoConfirmacion, "| superficie residual:", superficieResidual);

    // ── /publicar: requiere login ──
    await k.ingresar(page, "cliente4");
    console.log("\nLogueado como cliente4. URL:", page.url());
    await k.ir(page, "/publicar");
    const TITULO_PARCIAL = "ZZAGENT publicar a medio completar (no debería persistir)";
    await page.locator('input[placeholder*="Pintura interior"]').fill(TITULO_PARCIAL);
    await page.locator('button:has-text("interior")').first().click();
    resultados.publicarAntesDeRecargar = await k.auditar(page, eventos);
    console.log("/publicar: paso 1 completado (título+tipo), SIN avanzar de paso. h1:", resultados.publicarAntesDeRecargar.h1);

    k.limpiarEventos(eventos);
    huboDialogoConfirmacion = false;
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.waitForTimeout(800);
    resultados.publicarTrasRecargar = { huboDialogoConfirmacion, ...(await k.auditar(page, eventos)) };
    const tituloResidual = await page.locator('input[placeholder*="Pintura interior"]').inputValue().catch(() => null);
    resultados.publicarTrasRecargar.tituloResidual = tituloResidual;
    console.log("/publicar tras reload: h1:", resultados.publicarTrasRecargar.h1, "| ¿hubo diálogo nativo?", huboDialogoConfirmacion, "| título residual:", JSON.stringify(tituloResidual));

    // Verificación real: confirmar que el título ZZAGENT nunca llegó a publicarse (se perdió antes de enviar).
    const panelCliente = await page.context().newPage();
    await panelCliente.goto("http://localhost:3000/cliente", { waitUntil: "domcontentloaded" });
    const apareceIgual = await panelCliente.locator(`text=${TITULO_PARCIAL}`).count();
    resultados.apareceEnPanelClienteTrasReload = apareceIgual;
    console.log("¿El título parcial quedó publicado en /cliente pese a la recarga?", apareceIgual > 0);
    await panelCliente.close();
  } finally {
    await browser.close();
  }
  console.log("\n\nRESUMEN JSON:\n", JSON.stringify(resultados, null, 2));
})();
