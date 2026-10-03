const k = require("/workspaces/codespaces-blank/.auditoria/kit/navegador.cjs");
const FOTOS = "/workspaces/codespaces-blank/.auditoria/fotos";
const OUT = "/workspaces/codespaces-blank/.auditoria/out";
(async () => {
  const { browser, page, eventos } = await k.abrir({ movil: true });
  const r = [];
  try {
    await k.ir(page, "/simulador");
    await page.setInputFiles('input[type=file]', `${FOTOS}/01-living-luz.jpg`);
    await page.waitForSelector("canvas", { timeout: 40000 });
    await page.waitForTimeout(2500);

    // elegir color con el dedo y comprobar que quedó elegido
    await page.locator('button:has-text("Azul Profundo")').tap();
    await page.waitForTimeout(800);
    r.push({ paso: "color elegido", panelColor: await page.evaluate(() => (document.body.innerText.match(/Color de muestra[^\n]*/) || [null])[0]) });

    await page.evaluate(() => document.querySelector("canvas").scrollIntoView({ block: "center" }));
    await page.waitForTimeout(500);
    const box = await page.locator("canvas").boundingBox();
    r.push({ paso: "canvas", box: { x: Math.round(box.x), y: Math.round(box.y), w: Math.round(box.width), h: Math.round(box.height) }, alto: await page.evaluate(() => window.innerHeight) });

    const mide = () => page.evaluate(() => {
      const c = document.querySelector("canvas");
      const d = c.getContext("2d", { willReadFrequently: true }).getImageData(0, 0, c.width, c.height).data;
      let azules = 0;
      for (let i = 0; i < d.length; i += 4) if (d[i + 2] > d[i] + 20) azules++;
      return +((azules / (c.width * c.height)) * 100).toFixed(1);
    });

    // 1) toque de dedo
    await page.touchscreen.tap(box.x + box.width * 0.25, box.y + box.height * 0.35);
    await page.waitForTimeout(2500);
    r.push({ paso: "touchscreen.tap", pintado: await mide(), aviso: await page.evaluate(() => (document.body.innerText.match(/(No detectamos|Ahí no hay|Tocá la pared)[^\n]*/) || [null])[0]) });

    // 2) clic del mouse (para comparar) en el mismo punto
    await page.mouse.click(box.x + box.width * 0.25, box.y + box.height * 0.35);
    await page.waitForTimeout(2500);
    r.push({ paso: "mouse.click", pintado: await mide() });

    // 3) evento táctil "a mano", como lo manda un celular real
    await page.evaluate(({ fx, fy }) => {
      const c = document.querySelector("canvas");
      const b = c.getBoundingClientRect();
      const x = b.left + b.width * fx, y = b.top + b.height * fy;
      const t = (tipo) => new PointerEvent(tipo, { bubbles: true, cancelable: true, clientX: x, clientY: y, pointerType: "touch", isPrimary: true });
      c.dispatchEvent(t("pointerdown")); c.dispatchEvent(t("pointerup"));
      c.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, clientX: x, clientY: y }));
    }, { fx: 0.6, fy: 0.5 });
    await page.waitForTimeout(2500);
    r.push({ paso: "eventos táctiles a mano", pintado: await mide() });

    await page.screenshot({ path: `${OUT}/celular-diag.png` });
    r.push({ js: eventos.jsErrors.slice(0, 4) });
  } catch (e) { r.push({ error: String(e).slice(0, 300) }); }
  finally { await browser.close(); }
  console.log(JSON.stringify(r, null, 2));
})();
