/**
 * Vigila que la web se pueda usar sin mouse, sin ver bien y sin que todo se mueva.
 *
 * Lo que se rompió, todo medido en Chrome:
 *  · Con teclado no se podía avanzar en /cotizar: al apretar Enter en "Continuar", el botón se
 *    deshabilitaba solo (el paso nuevo arranca vacío) y el foco caía al <body>. Desde ahí,
 *    seguir tabeando saltaba a las preguntas frecuentes: el campo del paso nuevo está ANTES en
 *    el documento y nunca se alcanzaba. Era el formulario por el que entra un cliente.
 *  · Con "reducir movimiento" activado, los carruseles seguían pasando solos cada 5-6 segundos.
 *    Quien activa eso suele hacerlo por mareo o migraña.
 *  · El menú del celular no cerraba con Escape.
 *  · Había texto en 1,49:1 y 2,38:1 cuando el piso es 3:1.
 */
const PISO_DURO = 3; // por debajo de esto no hay discusión posible: no se lee

module.exports = {
  nombre: "accesibilidad · teclado, reducir movimiento y contraste",

  async correr(t, { k }) {
    // ── 1. Avanzar de paso con el teclado ──
    {
      const { browser, page } = await k.abrir({ movil: false });
      try {
        await k.ir(page, "/cotizar");
        const foco = () =>
          page.evaluate(() => {
            const e = document.activeElement;
            return e ? `${e.tagName}${e.type ? `[${e.type}]` : ""} ${(e.innerText || e.placeholder || "").trim().slice(0, 30)}` : "ninguno";
          });

        // Antes de completar nada: "Continuar" tiene que poder enfocarse y explicar qué falta.
        // Estaba `disabled`, y un botón deshabilitado no se puede enfocar con teclado: quien
        // navega así no podía ni acercarse a averiguar por qué no avanzaba.
        let enBoton = false;
        for (let i = 0; i < 30 && !enBoton; i++) {
          await page.keyboard.press("Tab");
          enBoton = /Continuar/.test(await foco());
        }
        t.cierto(enBoton, "con el paso incompleto, 'Continuar' no se puede enfocar con el teclado");
        if (enBoton) {
          await page.keyboard.press("Enter");
          await page.waitForTimeout(700);
          t.contiene(
            await page.evaluate(() => document.body.innerText),
            "completá los datos de este paso",
            "apretar 'Continuar' con el paso incompleto no explica qué falta",
          );
        }

        await k.ir(page, "/cotizar");
        let llegó = false;
        for (let i = 0; i < 30 && !llegó; i++) {
          await page.keyboard.press("Tab");
          llegó = /Interior/.test(await foco());
        }
        if (!t.cierto(llegó, "con teclado no se llega a la primera opción de /cotizar")) return;
        await page.keyboard.press("Enter");
        await page.waitForTimeout(500);

        let enContinuar = false;
        for (let i = 0; i < 15 && !enContinuar; i++) {
          await page.keyboard.press("Tab");
          enContinuar = /Continuar/.test(await foco());
        }
        if (!t.cierto(enContinuar, "con teclado no se llega al botón Continuar")) return;
        await page.keyboard.press("Enter");
        await page.waitForTimeout(900);

        // Tabeando HACIA ADELANTE hay que llegar al campo del paso nuevo.
        let alcanzó = false;
        const recorrido = [];
        for (let i = 0; i < 5 && !alcanzó; i++) {
          await page.keyboard.press("Tab");
          await page.waitForTimeout(150);
          const f = await foco();
          recorrido.push(f);
          alcanzó = /INPUT/.test(f);
        }
        t.cierto(alcanzó, `después de avanzar de paso, el foco no llega al campo: ${recorrido.join(" → ")}`);
      } finally {
        await browser.close();
      }
    }

    // ── 2. Reducir movimiento ──
    {
      const { browser, page } = await k.abrir({ movil: false });
      try {
        await page.emulateMedia({ reducedMotion: "reduce" });
        await k.ir(page, "/");
        const posicion = () =>
          page.evaluate(() =>
            [...document.querySelectorAll("div")]
              .map((d) => getComputedStyle(d).transform)
              .filter((x) => x && x !== "none" && x.includes("matrix"))
              .join("|"),
          );
        const antes = await posicion();
        await page.waitForTimeout(13000); // más que el intervalo más largo (6 s)
        t.igual(await posicion(), antes, "con 'reducir movimiento' activado algo se sigue moviendo solo");
      } finally {
        await browser.close();
      }
    }

    // ── 3. Escape cierra el menú del celular ──
    {
      const { browser, page } = await k.abrir({ movil: true });
      try {
        await k.ir(page, "/");
        const abrió = await page.evaluate(() => {
          const b = [...document.querySelectorAll("button")].find((x) => x.getAttribute("aria-expanded") !== null);
          if (!b) return null;
          b.click();
          return b.getAttribute("aria-expanded");
        });
        if (abrió === null) {
          t.nota("no encontré el botón del menú (aria-expanded); se saltea");
        } else {
          await page.waitForTimeout(500);
          await page.keyboard.press("Escape");
          await page.waitForTimeout(500);
          const cerrado = await page.evaluate(() => {
            const b = [...document.querySelectorAll("button")].find((x) => x.getAttribute("aria-expanded") !== null);
            return b?.getAttribute("aria-expanded") === "false";
          });
          t.cierto(cerrado, "el menú del celular no cierra con Escape");
        }
      } finally {
        await browser.close();
      }
    }

    // ── 4. Contraste ──
    {
      const { browser, page } = await k.abrir({ movil: false });
      try {
        for (const ruta of ["/", "/pintores", "/nosotros", "/cotizar"]) {
          await k.ir(page, ruta);
          const malos = await page.evaluate((PISO) => {
            const lum = (c) => {
              const m = c.match(/[\d.]+/g);
              if (!m) return 0;
              const [r, g, b] = m.slice(0, 3).map(Number).map((v) => {
                v /= 255;
                return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
              });
              return 0.2126 * r + 0.7152 * g + 0.0722 * b;
            };
            const fondoDe = (el) => {
              for (let n = el; n; n = n.parentElement) {
                const bg = getComputedStyle(n).backgroundColor;
                if (bg && !/rgba\(0, 0, 0, 0\)/.test(bg)) return bg;
              }
              return "rgb(255,255,255)";
            };
            const fuera = [];
            for (const el of document.querySelectorAll("p, span, h1, h2, h3, h4, a, button, li, dd, dt")) {
              if (el.getAttribute("aria-hidden") === "true" || el.closest("[aria-hidden='true']")) continue;
              const texto = (el.childNodes.length && [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim())) ? el.textContent.trim() : "";
              if (!texto) continue;
              const r = el.getBoundingClientRect();
              if (r.width === 0 || r.height === 0) continue;
              const cs = getComputedStyle(el);
              if (cs.visibility === "hidden" || cs.opacity === "0") continue;
              const l1 = lum(cs.color);
              const l2 = lum(fondoDe(el));
              const ratio = (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
              if (ratio < PISO) fuera.push(`"${texto.slice(0, 22)}" ${ratio.toFixed(2)}:1`);
            }
            return [...new Set(fuera)];
          }, PISO_DURO);
          t.cierto(malos.length === 0, `${ruta}: texto por debajo de ${PISO_DURO}:1 → ${malos.slice(0, 5).join(" · ")}`);
        }
      } finally {
        await browser.close();
      }
    }
  },
};
