const k = require("/workspaces/codespaces-blank/.auditoria/kit/navegador.cjs");
(async () => {
  const { browser, page, eventos } = await k.abrir({ movil: true });
  try {
    k.limpiarEventos(eventos);
    await k.ir(page, "/colores");
    await page.evaluate(async () => {
      for (let y = 0; y < document.body.scrollHeight; y += 300) {
        window.scrollTo(0, y);
        await new Promise(r => setTimeout(r, 150));
      }
    });
    await page.waitForTimeout(500);
    const info = await page.evaluate(() => {
      const swatches = document.querySelectorAll('[class*="swatch" i], button, a');
      const heading = [...document.querySelectorAll('h2,h3')].filter(h => true).map(h=>h.innerText);
      return {
        totalBotones: document.querySelectorAll('button').length,
        bodyTextSample: document.body.innerText.slice(0, 1500),
      };
    });
    console.log(JSON.stringify(info, null, 2));
    console.log("REQUESTS FALLIDOS:", JSON.stringify(eventos.requests));
    console.log("CONSOLA:", JSON.stringify(eventos.consola));
    console.log("JS ERRORS:", JSON.stringify(eventos.jsErrors));
    await page.screenshot({ path: "/workspaces/codespaces-blank/.auditoria/kit/visitante/m_colores_scrolled.png", fullPage: true });
  } finally {
    await browser.close();
  }
})();
