/**
 * Vigila que una pared oscura pintada de claro no quede con un contorno del color viejo.
 *
 * La varita deja afuera los píxeles de transición entre la pared y lo de al lado (ahí el
 * gradiente es alto, que es lo que frena la selección). Sobre la pared verde oscura de r08
 * pintada de Blanco Puro, más de la mitad de los píxeles pegados a la selección quedaban con el
 * verde viejo: un contorno oscuro en cada esquina y alrededor de cada cuadro. Desde el 3/10/2026
 * esos píxeles se pintan en la proporción en que son pared (`alfaDeLaSeleccion`); en Node lo
 * prueba `packages/color/pruebas.ts`, y acá que el simulador lo use de verdad.
 *
 * Necesita las fotos reales: python3 tools/auditoria/simulador/fotos-reales.py
 */
const fs = require("fs");
const FOTO = __dirname + "/../../../.fotos-prueba/reales/r08-pared-verde-con-cuadros.jpg";
// Con el difuminado viejo, 50 %; con el borde nuevo, 19 % (3/10/2026). Lo que queda no es contorno:
// es pared que la varita no tomó (las franjas angostas entre los cuadros, la sombra detrás de la
// planta). El umbral atrapa la vuelta del contorno sin depender de esa cobertura.
const MAXIMO = 0.3;

module.exports = {
  nombre: "simulador · una pared oscura pintada de claro no queda con contorno del color viejo",

  async correr(t, { k }) {
    if (!fs.existsSync(FOTO)) {
      t.nota("falta la foto: python3 tools/auditoria/simulador/fotos-reales.py");
      return;
    }
    const { browser, page } = await k.abrir({ movil: false });
    try {
      await k.ir(page, "/simulador");
      await page.click('button:has-text("Blanco Puro")');
      await page.setInputFiles("input[type=file]", FOTO);
      await page.waitForSelector("canvas", { timeout: 40000 });
      await page.waitForTimeout(1200);
      await page.evaluate(() => {
        const c = document.querySelector("canvas");
        window.__antes = c.getContext("2d", { willReadFrequently: true }).getImageData(0, 0, c.width, c.height).data.slice();
        c.scrollIntoView({ block: "center" });
      });
      await page.waitForTimeout(300);
      const b = await page.locator("canvas").boundingBox();
      await page.mouse.click(b.x + b.width * 0.4, b.y + b.height * 0.18);
      await page.waitForTimeout(2000);
      const r = await page.evaluate(() => {
        const c = document.querySelector("canvas"), W = c.width, H = c.height;
        const d = c.getContext("2d", { willReadFrequently: true }).getImageData(0, 0, W, H).data;
        const a = window.__antes;
        const luz = (v, i) => 0.2126 * v[i] + 0.7152 * v[i + 1] + 0.0722 * v[i + 2];
        // Pintado = quedó claro (la pared era verde oscura). El color de la pared vieja: el
        // promedio, en la foto original, de lo que se pintó.
        const pintado = new Uint8Array(W * H);
        let n = 0, r0 = 0, g0 = 0, b0 = 0;
        for (let p = 0; p < W * H; p++) {
          const i = p * 4;
          if (luz(d, i) - luz(a, i) > 60) { pintado[p] = 1; n++; r0 += a[i]; g0 += a[i + 1]; b0 += a[i + 2]; }
        }
        r0 /= n; g0 /= n; b0 /= n;
        // El contorno: píxeles NO pintados, pegados a lo pintado, que se siguen viendo como la
        // pared vieja. Los marcos negros de los cuadros también son oscuros, pero no son ese verde.
        let junto = 0, viejos = 0;
        for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) {
          const p = y * W + x;
          if (pintado[p]) continue;
          if (!(pintado[p - 1] || pintado[p + 1] || pintado[p - W] || pintado[p + W])) continue;
          junto++;
          const i = p * 4;
          if (Math.hypot(d[i] - r0, d[i + 1] - g0, d[i + 2] - b0) < 30) viejos++;
        }
        // La línea gris ADENTRO de la pintura (4/10, `simulador-uso-real`): un píxel que quedó a
        // medias entre dos pintados (izquierda y derecha, o arriba y abajo). Pasaba cuando el
        // último píxel de la selección se difuminaba al 67 % y los de afuera se pintaban enteros.
        // Sólo cuenta lo que era pared verde oscura en la foto (luz < 120 antes): la alfombra
        // blanca con dibujo negro ya era clara y su dibujo no es ninguna línea de la pintura.
        let linea = 0;
        const eraOscuro = (p) => luz(a, p * 4) < 120;
        const pintadoClaro = (p) => eraOscuro(p) && luz(d, p * 4) > 215;
        for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) {
          const p = y * W + x;
          const ahora = luz(d, p * 4);
          if (!eraOscuro(p) || ahora >= 200 || ahora < 120) continue;
          if ((pintadoClaro(p - 1) && pintadoClaro(p + 1)) || (pintadoClaro(p - W) && pintadoClaro(p + W))) linea++;
        }
        return { junto, viejos, linea };
      });
      if (r.junto < 500) {
        t.cierto(false, `el toque no pintó la pared verde (${r.junto} píxeles de borde): la prueba no puede medir`);
        return;
      }
      const parte = r.viejos / r.junto;
      t.nota(`borde de lo pintado: ${r.junto} píxeles, ${r.viejos} con el verde viejo (${(parte * 100).toFixed(1)} %)`);
      t.cierto(parte <= MAXIMO, `${(parte * 100).toFixed(1)} % del borde de la pared pintada quedó con el verde viejo (máximo ${MAXIMO * 100} %): contorno oscuro`);
      t.nota(`línea gris adentro de la pintura: ${r.linea} píxeles`);
      t.cierto(r.linea <= 150, `${r.linea} píxeles a medias entre dos pintados: una línea gris adentro de la pintura (con el difuminado de antes, miles)`);
    } finally {
      await browser.close();
    }
  },
};
