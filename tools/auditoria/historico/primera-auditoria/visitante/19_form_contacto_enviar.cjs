const k = require("/workspaces/codespaces-blank/.auditoria/kit/navegador.cjs");
(async () => {
  const { browser, page, eventos } = await k.abrir({ movil: false });
  try {
    k.limpiarEventos(eventos);
    await k.ir(page, "/contacto");
    await page.waitForTimeout(500);
    const campos = await page.evaluate(() => {
      return [...document.querySelectorAll('input, textarea')].map((el, i) => {
        const label = el.closest('label') || el.parentElement.querySelector('label');
        const rect = el.getBoundingClientRect();
        return { i, tag: el.tagName, type: el.type||null, labelText: label?label.innerText.trim():null, visible: rect.width>0 };
      });
    });
    console.log("Campos:", JSON.stringify(campos, null, 2));

    // Llenar por índice según lo detectado
    if (await page.$('input[type="text"]')) {}
    const inputsVisibles = campos.filter(c => c.visible);
    // Llenamos nombre, email y mensaje con heurística de label
    for (const c of campos) {
      const sel = c.tag === 'TEXTAREA' ? 'textarea' : `input`;
    }
    // Usar nth para robustez
    const nombreIdx = campos.findIndex(c => (c.labelText||'').toUpperCase().includes('NOMBRE'));
    const emailIdx = campos.findIndex(c => c.type === 'email' || (c.labelText||'').toUpperCase().includes('EMAIL'));
    const mensajeIdx = campos.findIndex(c => c.tag === 'TEXTAREA');
    console.log({nombreIdx, emailIdx, mensajeIdx});

    const allEls = await page.$$('input, textarea');
    if (nombreIdx>=0) await allEls[nombreIdx].fill('ZZAGENT Visitante Auditoria');
    if (emailIdx>=0) await allEls[emailIdx].fill('zzagent.contacto@example.com');
    if (mensajeIdx>=0) await allEls[mensajeIdx].fill('ZZAGENT mensaje de prueba de auditoria - ignorar.');

    await page.screenshot({ path: "/workspaces/codespaces-blank/.auditoria/kit/visitante/contacto_lleno.png" });

    const botonEnviar = await page.$('button[type=submit]');
    console.log("Boton submit deshabilitado?", botonEnviar ? await botonEnviar.isDisabled() : 'NO ENCONTRADO');
    k.limpiarEventos(eventos);
    if (botonEnviar) {
      await botonEnviar.click();
      await page.waitForTimeout(1200);
    }
    console.log("URL tras enviar:", page.url());
    console.log((await page.evaluate(() => document.body.innerText)).slice(0, 900));
    console.log("REQUESTS FALLIDOS:", JSON.stringify(eventos.requests));
    console.log("CONSOLA:", JSON.stringify(eventos.consola));
  } finally {
    await browser.close();
  }
})();
