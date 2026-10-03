const k = require("/workspaces/codespaces-blank/.auditoria/kit/navegador.cjs");
(async () => {
  const { browser, page, eventos } = await k.abrir({ movil: false });
  try {
    // Botón "Solicitar presupuesto"
    k.limpiarEventos(eventos);
    await k.ir(page, "/pintor/225f594d-00e1-420e-b392-af2a15bd1f9d");
    const linkSolicitar = await page.$('a:has-text("Solicitar presupuesto")');
    const hrefSolicitar = linkSolicitar ? await linkSolicitar.getAttribute("href") : null;
    console.log("href Solicitar presupuesto:", hrefSolicitar);
    if (linkSolicitar) {
      await linkSolicitar.click();
      await page.waitForTimeout(600);
      console.log("URL tras click Solicitar presupuesto:", page.url());
    }

    // Volver y probar "Calificá tus trabajos terminados"
    await k.ir(page, "/pintor/225f594d-00e1-420e-b392-af2a15bd1f9d");
    const linkCalificar = await page.$('a:has-text("Calificá tus trabajos")');
    const hrefCalificar = linkCalificar ? await linkCalificar.getAttribute("href") : null;
    console.log("href Calificar:", hrefCalificar);
    if (linkCalificar) {
      await linkCalificar.click();
      await page.waitForTimeout(600);
      console.log("URL tras click Calificar:", page.url());
      console.log("Status/h1:", JSON.stringify(await k.auditar(page, eventos)));
    }
  } finally {
    await browser.close();
  }
})();
