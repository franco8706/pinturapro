const k = require("/workspaces/codespaces-blank/.auditoria/kit/navegador.cjs");
(async () => {
  const filas = [];
  for (const movil of [true, false]) {
    const { browser, page, eventos } = await k.abrir({ movil });
    try {
      await k.ingresar(page, "admin");
      for (const ruta of ["/panel", "/admin", "/trabajos"]) {
        await k.ir(page, ruta);
        const a = await k.auditar(page, eventos);
        filas.push({ pantalla: `${ruta} ${movil ? "(celular)" : "(escritorio)"}`, scrollHorizontal: a.scrollHorizontal, anchoDoc: await page.evaluate(() => document.documentElement.scrollWidth), ventana: await page.evaluate(() => window.innerWidth), fuera: a.elementosFueraDePantalla.length });
        k.limpiarEventos(eventos);
      }
    } finally { await browser.close(); }
  }
  console.log(JSON.stringify(filas, null, 2));
})();
