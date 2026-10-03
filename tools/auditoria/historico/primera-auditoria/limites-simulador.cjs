const k = require("/workspaces/codespaces-blank/.auditoria/kit/navegador.cjs");
const FOTOS = "/workspaces/codespaces-blank/.auditoria/fotos";
const fs = require("fs");

const texto = (page) => page.evaluate(() => document.body.innerText.replace(/\s+/g, " ").slice(0, 1500));

(async () => {
  // archivo que NO es imagen, con nombre .jpg
  fs.writeFileSync(`${FOTOS}/falsa.jpg`, "esto no es una imagen, es texto plano\n".repeat(50));
  const r = [];
  const { browser, page, eventos } = await k.abrir({ movil: false });
  try {
    await k.ir(page, "/simulador");

    // 1) foto gigante (30 MP)
    let t = Date.now();
    await page.setInputFiles('input[type=file]', `${FOTOS}/99-gigante.jpg`);
    await page.waitForTimeout(9000);
    r.push({ caso: "foto de 30 megapíxeles", ms: Date.now() - t,
      hayCanvas: await page.evaluate(() => !!document.querySelector("canvas")),
      mensaje: (await texto(page)).match(/(muy grande|demasiado|megap[ií]xeles|no pudimos|Error|pesada)[^.]*\.?/i)?.[0] ?? null });

    // 2) archivo que no es imagen
    t = Date.now();
    await page.setInputFiles('input[type=file]', `${FOTOS}/falsa.jpg`);
    await page.waitForTimeout(6000);
    r.push({ caso: "archivo que no es imagen", ms: Date.now() - t,
      hayCanvas: await page.evaluate(() => !!document.querySelector("canvas")),
      mensaje: (await texto(page)).match(/(no pudimos|no se pudo|Error|inv[áa]lid)[^.]*\.?/i)?.[0] ?? null,
      pantallaViva: await page.evaluate(() => !!document.querySelector('input[type=file]')) });

    // 3) cambiar de foto 8 veces seguidas, midiendo memoria
    const mem = [];
    for (let i = 0; i < 8; i++) {
      const f = ["01-living-luz", "02-pared-plana", "03-pared-oscura"][i % 3];
      await page.setInputFiles('input[type=file]', `${FOTOS}/${f}.jpg`);
      await page.waitForTimeout(1800);
      mem.push(await page.evaluate(() => (performance.memory ? Math.round(performance.memory.usedJSHeapSize / 1048576) : null)));
    }
    r.push({ caso: "cambiar de foto 8 veces (MB de memoria)", memoria: mem,
      hayCanvas: await page.evaluate(() => !!document.querySelector("canvas")) });

    // 4) mover la sensibilidad SIN haber hecho clic antes
    await page.evaluate(() => {
      const s = [...document.querySelectorAll('input[type=range]')].find((i) => i.min === "5" && i.max === "70");
      if (!s) return;
      const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set;
      set.call(s, "60"); s.dispatchEvent(new Event("input", { bubbles: true }));
      s.dispatchEvent(new PointerEvent("pointerup", { bubbles: true }));
    });
    await page.waitForTimeout(1500);
    r.push({ caso: "mover sensibilidad sin clic previo", js: eventos.jsErrors.length, consola: eventos.consola.length });

    // 5) 12 clics muy rápidos sobre el canvas
    await page.evaluate(() => document.querySelector("canvas").scrollIntoView({ block: "center" }));
    await page.waitForTimeout(400);
    const box = await page.locator("canvas").boundingBox();
    t = Date.now();
    for (let i = 0; i < 12; i++) await page.mouse.click(box.x + box.width * (0.2 + i * 0.05), box.y + box.height * 0.4, { delay: 0 });
    await page.waitForTimeout(3000);
    r.push({ caso: "12 clics rápidos", ms: Date.now() - t, js: eventos.jsErrors.length,
      hayCanvas: await page.evaluate(() => !!document.querySelector("canvas")) });

    r.push({ eventos: { js: eventos.jsErrors.slice(0, 5), consola: eventos.consola.slice(0, 5), req: eventos.requests.slice(0, 5) } });
  } catch (e) {
    r.push({ error: String(e).slice(0, 400) });
  } finally {
    await browser.close();
  }
  console.log(JSON.stringify(r, null, 2));
})();
