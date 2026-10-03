const k = require("/workspaces/codespaces-blank/.auditoria/kit/navegador.cjs");
(async () => {
  const { browser, page } = await k.abrir({ movil: false });
  try {
    await k.ir(page, "/");
    // scroll to "Probá el color" section
    const info = await page.evaluate(() => {
      const heading = [...document.querySelectorAll("h2,h3")].find(h => h.innerText.includes("Probá el color"));
      const heading2 = [...document.querySelectorAll("h2,h3")].find(h => h.innerText.includes("Cada proyecto"));
      function describe(h) {
        if (!h) return null;
        const section = h.closest("section") || h.parentElement.parentElement;
        return {
          headingText: h.innerText,
          sectionHTML: section ? section.innerHTML.slice(0, 3000) : null,
          sectionRect: section ? section.getBoundingClientRect() : null,
        };
      }
      return { paleta: describe(heading), obras: describe(heading2) };
    });
    require('fs').writeFileSync('/workspaces/codespaces-blank/.auditoria/kit/visitante/secciones_debug.json', JSON.stringify(info, null, 2));

    // Screenshot cropped area around each section
    const paletaEl = await page.$('text=Probá el color');
    await page.screenshot({ path: "/workspaces/codespaces-blank/.auditoria/kit/visitante/seccion_paleta.png", clip: { x: 0, y: 700, width: 1440, height: 700 } });
    await page.screenshot({ path: "/workspaces/codespaces-blank/.auditoria/kit/visitante/seccion_obras.png", clip: { x: 0, y: 1250, width: 1440, height: 700 } });
  } finally {
    await browser.close();
  }
})();
