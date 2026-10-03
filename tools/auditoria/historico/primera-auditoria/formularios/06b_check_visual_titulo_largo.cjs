const k = require("/workspaces/codespaces-blank/.auditoria/kit/navegador.cjs");

(async () => {
  const { browser, page, eventos } = await k.abrir({ movil: false });
  try {
    await k.ir(page, "/trabajos");
    k.limpiarEventos(eventos);
    const r = await k.auditar(page, eventos);
    console.log(JSON.stringify(r, null, 2));
    // Además, medir el ancho real de la tarjeta con el título largo.
    const info = await page.evaluate(() => {
      const h2s = [...document.querySelectorAll("h2")];
      const largo = h2s.find((h) => h.innerText.includes("ZZAGENT XX") || h.innerText.length > 200);
      if (!largo) return { encontrado: false, totalH2: h2s.length, largos: h2s.map((h) => h.innerText.length) };
      const rect = largo.getBoundingClientRect();
      return { encontrado: true, largoTexto: largo.innerText.length, rect: { width: rect.width, height: rect.height } };
    });
    console.log("info titulo largo:", JSON.stringify(info, null, 2));
  } finally {
    await browser.close();
  }
})();
