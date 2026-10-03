/**
 * Mide el simulador de verdad, en el navegador: cuánta superficie pinta cada clic
 * de la varita y si el slider de Sensibilidad cambia algo.
 *
 * Un sub-agente reportó que de 5 a 70 la cobertura quedaba clavada en 87,16%.
 */
const fs = require("fs");
const k = require("/workspaces/codespaces-blank/.auditoria/kit/navegador.cjs");

const FOTOS = "/workspaces/codespaces-blank/.auditoria/fotos";
const SALIDA = "/workspaces/codespaces-blank/.auditoria/out";

async function estadoCanvas(page) {
  return page.evaluate(() => {
    const c = document.querySelector("canvas");
    if (!c) return null;
    const ctx = c.getContext("2d", { willReadFrequently: true });
    const d = ctx.getImageData(0, 0, c.width, c.height).data;
    return { w: c.width, h: c.height, muestra: Array.from(d.slice(0, 4)) };
  });
}

/** Guarda los píxeles actuales en window.__antes para comparar después. */
async function fijarBase(page) {
  await page.evaluate(() => {
    const c = document.querySelector("canvas");
    const ctx = c.getContext("2d", { willReadFrequently: true });
    window.__antes = ctx.getImageData(0, 0, c.width, c.height).data.slice();
  });
}

/** % de píxeles que cambiaron respecto de la base, y su caja envolvente. */
async function medirCambio(page) {
  return page.evaluate(() => {
    const c = document.querySelector("canvas");
    const ctx = c.getContext("2d", { willReadFrequently: true });
    const ahora = ctx.getImageData(0, 0, c.width, c.height).data;
    const antes = window.__antes;
    let n = 0, minX = 1e9, minY = 1e9, maxX = -1, maxY = -1;
    const total = c.width * c.height;
    for (let i = 0, p = 0; p < total; p++, i += 4) {
      const d = Math.abs(ahora[i] - antes[i]) + Math.abs(ahora[i + 1] - antes[i + 1]) + Math.abs(ahora[i + 2] - antes[i + 2]);
      if (d > 12) {
        n++;
        const x = p % c.width, y = (p - (p % c.width)) / c.width;
        if (x < minX) minX = x; if (x > maxX) maxX = x;
        if (y < minY) minY = y; if (y > maxY) maxY = y;
      }
    }
    return {
      cobertura: +((n / total) * 100).toFixed(2),
      caja: maxX < 0 ? null : { x: minX, y: minY, w: maxX - minX, h: maxY - minY },
      canvas: { w: c.width, h: c.height },
    };
  });
}

async function moverSensibilidad(page, valor) {
  const t0 = Date.now();
  await page.evaluate((v) => {
    const s = [...document.querySelectorAll('input[type=range]')].find((i) => i.min === "5" && i.max === "70");
    if (!s) throw new Error("no encontré el slider de sensibilidad");
    const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set;
    set.call(s, String(v));
    s.dispatchEvent(new Event("input", { bubbles: true }));
    s.dispatchEvent(new Event("change", { bubbles: true }));
    s.dispatchEvent(new PointerEvent("pointerup", { bubbles: true }));
  }, valor);
  await page.waitForTimeout(1200);
  return Date.now() - t0;
}

(async () => {
  fs.mkdirSync(SALIDA, { recursive: true });
  const foto = process.argv[2] || "01-living-luz";
  const { browser, page, eventos } = await k.abrir({ movil: false });
  const resultados = { foto, pasos: [] };
  try {
    await k.ir(page, "/simulador");
    await page.click('button:has-text("Azul Profundo")');
    const t0 = Date.now();
    await page.setInputFiles('input[type=file]', `${FOTOS}/${foto}.jpg`);
    await page.waitForSelector("canvas", { timeout: 30000 });
    await page.waitForTimeout(2500);
    resultados.cargaMs = Date.now() - t0;
    resultados.canvas = await estadoCanvas(page);

    await fijarBase(page);

    // Clic en la pared: 22% del ancho, 35% del alto (zona lisa, lejos del mueble).
    await page.evaluate(() => document.querySelector("canvas").scrollIntoView({ block: "center" }));
    await page.waitForTimeout(500);
    const box = await page.locator("canvas").boundingBox();
    const t1 = Date.now();
    await page.mouse.click(box.x + box.width * 0.22, box.y + box.height * 0.35);
    await page.waitForTimeout(1800);
    const clicMs = Date.now() - t1;
    const tras = await medirCambio(page);
    resultados.pasos.push({ accion: "clic varita (sensibilidad por defecto 26)", ms: clicMs, ...tras });

    for (const v of [5, 15, 30, 50, 70]) {
      const ms = await moverSensibilidad(page, v);
      const m = await medirCambio(page);
      resultados.pasos.push({ accion: `sensibilidad ${v}`, ms, ...m });
    }

    await page.screenshot({ path: `${SALIDA}/${foto}-pintado.png` });
    resultados.eventos = { consola: eventos.consola.slice(0, 5), js: eventos.jsErrors.slice(0, 5), req: eventos.requests.slice(0, 5) };
  } catch (e) {
    resultados.error = String(e).slice(0, 400);
  } finally {
    await browser.close();
  }
  fs.writeFileSync(`${SALIDA}/${foto}.json`, JSON.stringify(resultados, null, 2));
  console.log(JSON.stringify(resultados, null, 2));
})();
