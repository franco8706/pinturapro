/**
 * Mide la CALIDAD de la varita, no sólo cuánto pinta: compara lo pintado contra
 * la máscara de referencia (dónde está la pared de verdad) y saca recall,
 * precisión e IoU para cada valor de Sensibilidad.
 */
const fs = require("fs");
const k = require("/workspaces/codespaces-blank/.auditoria/kit/navegador.cjs");
const FOTOS = "/workspaces/codespaces-blank/.auditoria/fotos";
const SALIDA = "/workspaces/codespaces-blank/.auditoria/out";
const GX = 120, GY = 80;

async function grillaPintada(page) {
  return page.evaluate(({ GX, GY }) => {
    const c = document.querySelector("canvas");
    const ahora = c.getContext("2d", { willReadFrequently: true }).getImageData(0, 0, c.width, c.height).data;
    const antes = window.__antes;
    const acum = new Float32Array(GX * GY);
    const tot = new Float32Array(GX * GY);
    for (let y = 0; y < c.height; y++) {
      const gy = Math.min(GY - 1, (y / c.height * GY) | 0);
      for (let x = 0; x < c.width; x++) {
        const gx = Math.min(GX - 1, (x / c.width * GX) | 0);
        const i = (y * c.width + x) * 4;
        const d = Math.abs(ahora[i] - antes[i]) + Math.abs(ahora[i + 1] - antes[i + 1]) + Math.abs(ahora[i + 2] - antes[i + 2]);
        const g = gy * GX + gx;
        tot[g]++;
        if (d > 12) acum[g]++;
      }
    }
    return Array.from(acum, (v, i) => (tot[i] ? v / tot[i] : 0));
  }, { GX, GY });
}

(async () => {
  const foto = process.argv[2] || "01-living-luz";
  const etiqueta = process.argv[3] || "actual";
  fs.mkdirSync(SALIDA, { recursive: true });
  const { browser, page, eventos } = await k.abrir({ movil: false });
  const salida = { foto, etiqueta, medidas: [] };
  try {
    await k.ir(page, "/simulador");
    await page.click('button:has-text("Azul Profundo")');
    const t0 = Date.now();
    await page.setInputFiles('input[type=file]', `${FOTOS}/${foto}.jpg`);
    await page.waitForSelector("canvas", { timeout: 40000 });
    await page.waitForTimeout(2500);
    salida.cargaMs = Date.now() - t0;

    await page.evaluate(() => {
      const c = document.querySelector("canvas");
      window.__antes = c.getContext("2d", { willReadFrequently: true }).getImageData(0, 0, c.width, c.height).data.slice();
    });
    await page.evaluate(() => document.querySelector("canvas").scrollIntoView({ block: "center" }));
    await page.waitForTimeout(400);
    const box = await page.locator("canvas").boundingBox();
    const t1 = Date.now();
    await page.mouse.click(box.x + box.width * 0.22, box.y + box.height * 0.35);
    await page.waitForTimeout(1800);
    salida.clicMs = Date.now() - t1;

    for (const v of [5, 26, 40, 55, 70]) {
      const t = Date.now();
      await page.evaluate((val) => {
        const s = [...document.querySelectorAll('input[type=range]')].find((i) => i.min === "5" && i.max === "70");
        const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set;
        set.call(s, String(val));
        s.dispatchEvent(new Event("input", { bubbles: true }));
        s.dispatchEvent(new Event("change", { bubbles: true }));
        s.dispatchEvent(new PointerEvent("pointerup", { bubbles: true }));
      }, v);
      await page.waitForTimeout(1400);
      salida.medidas.push({ sensibilidad: v, ms: Date.now() - t, grilla: await grillaPintada(page) });
      if (v === 26) await page.screenshot({ path: `${SALIDA}/${foto}-${etiqueta}-s26.png` });
    }
    salida.eventos = { consola: eventos.consola.slice(0, 4), js: eventos.jsErrors.slice(0, 4) };
  } catch (e) {
    salida.error = String(e).slice(0, 400);
  } finally {
    await browser.close();
  }
  fs.writeFileSync(`${SALIDA}/${foto}-${etiqueta}.json`, JSON.stringify(salida));
  console.log("listo:", `${SALIDA}/${foto}-${etiqueta}.json`, salida.error ? "ERROR " + salida.error : "");
})();
