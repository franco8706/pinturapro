const k = require("/workspaces/codespaces-blank/.auditoria/kit/navegador.cjs");
(async () => {
  const { browser, page } = await k.abrir({ movil: false });
  try {
    await k.ir(page, "/obras");
    await page.waitForTimeout(500);

    async function estado(etiqueta) {
      const titulos = await page.evaluate(() => [...document.querySelectorAll('a[href^="/obras/"] h3, a[href^="/obras/"] h2')].map(h=>h.innerText.trim()));
      const botonActivo = await page.evaluate(() => {
        const btns = [...document.querySelectorAll('button')];
        return btns.filter(b => b.className.includes('bg-ink') || b.getAttribute('aria-pressed')==='true' || b.className.includes('active')).map(b=>b.innerText.trim());
      });
      console.log(etiqueta, "-> titulos:", JSON.stringify(titulos), "| botonesActivos:", JSON.stringify(botonActivo));
    }

    await estado("TODAS (inicial)");
    await page.click('button:has-text("Residencial")');
    await page.waitForTimeout(500);
    await estado("Tras click RESIDENCIAL");
    await page.click('button:has-text("Comercial")');
    await page.waitForTimeout(500);
    await estado("Tras click COMERCIAL");
    await page.click('button:has-text("Industrial")');
    await page.waitForTimeout(500);
    await estado("Tras click INDUSTRIAL");
    await page.click('button:has-text("Todas")');
    await page.waitForTimeout(500);
    await estado("Tras click TODAS de nuevo");
  } finally {
    await browser.close();
  }
})();
