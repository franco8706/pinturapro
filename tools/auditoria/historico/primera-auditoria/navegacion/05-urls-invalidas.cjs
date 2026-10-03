const k = require("/workspaces/codespaces-blank/.auditoria/kit/navegador.cjs");

(async () => {
  const { browser, page, eventos } = await k.abrir({ movil: false });
  const resultados = {};
  const rutas = [
    "/obras/zzagent-slug-que-no-existe-123",
    "/pintor/00000000-0000-0000-0000-000000000000",
    "/pintor/basura-no-es-uuid",
  ];
  try {
    for (const ruta of rutas) {
      k.limpiarEventos(eventos);
      const status = await k.ir(page, ruta);
      const info = await k.auditar(page, eventos);
      // Chequeo específico: ¿hay algún link de salida útil? (home, buscar, etc.)
      const linksSalida = await page.evaluate(() => {
        return [...document.querySelectorAll("a")]
          .map((a) => ({ texto: a.innerText.trim(), href: a.getAttribute("href") }))
          .filter((a) => a.texto);
      });
      resultados[ruta] = { status, ...info, cantidadLinks: linksSalida.length, algunosLinks: linksSalida.slice(0, 8) };
      console.log(`=== ${ruta} -> status ${status} ===`);
      console.log(JSON.stringify(resultados[ruta], null, 2));
    }
  } finally {
    await browser.close();
  }
  console.log("\n\nRESUMEN JSON:\n", JSON.stringify(resultados, null, 2));
})();
