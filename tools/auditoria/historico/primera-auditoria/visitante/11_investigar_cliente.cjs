const k = require("/workspaces/codespaces-blank/.auditoria/kit/navegador.cjs");
(async () => {
  const { browser, page, eventos } = await k.abrir({ movil: false });
  try {
    k.limpiarEventos(eventos);
    await k.ir(page, "/pintor/225f594d-00e1-420e-b392-af2a15bd1f9d");
    const linkCalificar = await page.$('a:has-text("Calificá tus trabajos")');
    await linkCalificar.click();
    // Esperar más tiempo por si el redirect es async
    await page.waitForTimeout(2500);
    console.log("URL final tras esperar 2.5s:", page.url());
    const bodyText = await page.evaluate(() => document.body.innerText.slice(0, 1500));
    console.log("BODY TEXT:", bodyText);
    console.log("REQUESTS FALLIDOS:", JSON.stringify(eventos.requests));
    console.log("CONSOLA:", JSON.stringify(eventos.consola));
    console.log("JS ERRORS:", JSON.stringify(eventos.jsErrors));
    await page.screenshot({ path: "/workspaces/codespaces-blank/.auditoria/kit/visitante/cliente_tras_click.png", fullPage: true });

    // Ahora recargar (hard nav) estando en esa URL para ver si con reload sí redirige
    const status = await page.reload({ waitUntil: "domcontentloaded" }).then(r => r.status());
    await page.waitForTimeout(600);
    console.log("Tras RELOAD -> status:", status, "URL:", page.url());
  } finally {
    await browser.close();
  }
})();
