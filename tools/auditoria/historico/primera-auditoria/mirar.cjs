const k = require("/workspaces/codespaces-blank/.auditoria/kit/navegador.cjs");
const FOTOS = "/workspaces/codespaces-blank/.auditoria/fotos";
const OUT = "/workspaces/codespaces-blank/.auditoria/out";
(async () => {
  const { browser, page, eventos } = await k.abrir({ movil: false });
  const tiempos = [];
  try {
    await k.ir(page, "/simulador");
    await page.setInputFiles('input[type=file]', `${FOTOS}/01-living-luz.jpg`);
    await page.waitForSelector("canvas", { timeout: 40000 });
    await page.waitForTimeout(2500);
    await page.click('button:has-text("Arena")');
    await page.evaluate(() => document.querySelector("canvas").scrollIntoView({ block: "center" }));
    await page.waitForTimeout(400);
    const box = await page.locator("canvas").boundingBox();
    let t = Date.now();
    await page.mouse.click(box.x + box.width * 0.22, box.y + box.height * 0.35);
    await page.waitForTimeout(1800);
    tiempos.push({ accion: "clic de la varita (incluye espera fija de 1,8 s)", ms: Date.now() - t });
    for (const c of ["Negro Mate", "Blanco Puro"]) {
      t = Date.now();
      await page.click(`button:has-text("${c}")`);
      await page.waitForFunction(() => true);
      await page.waitForTimeout(900);
      tiempos.push({ accion: `cambiar a ${c} (incluye espera fija de 0,9 s)`, ms: Date.now() - t });
      await page.locator("canvas").screenshot({ path: `${OUT}/mirar-${c.replace(/ /g, "-").toLowerCase()}.png` });
    }
    // medir el repintado puro dentro de la página
    const puro = await page.evaluate(() => {
      const c = document.querySelector("canvas");
      const t0 = performance.now();
      c.getContext("2d").getImageData(0, 0, c.width, c.height);
      return { lecturaCanvasMs: +(performance.now() - t0).toFixed(1), w: c.width, h: c.height };
    });
    console.log(JSON.stringify({ tiempos, puro, js: eventos.jsErrors.slice(0, 3) }, null, 2));
  } finally { await browser.close(); }
})();
