/**
 * Vigila las herramientas del simulador, una por una, midiendo píxeles (no textos).
 *
 * Todo lo de acá se rompió o no existía hasta el 3/10/2026 (ronda `2026-10-03-simulador`):
 *  1. Deshacer después de un toque fallido + Sensibilidad. El aviso del toque fallido decía
 *     "subí la Sensibilidad"; al hacerlo la zona aparecía, pero seguía el aviso de error, no
 *     estaba "Limpiar selección", y Deshacer borraba también la pared pintada antes (262.451 → 0).
 *  2. Varias paredes, cada una con su color. Elegir un color para la segunda pared cambiaba la
 *     primera: había una sola selección y un solo color.
 *  3. Contorno: se marcan las esquinas de una zona y se pinta o se quita ese polígono (para lo
 *     que la varita no separa por color: ladrillo, piedra, el techo de un cuarto blanco).
 *  4. Pincel continuo: un trazo rápido dejaba círculos sueltos con huecos entre ellos.
 *  5. "Ver la foto original" muestra la foto sin pintar, y "Guardar imagen" baja la pintada.
 *
 * Necesita las fotos: python3 tools/auditoria/generar.py y
 * python3 tools/auditoria/simulador/fotos-reales.py (la del macramé, para el punto 1).
 */
const fs = require("fs");
const FOTOS = __dirname + "/../../../.fotos-prueba";

const pintados = (page) =>
  page.evaluate(() => {
    const c = document.querySelector("canvas");
    const d = c.getContext("2d", { willReadFrequently: true }).getImageData(0, 0, c.width, c.height).data;
    const a = window.__antes;
    let n = 0;
    for (let i = 0; i < d.length; i += 4) if (Math.abs(d[i] - a[i]) + Math.abs(d[i + 1] - a[i + 1]) + Math.abs(d[i + 2] - a[i + 2]) > 12) n++;
    return n;
  });

/** Sube la foto, guarda cómo se ve sin pintar y deja el lienzo centrado en la pantalla. */
async function cargar(k, page, foto, color) {
  await k.ir(page, "/simulador");
  if (color) await page.click(`button:has-text("${color}")`);
  await page.setInputFiles("input[type=file]", foto);
  await page.waitForSelector("canvas", { timeout: 40000 });
  await page.waitForTimeout(1200);
  await page.evaluate(() => {
    const c = document.querySelector("canvas");
    window.__antes = c.getContext("2d", { willReadFrequently: true }).getImageData(0, 0, c.width, c.height).data.slice();
    c.scrollIntoView({ block: "center" });
  });
  await page.waitForTimeout(300);
}

/** Toca el lienzo en (x, y) de 0 a 1 y espera a que la varita conteste. */
async function tocar(page, x, y, espera = 1500) {
  await page.evaluate(() => document.querySelector("canvas").scrollIntoView({ block: "center" }));
  const b = await page.locator("canvas").boundingBox();
  await page.mouse.click(b.x + b.width * x, b.y + b.height * y);
  await page.waitForTimeout(espera);
}

/** Color mediano de un cuadradito del lienzo alrededor de (x, y). */
const colorEn = (page, x, y) =>
  page.evaluate(([x, y]) => {
    const c = document.querySelector("canvas");
    const cx = Math.round(x * c.width), cy = Math.round(y * c.height), R = 6;
    const d = c.getContext("2d", { willReadFrequently: true }).getImageData(cx - R, cy - R, 2 * R + 1, 2 * R + 1).data;
    const canales = [[], [], []];
    for (let i = 0; i < d.length; i += 4) for (let q = 0; q < 3; q++) canales[q].push(d[i + q]);
    return canales.map((v) => v.sort((a, b) => a - b)[v.length >> 1]);
  }, [x, y]);
const distancia = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
const hexARgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const hayBoton = (page, texto) => page.evaluate((t) => [...document.querySelectorAll("button")].some((b) => b.innerText.trim() === t), texto);

module.exports = {
  nombre: "simulador · Deshacer, varias paredes, Contorno, pincel continuo, original y guardar",

  async correr(t, { k }) {
    if (!fs.existsSync(`${FOTOS}/02-pared-plana.jpg`)) {
      t.nota("faltan las fotos de prueba: python3 tools/auditoria/generar.py");
      return;
    }
    const { browser, page } = await k.abrir({ movil: false });
    try {
      // ── 1. Deshacer después de un toque fallido + Sensibilidad ──
      const macrame = `${FOTOS}/reales/r05-living-calido-macrame.jpg`;
      if (!fs.existsSync(macrame)) t.nota("falta la foto del macramé: python3 tools/auditoria/simulador/fotos-reales.py");
      else {
        await cargar(k, page, macrame, "Azul Profundo");
        await tocar(page, 0.3, 0.25);
        const a = await pintados(page);
        t.cierto(a > 50000, `el toque en la pared pintó ${a} píxeles: la prueba no puede medir`);
        await tocar(page, 0.44, 0.45);
        const aviso = await page.evaluate(() => /superficie (pareja|clara)/.test(document.body.innerText));
        if (!aviso) t.nota("el toque sobre el macramé ya no da aviso: el punto 1 no se pudo medir así");
        else {
          // La Sensibilidad al máximo con el teclado (Fin), como lo haría una persona.
          const rango = page.locator("label", { hasText: "Sensibilidad" }).locator("input[type=range]");
          await rango.focus();
          await page.keyboard.press("End");
          await page.waitForTimeout(2500);
          const despues = await pintados(page);
          if (despues > a) {
            const sigueAviso = await page.evaluate(() => /superficie (pareja|clara)/.test(document.body.innerText));
            t.cierto(!sigueAviso, "la Sensibilidad agrandó la zona y el aviso de error sigue a la vista");
            t.cierto(await hayBoton(page, "Limpiar selección"), "hay pintura y no aparece «Limpiar selección»");
          } else t.nota("subir la Sensibilidad no agrandó la zona del macramé; se mide sólo Deshacer");
          await page.click("button:has-text('Deshacer')");
          await page.waitForTimeout(800);
          const tras = await pintados(page);
          t.cierto(Math.abs(tras - a) <= a * 0.01, `Deshacer dejó ${tras} píxeles pintados y antes del toque fallido había ${a}: se llevó la pared anterior`);
        }
      }

      // ── 2. Varias paredes, cada una con su color ──
      await cargar(k, page, `${FOTOS}/01-living-luz.jpg`, "Verde Agua");
      await tocar(page, 0.22, 0.35);
      const botonMas = page.locator("button", { hasText: "y pintar otra pared" });
      t.cierto((await botonMas.count()) === 1, "no aparece «＋ Dejar … y pintar otra pared» con una pared pintada");
      t.contiene(await botonMas.innerText(), "Verde Agua", "el botón ＋ no dice qué color queda fijo");
      await botonMas.click();
      await page.waitForTimeout(500);
      await page.click('button:has-text("Arena")');
      await page.waitForTimeout(500);
      await tocar(page, 0.5, 0.05); // el techo
      const verde = hexARgb("#A8C7BB"), arena = hexARgb("#D8C6A3");
      const pared = await colorEn(page, 0.3, 0.4);
      const techo = await colorEn(page, 0.5, 0.05);
      t.cierto(distancia(pared, verde) < distancia(pared, arena), `la primera pared cambió de color al pintar la segunda: se ve ${pared}, más cerca de Arena que de Verde Agua`);
      t.cierto(distancia(techo, arena) < distancia(techo, verde), `la segunda zona no quedó Arena: se ve ${techo}`);
      // Quitar la pared fija con su ✕: vuelve a verse la foto ahí.
      await page.click('button[aria-label="Quitar la pared pintada de Verde Agua"]');
      await page.waitForTimeout(800);
      const original = await page.evaluate(() => {
        const c = document.querySelector("canvas"), x = Math.round(0.3 * c.width), y = Math.round(0.4 * c.height), i = (y * c.width + x) * 4;
        return [window.__antes[i], window.__antes[i + 1], window.__antes[i + 2]];
      });
      const quitada = await colorEn(page, 0.3, 0.4);
      t.cierto(distancia(quitada, original) < 25, `después de quitar la pared Verde Agua, ahí se ve ${quitada} y la foto era ${original}`);
      // Deshacer después de la ✕: vuelve la pared, y el techo (el último toque) se queda.
      await page.click("button:has-text('Deshacer')");
      await page.waitForTimeout(800);
      const vuelta = await colorEn(page, 0.3, 0.4);
      const techoTras = await colorEn(page, 0.5, 0.05);
      t.cierto(distancia(vuelta, verde) < distancia(vuelta, original), `Deshacer después de la ✕ no devolvió la pared Verde Agua (se ve ${vuelta})`);
      t.cierto(distancia(techoTras, arena) < distancia(techoTras, verde) && distancia(techoTras, arena) < 60, `Deshacer después de la ✕ se llevó también el último toque (el techo se ve ${techoTras})`);

      // Una pared ya fijada se corrige: "Quitar la zona" le saca pintura, y Deshacer la devuelve.
      // Y la Intensidad de ahora no cambia las paredes fijas.
      await cargar(k, page, `${FOTOS}/02-pared-plana.jpg`, "Azul Profundo");
      await tocar(page, 0.4, 0.5);
      await page.locator("button", { hasText: "y pintar otra pared" }).click();
      await page.waitForTimeout(600);
      const fija = await colorEn(page, 0.45, 0.45);
      const intensidad = page.locator("label", { hasText: "Intensidad" }).locator("input[type=range]").first();
      await intensidad.focus();
      for (let i = 0; i < 6; i++) await page.keyboard.press("ArrowLeft");
      await page.waitForTimeout(600);
      t.cierto(distancia(await colorEn(page, 0.45, 0.45), fija) < 6, "bajar la Intensidad cambió una pared que ya había quedado fija");
      await page.click("button:has-text('Contorno')");
      await page.click("button:has-text('Quitar la zona')");
      for (const [x, y] of [[0.3, 0.3], [0.6, 0.3], [0.6, 0.6], [0.3, 0.6]]) await tocar(page, x, y, 150);
      await page.click("button:has-text('Cerrar contorno')");
      await page.waitForTimeout(800);
      const fotoAhi = await page.evaluate(() => {
        const c = document.querySelector("canvas"), x = Math.round(0.45 * c.width), y = Math.round(0.45 * c.height), i = (y * c.width + x) * 4;
        return [window.__antes[i], window.__antes[i + 1], window.__antes[i + 2]];
      });
      const sinPintura = await colorEn(page, 0.45, 0.45);
      t.cierto(distancia(sinPintura, fotoAhi) < 25, `«Quitar la zona» sobre una pared ya fijada no le sacó la pintura (se ve ${sinPintura}, la foto era ${fotoAhi})`);
      await page.click("button:has-text('Deshacer')");
      await page.waitForTimeout(800);
      t.cierto(distancia(await colorEn(page, 0.45, 0.45), fija) < 6, "Deshacer no devolvió la pintura que «Quitar la zona» le sacó a la pared fija");
      await page.click("button:has-text('Contorno')"); // apagar el contorno
      // Con "Ver la foto original" prendido, tocar la pared vuelve a mostrar la pintura.
      await page.click("button:has-text('Ver la foto original')");
      await page.waitForTimeout(400);
      await tocar(page, 0.8, 0.2);
      t.cierto((await pintados(page)) > 1000, "con «Ver la foto original» prendido, tocar la pared no muestra nada");
      t.cierto(await hayBoton(page, "Ver la foto original"), "tocar la pared no apagó «Ver la foto original»");

      // ── 3. Contorno ──
      await cargar(k, page, `${FOTOS}/02-pared-plana.jpg`, "Azul Profundo");
      await page.click("button:has-text('Contorno')");
      for (const [x, y] of [[0.1, 0.2], [0.4, 0.2], [0.4, 0.6], [0.1, 0.6]]) await tocar(page, x, y, 150);
      await page.click("button:has-text('Cerrar contorno')");
      await page.waitForTimeout(800);
      const total = await page.evaluate(() => document.querySelector("canvas").width * document.querySelector("canvas").height);
      const zona = (await pintados(page)) / total;
      t.nota(`contorno de 30 % × 40 %: pintó ${(zona * 100).toFixed(1)} % de la foto`);
      t.cierto(Math.abs(zona - 0.12) < 0.015, `un contorno de 30 % × 40 % pintó ${(zona * 100).toFixed(1)} % de la foto (tenía que ser ~12 %)`);
      await page.click("button:has-text('Quitar la zona')");
      for (const [x, y] of [[0.2, 0.3], [0.3, 0.3], [0.3, 0.5], [0.2, 0.5]]) await tocar(page, x, y, 150);
      await tocar(page, 0.2, 0.3, 600); // tocar la primera esquina cierra la zona
      const zona2 = (await pintados(page)) / total;
      t.cierto(Math.abs(zona2 - 0.10) < 0.015, `quitar un contorno de 10 % × 20 % dejó ${(zona2 * 100).toFixed(1)} % (tenía que ser ~10 %)`);

      // ── 4. Pincel continuo ──
      await cargar(k, page, `${FOTOS}/02-pared-plana.jpg`, "Azul Profundo");
      await page.click("button:has-text('🖌 Pincel')");
      await page.waitForTimeout(300);
      {
        const b = await page.locator("canvas").boundingBox();
        await page.mouse.move(b.x + b.width * 0.1, b.y + b.height * 0.5);
        await page.mouse.down();
        await page.mouse.move(b.x + b.width * 0.9, b.y + b.height * 0.5, { steps: 4 }); // rápido: cuatro eventos
        await page.mouse.up();
        await page.waitForTimeout(800);
      }
      const huecos = await page.evaluate(() => {
        const c = document.querySelector("canvas");
        const y = Math.round(c.height * 0.5);
        const d = c.getContext("2d", { willReadFrequently: true }).getImageData(0, y, c.width, 1).data;
        const a = window.__antes;
        let sin = 0;
        for (let x = Math.round(c.width * 0.12); x < Math.round(c.width * 0.88); x++) {
          const i = x * 4, j = (y * c.width + x) * 4;
          if (Math.abs(d[i] - a[j]) + Math.abs(d[i + 1] - a[j + 1]) + Math.abs(d[i + 2] - a[j + 2]) <= 12) sin++;
        }
        return sin;
      });
      t.cierto(huecos === 0, `un trazo rápido de pincel dejó ${huecos} píxeles sin pintar a lo largo de la línea (círculos sueltos)`);

      // ── 5. Ver la foto original / Guardar imagen ──
      const conPintura = await pintados(page);
      await page.click("button:has-text('Ver la foto original')");
      await page.waitForTimeout(500);
      t.igual(await pintados(page), 0, "«Ver la foto original» sigue mostrando pintura");
      const [descarga] = await Promise.all([page.waitForEvent("download", { timeout: 10000 }), page.click("button:has-text('Guardar imagen')")]);
      t.igual(descarga.suggestedFilename(), "simulacion-de-color.jpg", "«Guardar imagen» no bajó la imagen");
      await page.click("button:has-text('Ver la foto pintada')");
      await page.waitForTimeout(500);
      t.igual(await pintados(page), conPintura, "al volver de la foto original no se ve la misma pintura");
    } finally {
      await browser.close();
    }
  },
};
