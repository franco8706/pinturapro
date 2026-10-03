const fs = require("fs");
const k = require("/workspaces/codespaces-blank/.auditoria/kit/navegador.cjs");
const FOTOS = "/workspaces/codespaces-blank/.auditoria/fotos";
const SALIDA = "/workspaces/codespaces-blank/.auditoria/out";

(async () => {
  fs.mkdirSync(SALIDA, { recursive: true });
  const { browser, page, eventos } = await k.abrir({ movil: false });
  const log = [];
  try {
    await k.ir(page, "/simulador");
    await page.click('button:has-text("Azul Profundo")');
    await page.waitForTimeout(400);
    log.push({ paso: "color elegido", panel: await page.evaluate(() => document.body.innerText.includes("Color de muestra")) });

    await page.setInputFiles('input[type=file]', `${FOTOS}/01-living-luz.jpg`);
    await page.waitForSelector("canvas", { timeout: 30000 });
    await page.waitForTimeout(3000);

    log.push({
      paso: "foto cargada",
      estado: await page.evaluate(() => {
        const c = document.querySelector("canvas");
        const b = c.getBoundingClientRect();
        return {
          canvasCss: { w: Math.round(b.width), h: Math.round(b.height), x: Math.round(b.x), y: Math.round(b.y) },
          canvasPx: { w: c.width, h: c.height },
          botones: [...document.querySelectorAll("button")].map((x) => x.textContent.trim()).filter((t) => /Varita|Pincel|IA|Deshacer|Cambiar|Descargar|Reiniciar/.test(t)),
          textoPanel: document.body.innerText.match(/Color de muestra[^\n]*/)?.[0] ?? null,
          aviso: document.body.innerText.match(/(Tocá|Hacé clic|No detectamos|Sensibilidad)[^\n]*/g)?.slice(0, 4) ?? [],
        };
      }),
    });

    await page.screenshot({ path: `${SALIDA}/diag-antes.png` });

    // Guardar base y hacer clic en la pared
    await page.evaluate(() => {
      const c = document.querySelector("canvas");
      window.__antes = c.getContext("2d", { willReadFrequently: true }).getImageData(0, 0, c.width, c.height).data.slice();
    });
    await page.evaluate(() => document.querySelector("canvas").scrollIntoView({ block: "center" }));
    await page.waitForTimeout(500);
    const box = await page.locator("canvas").boundingBox();
    const px = box.x + box.width * 0.22;
    const py = box.y + box.height * 0.35;
    await page.mouse.click(px, py);
    await page.waitForTimeout(2500);
    await page.screenshot({ path: `${SALIDA}/diag-despues.png` });

    log.push({
      paso: "clic en la pared",
      donde: { x: Math.round(px), y: Math.round(py) },
      cambio: await page.evaluate(() => {
        const c = document.querySelector("canvas");
        const a = c.getContext("2d", { willReadFrequently: true }).getImageData(0, 0, c.width, c.height).data;
        let n = 0;
        for (let i = 0; i < a.length; i += 4) {
          if (Math.abs(a[i] - window.__antes[i]) + Math.abs(a[i + 1] - window.__antes[i + 1]) + Math.abs(a[i + 2] - window.__antes[i + 2]) > 12) n++;
        }
        return { pixelesCambiados: n, porcentaje: +((n / (c.width * c.height)) * 100).toFixed(2) };
      }),
      mensajes: await page.evaluate(() => document.body.innerText.match(/(No detectamos|Ahí no hay|Analizando|Tocá)[^\n]*/g) ?? []),
    });
    log.push({ eventos: { consola: eventos.consola.slice(0, 6), js: eventos.jsErrors.slice(0, 6), req: eventos.requests.slice(0, 6) } });
  } catch (e) {
    log.push({ error: String(e).slice(0, 500) });
  } finally {
    await browser.close();
  }
  console.log(JSON.stringify(log, null, 2));
})();
