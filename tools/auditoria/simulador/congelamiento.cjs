#!/usr/bin/env node
// Cuánto congela la pantalla el primer clic de la varita del simulador.
//
// Mide contra la compilación de PRODUCCIÓN (:3100, `bash tools/auditoria/produccion.sh`): en
// desarrollo el JavaScript va sin optimizar y el número no sirve. Celular de gama media: CPU
// cuatro veces más lenta. Tres corridas, cada una con un navegador nuevo.
//
// Qué reporta:
//  · tarea larga: el tramo más largo en que el hilo de la pantalla no pudo atender nada
//    (PerformanceObserver "longtask") desde el clic. Es lo que se siente como "se colgó".
//  · hasta pintar: cuánto tarda en verse el color desde el clic.
//
// Vive en el repo porque /tmp se borra con cada reinicio del Codespace, y este número se
// midió a mano en cuatro rondas seguidas (400, 400-724, 571-599, 773 ms) con scripts que ya
// no existen.
//
// Uso: node tools/auditoria/simulador/congelamiento.cjs [base]
const path = require("path");
const k = require("../navegador.cjs");
const BASE = process.argv[2] || "http://localhost:3100";
const FOTO = path.join(__dirname, "../../../.fotos-prueba/01-living-luz.jpg"); // `pnpm fotos-prueba` las genera

async function corrida() {
  const { browser, page } = await k.abrir({ movil: false });
  try {
    await page.goto(`${BASE}/simulador`, { waitUntil: "domcontentloaded", timeout: 60000 });
    await page.waitForTimeout(1500);
    await page.click('button[aria-pressed]:has-text("Azul Profundo")');
    await page.setInputFiles("input[type=file]", FOTO);
    await page.waitForSelector("canvas", { timeout: 40000 });
    await page.waitForTimeout(2500);
    const cdp = await page.context().newCDPSession(page);
    await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });
    await page.evaluate(() => {
      const c = document.querySelector("canvas");
      c.scrollIntoView({ block: "center" });
      window.__largas = [];
      new PerformanceObserver((l) => l.getEntries().forEach((e) => window.__largas.push([e.startTime, e.duration]))).observe({ entryTypes: ["longtask"] });
      const ctx = c.getContext("2d", { willReadFrequently: true });
      const antes = ctx.getImageData(0, 0, c.width, c.height).data.slice(0, 400000);
      window.__clic = null;
      window.__pintado = null;
      c.addEventListener("click", () => (window.__clic = performance.now()), { capture: true, once: true });
      const mirar = () => {
        if (window.__clic && !window.__pintado) {
          const ahora = ctx.getImageData(0, 0, c.width, c.height).data;
          for (let i = 0; i < antes.length; i += 97) if (Math.abs(ahora[i] - antes[i]) > 12) { window.__pintado = performance.now(); break; }
        }
        if (!window.__pintado) requestAnimationFrame(mirar);
      };
      requestAnimationFrame(mirar);
    });
    await page.waitForTimeout(600);
    const caja = await page.locator("canvas").boundingBox();
    await page.mouse.click(caja.x + caja.width * 0.22, caja.y + caja.height * 0.35);
    await page.waitForTimeout(4000);
    return await page.evaluate(() => {
      const desde = window.__clic ?? 0;
      const largas = window.__largas.filter(([inicio, dur]) => inicio + dur > desde - 5).map(([, d]) => Math.round(d));
      return {
        tareaLarga: largas.length ? Math.max(...largas) : 0,
        sumaLargas: largas.reduce((a, b) => a + b, 0),
        hastaPintar: window.__pintado ? Math.round(window.__pintado - desde) : null,
      };
    });
  } finally {
    await browser.close();
  }
}

(async () => {
  const r = [];
  for (let i = 0; i < 3; i++) r.push(await corrida());
  const col = (c) => r.map((x) => x[c]).join(" · ");
  console.log(`base ${BASE} · CPU ×4 · 3 corridas`);
  console.log(`tarea larga más grande (ms): ${col("tareaLarga")}`);
  console.log(`suma de tareas largas (ms):  ${col("sumaLargas")}`);
  console.log(`hasta ver el color (ms):     ${col("hastaPintar")}`);
})();
