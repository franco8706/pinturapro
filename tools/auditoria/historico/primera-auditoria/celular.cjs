/** El simulador en un celular de 390px con dedo: ¿se puede usar de verdad? */
const k = require("/workspaces/codespaces-blank/.auditoria/kit/navegador.cjs");
const FOTOS = "/workspaces/codespaces-blank/.auditoria/fotos";
const OUT = "/workspaces/codespaces-blank/.auditoria/out";
(async () => {
  const { browser, page, eventos } = await k.abrir({ movil: true });
  const r = [];
  try {
    await k.ir(page, "/simulador");
    r.push({ paso: "carga", ...(await k.auditar(page, eventos)) });
    k.limpiarEventos(eventos);

    const t0 = Date.now();
    await page.setInputFiles('input[type=file]', `${FOTOS}/01-living-luz.jpg`);
    await page.waitForSelector("canvas", { timeout: 40000 });
    await page.waitForTimeout(2500);
    r.push({ paso: "foto cargada", ms: Date.now() - t0 });

    await page.evaluate(() => document.querySelector("canvas").scrollIntoView({ block: "center" }));
    await page.waitForTimeout(400);
    const box = await page.locator("canvas").boundingBox();

    // color con el dedo
    await page.locator('button:has-text("Azul Profundo")').tap();
    await page.waitForTimeout(600);

    // toque en la pared
    const t1 = Date.now();
    await page.touchscreen.tap(box.x + box.width * 0.25, box.y + box.height * 0.35);
    await page.waitForTimeout(2200);
    const pinto = await page.evaluate(() => {
      const c = document.querySelector("canvas");
      const d = c.getContext("2d", { willReadFrequently: true }).getImageData(0, 0, c.width, c.height).data;
      let azules = 0;
      for (let i = 0; i < d.length; i += 4) if (d[i + 2] > d[i] + 20) azules++;
      return +((azules / (c.width * c.height)) * 100).toFixed(1);
    });
    r.push({ paso: "toque en la pared", ms: Date.now() - t1, porcentajePintado: pinto });

    // ¿se puede scrollear la página arrastrando sobre el canvas (con el pincel apagado)?
    const antes = await page.evaluate(() => window.scrollY);
    await page.touchscreen.tap(box.x + box.width * 0.5, box.y + box.height * 0.5);
    await page.mouse.move(box.x + box.width * 0.5, box.y + box.height * 0.7);
    await page.evaluate(() => window.scrollBy(0, 300));
    await page.waitForTimeout(400);
    r.push({ paso: "scroll de la página", antes, despues: await page.evaluate(() => window.scrollY) });

    // controles al alcance del dedo
    r.push({ paso: "controles", medidas: await page.evaluate(() => {
      const nom = (b) => (b.innerText || b.getAttribute("aria-label") || "?").trim().slice(0, 18);
      return [...document.querySelectorAll("button, input[type=range]")]
        .map((b) => { const q = b.getBoundingClientRect(); return { qué: nom(b), alto: Math.round(q.height), ancho: Math.round(q.width) }; })
        .filter((x) => x.alto > 0 && x.alto < 44);
    }) });

    await page.screenshot({ path: `${OUT}/celular-simulador.png` });
    r.push({ eventos: { js: eventos.jsErrors.slice(0, 4), consola: eventos.consola.slice(0, 4), req: eventos.requests.slice(0, 4) } });
  } catch (e) {
    r.push({ error: String(e).slice(0, 300) });
  } finally { await browser.close(); }
  console.log(JSON.stringify(r, null, 2));
})();
