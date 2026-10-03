/**
 * ¿Cuánto se pasa el color sobre la moldura clara que hay a la izquierda de la pared?
 * La moldura ocupa, en la foto original de 1200px, la franja x=70..96 (y=120..730).
 */
const k = require("/workspaces/codespaces-blank/.auditoria/kit/navegador.cjs");
const FOTOS = "/workspaces/codespaces-blank/.auditoria/fotos";
(async () => {
  const { browser, page } = await k.abrir({ movil: false });
  try {
    await k.ir(page, "/simulador");
    await page.setInputFiles('input[type=file]', `${FOTOS}/01-living-luz.jpg`);
    await page.waitForSelector("canvas", { timeout: 40000 });
    await page.waitForTimeout(2500);
    await page.click('button:has-text("Azul Profundo")');
    await page.evaluate(() => {
      const c = document.querySelector("canvas");
      window.__antes = c.getContext("2d", { willReadFrequently: true }).getImageData(0, 0, c.width, c.height).data.slice();
      document.querySelector("canvas").scrollIntoView({ block: "center" });
    });
    await page.waitForTimeout(400);
    const box = await page.locator("canvas").boundingBox();
    await page.mouse.click(box.x + box.width * 0.35, box.y + box.height * 0.35);
    await page.waitForTimeout(2200);

    console.log(JSON.stringify(await page.evaluate(() => {
      const c = document.querySelector("canvas");
      const W = c.width, H = c.height;
      const ahora = c.getContext("2d", { willReadFrequently: true }).getImageData(0, 0, W, H).data;
      const antes = window.__antes;
      const cambio = (x, y) => {
        const i = (y * W + x) * 4;
        return Math.abs(ahora[i] - antes[i]) + Math.abs(ahora[i+1] - antes[i+1]) + Math.abs(ahora[i+2] - antes[i+2]);
      };
      // franja de la moldura, en coordenadas del canvas
      const x0 = Math.round(70 / 1200 * W), x1 = Math.round(96 / 1200 * W);
      const y0 = Math.round(140 / 800 * H), y1 = Math.round(700 / 800 * H);
      let pintados = 0, total = 0;
      for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) { total++; if (cambio(x, y) > 12) pintados++; }
      // perfil: cuánto cambia cada columna alrededor del borde derecho de la moldura
      const perfil = [];
      for (let dx = -6; dx <= 8; dx++) {
        let suma = 0, n = 0;
        for (let y = y0; y < y1; y += 3) { suma += cambio(x1 + dx, y); n++; }
        perfil.push({ px: dx, cambioMedio: Math.round(suma / n) });
      }
      return { anchoMolduraPx: x1 - x0, molduraPintada: +(pintados / total * 100).toFixed(1), perfil };
    }), null, 2));
  } finally { await browser.close(); }
})();
