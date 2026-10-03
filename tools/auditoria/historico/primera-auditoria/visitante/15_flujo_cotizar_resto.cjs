const k = require("/workspaces/codespaces-blank/.auditoria/kit/navegador.cjs");
(async () => {
  const { browser, page, eventos } = await k.abrir({ movil: false });
  try {
    k.limpiarEventos(eventos);
    await k.ir(page, "/cotizar");
    await page.waitForTimeout(500);
    await page.click('text=Interior');
    await page.waitForTimeout(300);
    await page.click('button:has-text("Continuar")');
    await page.waitForTimeout(500);
    // Paso 2: elegir 70 m2
    await page.click('button:has-text("70 m²")');
    await page.waitForTimeout(300);
    await page.click('button:has-text("Continuar")');
    await page.waitForTimeout(600);
    console.log("--- PASO 3 ---");
    console.log((await page.evaluate(() => document.body.innerText)).slice(0, 1500));
    await page.screenshot({ path: "/workspaces/codespaces-blank/.auditoria/kit/visitante/cotizar_paso3.png" });

    const botones3 = await page.evaluate(() => [...document.querySelectorAll('button')].map(b=>b.innerText.trim()).filter(Boolean));
    console.log("Botones paso 3:", JSON.stringify(botones3));

    // Elegir la primera opción disponible que no sea Atrás/Continuar/No completar, para cada pregunta si aplica
    // Intentar click en primer botón "seleccionable" (heurística: no es Atrás/Continuar)
    const candidato = botones3.find(t => !['← Atrás','Continuar →','No completar'].includes(t));
    if (candidato) {
      await page.click(`button:has-text("${candidato.split('\n')[0]}")`);
      await page.waitForTimeout(300);
    }
    await page.click('button:has-text("Continuar")');
    await page.waitForTimeout(700);
    console.log("--- PASO 4 (o resultado) ---");
    console.log((await page.evaluate(() => document.body.innerText)).slice(0, 2000));
    await page.screenshot({ path: "/workspaces/codespaces-blank/.auditoria/kit/visitante/cotizar_paso4.png", fullPage: true });
    console.log("URL actual:", page.url());
    console.log("REQUESTS FALLIDOS:", JSON.stringify(eventos.requests));
    console.log("CONSOLA:", JSON.stringify(eventos.consola));
  } finally {
    await browser.close();
  }
})();
