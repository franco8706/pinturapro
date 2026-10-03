const k = require("/workspaces/codespaces-blank/.auditoria/kit/navegador.cjs");
(async () => {
  const { browser, page } = await k.abrir({ movil: false });
  try {
    await k.ir(page, "/");
    await page.evaluate(async () => {
      for (let y = 0; y < document.body.scrollHeight; y += 300) {
        window.scrollTo(0, y);
        await new Promise(r => setTimeout(r, 150));
      }
    });
    const rect = await page.evaluate(() => {
      const h = [...document.querySelectorAll('h2')].find(h => h.innerText.includes('empezar'));
      const r = h.getBoundingClientRect();
      return { top: r.top + window.scrollY, left: r.left, width: r.width, height: r.height };
    });
    console.log(JSON.stringify(rect));
    await page.evaluate((y) => window.scrollTo(0, y - 150), rect.top);
    await page.waitForTimeout(300);
    await page.screenshot({ path: "/workspaces/codespaces-blank/.auditoria/kit/visitante/zoom_cta_final.png" });

    const sospechosos = await page.evaluate(() => {
      const out = [];
      document.querySelectorAll('*').forEach(el => {
        const cs = getComputedStyle(el);
        if (cs.position === 'fixed' || cs.position === 'sticky') {
          const r = el.getBoundingClientRect();
          out.push({ tag: el.tagName, cls: String(el.className).slice(0,60), position: cs.position, opacity: cs.opacity, zIndex: cs.zIndex, rect: {top:r.top,left:r.left,w:r.width,h:r.height} });
        }
      });
      return out;
    });
    console.log(JSON.stringify(sospechosos, null, 2));
  } finally {
    await browser.close();
  }
})();
