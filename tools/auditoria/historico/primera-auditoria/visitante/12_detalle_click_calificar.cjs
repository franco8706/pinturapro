const k = require("/workspaces/codespaces-blank/.auditoria/kit/navegador.cjs");
(async () => {
  const { browser, page, eventos } = await k.abrir({ movil: false });
  const historial = [];
  page.on("framenavigated", (frame) => {
    if (frame === page.mainFrame()) historial.push({ t: Date.now(), url: frame.url() });
  });
  const requests = [];
  page.on("response", (r) => requests.push({ t: Date.now(), status: r.status(), url: r.url().slice(0,150) }));
  try {
    await k.ir(page, "/pintor/225f594d-00e1-420e-b392-af2a15bd1f9d");
    await page.waitForTimeout(1000); // asegurar hidratación completa
    const t0 = Date.now();
    const linkCalificar = await page.$('a:has-text("Calificá tus trabajos")');
    await linkCalificar.click();
    for (let i = 0; i < 15; i++) {
      await page.waitForTimeout(200);
      console.log(`+${Date.now()-t0}ms url=${page.url()}`);
    }
  } finally {
    console.log("HISTORIAL NAV:", JSON.stringify(historial.map(h => ({...h, t: h.t}))));
    console.log("RESPONSES (no-200):", JSON.stringify(requests.filter(r => r.status !== 200 && r.url.includes('localhost'))));
    await browser.close();
  }
})();
