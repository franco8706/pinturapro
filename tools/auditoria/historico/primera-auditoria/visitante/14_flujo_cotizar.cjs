const k = require("/workspaces/codespaces-blank/.auditoria/kit/navegador.cjs");
(async () => {
  const { browser, page, eventos } = await k.abrir({ movil: false });
  try {
    k.limpiarEventos(eventos);
    await k.ir(page, "/cotizar");
    await page.waitForTimeout(600);

    // Paso 1: elegir "Interior"
    await page.click('text=Interior');
    await page.waitForTimeout(300);
    await page.click('button:has-text("Continuar")');
    await page.waitForTimeout(600);
    console.log("--- PASO 2 ---");
    console.log((await page.evaluate(() => document.body.innerText)).slice(0, 1200));
    await page.screenshot({ path: "/workspaces/codespaces-blank/.auditoria/kit/visitante/cotizar_paso2.png" });

    // Intentar avanzar sin llenar nada, ver si continuar está deshabilitado / qué pide
    const opciones = await page.evaluate(() => [...document.querySelectorAll('button,label,input')].slice(0,30).map(e=>({tag:e.tagName,text:(e.innerText||e.value||'').slice(0,40)})));
    console.log("Elementos paso 2:", JSON.stringify(opciones));
  } finally {
    await browser.close();
  }
})();
