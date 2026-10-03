const k = require("/workspaces/codespaces-blank/.auditoria/kit/navegador.cjs");
(async () => {
  const { browser, page, eventos } = await k.abrir({ movil: false });
  try {
    k.limpiarEventos(eventos);
    await k.ir(page, "/contacto");
    await page.waitForTimeout(500);
    await page.fill('input[type="text"]', 'ZZAGENT Visitante Auditoria2');
    await page.fill('input[type="email"]', 'zzagent.contacto2@example.com');
    await page.fill('textarea', 'ZZAGENT mensaje de prueba de auditoria - ignorar (2).');
    await page.click('button[type=submit]');
    for (let i=0;i<10;i++){
      await page.waitForTimeout(500);
      const texto = await page.evaluate(()=>document.body.innerText.slice(0,600));
      console.log(`+${(i+1)*500}ms:`, texto.split('\n').filter(Boolean).slice(-6).join(' | '));
    }
    console.log("REQUESTS FALLIDOS:", JSON.stringify(eventos.requests));
    console.log("CONSOLA:", JSON.stringify(eventos.consola));
    console.log("JS ERRORS:", JSON.stringify(eventos.jsErrors));
    await page.screenshot({ path: "/workspaces/codespaces-blank/.auditoria/kit/visitante/contacto_final.png" });
  } finally {
    await browser.close();
  }
})();
