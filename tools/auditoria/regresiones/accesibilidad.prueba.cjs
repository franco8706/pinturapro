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
    //
    // Se medía en /cotizar, que ya no existe (redirige a /publicar desde que Pintura Pro es un
    // marketplace puro). Lo que se cuida es el componente de pasos, `MultiStepForm`, y
    // /publicar usa el mismo: la trampa de teclado vuelve igual si se rompe ahí.
    {
      const { browser, page } = await k.abrir({ movil: false });
      try {
        await k.ingresar(page, "cliente");
        await k.ir(page, "/publicar");
        const foco = () =>
          page.evaluate(() => {
            const e = document.activeElement;
            return e ? `${e.tagName}${e.type ? `[${e.type}]` : ""} ${(e.innerText || e.placeholder || "").trim().slice(0, 30)}` : "ninguno";
          });

        // Antes de completar nada: "Continuar" tiene que poder enfocarse y explicar qué falta.
        // Estaba `disabled`, y un botón deshabilitado no se puede enfocar con teclado: quien
        // navega así no podía ni acercarse a averiguar por qué no avanzaba.
        let enBoton = false;
        for (let i = 0; i < 40 && !enBoton; i++) {
          await page.keyboard.press("Tab");
          enBoton = /Continuar/.test(await foco());
        }
        t.cierto(enBoton, "con el paso incompleto, 'Continuar' no se puede enfocar con el teclado");
        if (enBoton) {
          await page.keyboard.press("Enter");
          await page.waitForTimeout(700);
          t.contiene(
            await page.evaluate(() => document.body.innerText),
            // Desde el 29/9 nombra los campos: antes decía "completá los datos de este paso"
            // aunque faltaran dos cosas distintas, y había que recorrer el paso para adivinar.
            "Para seguir, completá el título y el tipo de trabajo.",
            "apretar 'Continuar' con el paso incompleto no dice QUÉ falta",
          );
        }

        await k.ir(page, "/publicar");
        // El título: se llega con Tab y se escribe. No se envía nada — el pedido nunca se
        // publica, así que esta prueba no crea datos.
        let enTitulo = false;
        for (let i = 0; i < 40 && !enTitulo; i++) {
          await page.keyboard.press("Tab");
          enTitulo = /^INPUT\[text\]/.test(await foco());
        }
        if (!t.cierto(enTitulo, "con teclado no se llega al título de /publicar")) return;
        await page.keyboard.type("ZZAGENT prueba de teclado");

        // El tipo de trabajo: un botón. Ojo, el placeholder del título también dice
        // "interior": se busca un BUTTON.
        let enTipo = false;
        for (let i = 0; i < 10 && !enTipo; i++) {
          await page.keyboard.press("Tab");
          enTipo = /^BUTTON.*interior/i.test(await foco());
        }
        if (!t.cierto(enTipo, "con teclado no se llega a elegir el tipo de trabajo")) return;
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
        for (const ruta of ["/", "/pintores", "/nosotros", "/contacto"]) {
          await k.ir(page, ruta);
          const malos = await page.evaluate((PISO) => {
            const rgba = (c) => {
              const m = c.match(/[\d.]+/g);
              if (!m) return [0, 0, 0, 0];
              return [Number(m[0]), Number(m[1]), Number(m[2]), m[3] === undefined ? 1 : Number(m[3])];
            };
            const sobre = ([r, g, b, a], [fr, fg, fb]) => [r * a + fr * (1 - a), g * a + fg * (1 - a), b * a + fb * (1 - a)];
            const lum = ([r, g, b]) => {
              const [lr, lg, lb] = [r, g, b].map((v) => {
                v /= 255;
                return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
              });
              return 0.2126 * lr + 0.7152 * lg + 0.0722 * lb;
            };
            // El fondo que se VE detrás del texto: una capa translúcida se mezcla con lo que
            // tiene debajo. Antes se tomaba la primera capa con color sin su transparencia, y la
            // insignia "Silver" (gris al 10 % sobre blanco: 4,9:1 de verdad) daba 1,00:1 —
            // aparece con cualquier pintor sin reseñas (8/10/2026).
            const fondoDe = (el) => {
              const capas = [];
              for (let n = el; n; n = n.parentElement) {
                const c = rgba(getComputedStyle(n).backgroundColor);
                if (c[3] === 0) continue;
                capas.push(c);
                if (c[3] >= 1) break;
              }
              let fondo = capas.length && capas[capas.length - 1][3] >= 1 ? capas.pop() : [255, 255, 255];
              for (const capa of capas.reverse()) fondo = sobre(capa, fondo);
              return fondo;
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
              const fondo = fondoDe(el);
              // El texto translúcido (text-ink/60) también se mezcla con su fondo.
              const l1 = lum(sobre(rgba(cs.color), fondo));
              const l2 = lum(fondo);
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

    // ── 5. La reseña: quién la escribe tiene que saber qué está por mandar ──
    //
    // Es el formulario donde alguien califica a una persona real, y era el menos accesible
    // del sitio: las estrellas decían cuál era cada una ("3 estrellas") pero no cuál estaba
    // ELEGIDA —la única señal era el color— y el campo de comentario no tenía más nombre que
    // su `placeholder`, que desaparece apenas se escribe la primera letra.
    {
      const { browser, page } = await k.abrir({});
      try {
        // `cliente4` es la única cuenta demo con un trabajo terminado y SIN reseña: el botón
        // "Calificar a…" sólo aparece ahí. Si esta prueba empieza a fallar diciendo que no hay
        // nada para calificar, alguien le dejó una reseña a ese trabajo.
        await k.ingresar(page, "cliente4");
        await k.ir(page, "/cliente");

        const abierto = await page.evaluate(() => {
          const b = [...document.querySelectorAll("button")].find((x) => /Calificar a/i.test(x.textContent || ""));
          if (!b) return false;
          b.click();
          return true;
        });
        if (!t.cierto(abierto, "el panel del cliente no ofrece calificar ningún trabajo")) return;
        await page.waitForTimeout(500);

        const campo = await page.evaluate(() => {
          const ta = document.querySelector("textarea[name=comment]");
          if (!ta) return null;
          return {
            conEtiqueta: ta.labels?.length > 0 || !!ta.getAttribute("aria-label") || !!ta.getAttribute("aria-labelledby"),
          };
        });
        t.cierto(!!campo, "no apareció el campo de comentario de la reseña");
        t.cierto(
          campo && campo.conEtiqueta,
          "el comentario de la reseña no tiene nombre accesible: su único nombre era el texto de ejemplo, que se va al escribir",
        );

        const hayEstrellas = await page.evaluate(() => {
          const bs = [...document.querySelectorAll("button")].filter((b) => /estrella/i.test(b.getAttribute("aria-label") || ""));
          if (bs.length < 5) return false;
          bs[3].click();
          return true;
        });
        // La lectura va en OTRA llamada, después de esperar: leer `aria-pressed` en el mismo
        // tick del clic devuelve el DOM de antes, porque React todavía no repintó. La primera
        // versión de esta prueba fallaba por eso y el producto estaba bien.
        await page.waitForTimeout(400);
        const estrellas = hayEstrellas
          ? await page.evaluate(() => {
              const bs = [...document.querySelectorAll("button")].filter((b) => /estrella/i.test(b.getAttribute("aria-label") || ""));
              return { cual: bs.findIndex((b) => b.getAttribute("aria-pressed") === "true") + 1 };
            })
          : null;
        t.cierto(!!estrellas, "no se encontraron las cinco estrellas");
        t.igual(
          estrellas && estrellas.cual,
          4,
          "después de elegir 4 estrellas, ninguna queda marcada: sin ver el color no hay forma de saber qué calificación se va a enviar",
        );

        const dicho = await page.evaluate(() => {
          const v = [...document.querySelectorAll("[role=status][aria-live]")].map((x) => (x.textContent || "").trim());
          return v.join(" · ");
        });
        t.contiene(dicho, "4 de 5", "la calificación elegida no se dice en ningún lado que se pueda escuchar");
      } finally {
        await browser.close();
      }
    }
  },
};
