/**
 * Vigila lo que pasa cuando la persona hace algo MIENTRAS el simulador todavía calcula.
 *
 * Las dos cosas se rompían hasta el 3/10/2026 (medidas por `simulador-uso-real`):
 *  1. Elegir otro color mientras la varita calculaba dejaba la pared con el color VIEJO, aunque
 *     la muestra marcada y la ficha dijeran el nuevo. El resultado de la varita se pintaba con el
 *     `repaint` de la render del clic. Con un toque había ~0,6 s de ventana en un celular de gama
 *     media; con toques en cola, más de 2 s.
 *  2. 🤖 IA: cambiar de foto mientras decía "Analizando…" (3-60 s) dejaba la foto NUEVA pintada
 *     sin tocarla, con la forma de la pared de la anterior: las regiones de la foto vieja se
 *     guardaban igual y el toque pendiente las aplicaba sobre la nueva.
 *  3. 🤖 IA colgada (4/10): 70 s con todo apagado, sin forma de cancelar salvo perder la foto, y
 *     al vencer el tiempo se iba sin ningún aviso. Ahora hay "Cancelar", y el corte por tiempo
 *     avisa. El tiempo se adelanta con el reloj simulado de Playwright: no se esperan 70 s.
 *
 * La IA no se llama de verdad (cuesta plata): `/api/segment` se contesta desde la prueba, tarde,
 * con una máscara que cubre toda la foto. Si la regresión vuelve, la foto nueva queda pintada.
 *
 * Necesita las fotos sintéticas: python3 tools/auditoria/generar.py
 */
const fs = require("fs");
const FOTOS = __dirname + "/../../../.fotos-prueba";
// Una máscara de 8×8 toda blanca: "toda la foto es una región".
const MASCARA_TODA = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAgAAAAICAYAAADED76LAAAAFklEQVR4nGP8////fwY8gAmf5PBRAAAbbgQMid1tCwAAAABJRU5ErkJggg==";

const guardarAntes = (page) =>
  page.evaluate(() => {
    const c = document.querySelector("canvas");
    window.__antes = c.getContext("2d", { willReadFrequently: true }).getImageData(0, 0, c.width, c.height).data.slice();
    c.scrollIntoView({ block: "center" });
  });
const pintados = (page) =>
  page.evaluate(() => {
    const c = document.querySelector("canvas");
    const d = c.getContext("2d", { willReadFrequently: true }).getImageData(0, 0, c.width, c.height).data;
    const a = window.__antes;
    let n = 0;
    for (let i = 0; i < d.length; i += 4) if (Math.abs(d[i] - a[i]) + Math.abs(d[i + 1] - a[i + 1]) + Math.abs(d[i + 2] - a[i + 2]) > 12) n++;
    return n;
  });
/** Mediana de lo pintado (lo que cambió respecto de la foto). */
const medianaPintada = (page) =>
  page.evaluate(() => {
    const c = document.querySelector("canvas");
    const d = c.getContext("2d", { willReadFrequently: true }).getImageData(0, 0, c.width, c.height).data;
    const a = window.__antes;
    const canales = [[], [], []];
    for (let i = 0; i < d.length; i += 16) {
      if (Math.abs(d[i] - a[i]) + Math.abs(d[i + 1] - a[i + 1]) + Math.abs(d[i + 2] - a[i + 2]) <= 12) continue;
      for (let q = 0; q < 3; q++) canales[q].push(d[i + q]);
    }
    if (canales[0].length < 500) return null;
    return canales.map((v) => v.sort((x, y) => x - y)[v.length >> 1]);
  });
const distancia = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
const hexARgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));

module.exports = {
  nombre: "simulador · cambiar el color o la foto mientras calcula no deja nada viejo",

  async correr(t, { k }) {
    if (!fs.existsSync(`${FOTOS}/02-pared-plana.jpg`)) {
      t.nota("faltan las fotos de prueba: python3 tools/auditoria/generar.py");
      return;
    }
    const { browser, page } = await k.abrir({ movil: false });
    try {
      // ── 1. Otro color mientras la varita calcula ──
      await k.ir(page, "/simulador");
      await page.click('button:has-text("Azul Profundo")');
      await page.setInputFiles("input[type=file]", `${FOTOS}/02-pared-plana.jpg`);
      await page.waitForSelector("canvas", { timeout: 40000 });
      await page.waitForTimeout(1200);
      await guardarAntes(page);
      await page.waitForTimeout(300);
      // Procesador lento, como un celular de gama media, y tres toques en cola: la ventana en la
      // que el resultado llega después de elegir el color nuevo es de más de un segundo.
      const cdp = await page.context().newCDPSession(page);
      await cdp.send("Emulation.setCPUThrottlingRate", { rate: 6 });
      const b = await page.locator("canvas").boundingBox();
      for (const [x, y] of [[0.4, 0.5], [0.6, 0.4], [0.3, 0.3]]) await page.mouse.click(b.x + b.width * x, b.y + b.height * y);
      await page.click('button:has-text("Arena")'); // sin esperar a la varita
      await page.waitForTimeout(6000);
      await cdp.send("Emulation.setCPUThrottlingRate", { rate: 1 });
      const visto = await medianaPintada(page);
      if (!visto) t.cierto(false, "los toques no pintaron la pared: la prueba no puede medir");
      else {
        const arena = hexARgb("#D8C6A3"), azul = hexARgb("#28415F");
        t.nota(`con Arena elegido mientras calculaba, la pared se ve ${visto}`);
        t.cierto(distancia(visto, arena) < distancia(visto, azul), `se eligió Arena mientras la varita calculaba y la pared quedó con el color anterior: se ve ${visto}`);
      }

      // ── 2. 🤖 IA: cambiar de foto mientras analiza ──
      await page.route("**/api/segment", async (ruta) => {
        await new Promise((r) => setTimeout(r, 3000));
        await ruta.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ masks: [MASCARA_TODA] }) }).catch(() => {});
      });
      await k.ir(page, "/simulador");
      await page.click('button:has-text("Azul Profundo")');
      await page.setInputFiles("input[type=file]", `${FOTOS}/02-pared-plana.jpg`);
      await page.waitForSelector("canvas", { timeout: 40000 });
      await page.waitForTimeout(1000);
      await page.click("button:has-text('🤖 IA')");
      await page.evaluate(() => document.querySelector("canvas").scrollIntoView({ block: "center" }));
      const c2 = await page.locator("canvas").boundingBox();
      await page.mouse.click(c2.x + c2.width * 0.4, c2.y + c2.height * 0.5);
      await page.waitForSelector("text=Analizando", { timeout: 5000 }).catch(() => t.nota("no apareció «Analizando…»"));
      await page.click("button:has-text('Cambiar foto')");
      await page.setInputFiles("input[type=file]", `${FOTOS}/03-pared-oscura.jpg`);
      await page.waitForSelector("canvas", { timeout: 40000 });
      await page.waitForTimeout(800);
      await guardarAntes(page); // la foto nueva, recién cargada y sin tocar
      await page.waitForTimeout(4500); // la respuesta de la IA de la foto anterior llega acá
      const sinTocar = await pintados(page);
      t.igual(sinTocar, 0, "la foto nueva quedó pintada sin tocarla, con las regiones que la IA devolvió para la foto anterior");
      await page.unroute("**/api/segment");

      // ── 3. 🤖 IA colgada: se puede cancelar, y el corte por tiempo avisa ──
      await page.route("**/api/segment", () => {}); // nunca contesta
      const analizar = async () => {
        await page.click("button:has-text('🤖 IA')");
        await page.evaluate(() => document.querySelector("canvas").scrollIntoView({ block: "center" }));
        const c3 = await page.locator("canvas").boundingBox();
        await page.mouse.click(c3.x + c3.width * 0.4, c3.y + c3.height * 0.5);
        return page.waitForSelector("text=Analizando", { timeout: 5000 }).then(() => true).catch(() => false);
      };
      if (await analizar()) {
        const cancelar = page.locator("button", { hasText: "Cancelar" });
        t.cierto((await cancelar.count()) === 1, "mientras la IA analiza no hay forma de cancelar (sólo «Cambiar foto», que pierde la foto)");
        if ((await cancelar.count()) === 1) {
          await cancelar.click();
          await page.waitForTimeout(500);
          t.cierto((await page.locator("text=Analizando").count()) === 0, "«Cancelar» no sacó el cartel de «Analizando…»");
          t.cierto(await page.locator("button:has-text('🖌 Pincel')").isEnabled(), "después de cancelar, las herramientas siguen apagadas");
        }
      } else t.nota("no apareció «Analizando…» (cancelar)");
      // El corte por tiempo: reloj simulado, se adelantan 71 s.
      await page.clock.install();
      await k.ir(page, "/simulador");
      await page.click('button:has-text("Azul Profundo")');
      await page.setInputFiles("input[type=file]", `${FOTOS}/02-pared-plana.jpg`);
      await page.waitForSelector("canvas", { timeout: 40000 });
      await page.clock.runFor(1500);
      if (await analizar()) {
        await page.clock.runFor(71_000);
        await page.waitForTimeout(500);
        const aviso = await page.evaluate(() => /tardó demasiado/.test(document.body.innerText));
        t.cierto(aviso, "la IA se cortó por tiempo y no avisó nada");
      } else t.nota("no apareció «Analizando…» (tiempo)");
      await page.unroute("**/api/segment");
    } finally {
      await browser.close();
    }
  },
};
