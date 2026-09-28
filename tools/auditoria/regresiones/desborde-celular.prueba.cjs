/**
 * Vigila que nada quede fuera de la pantalla en un celular.
 *
 * Lo que se rompió: al sumar el link "Mis datos" al panel del cliente, la fila de tres
 * botones pasó a medir 495 px en una pantalla de 390. "Publicar trabajo" —la acción
 * principal de ese panel— quedaba cortada, y **no había forma de llegar a ella**: nada
 * recortaba el contenedor, así que tampoco había scroll horizontal. Sólo se veían sus
 * primeros 41 px.
 *
 * Lo encontró un agente midiendo a mano. La radiografía automática del kit NO lo detectaba,
 * porque comparaba contra `window.innerWidth`, y el navegador agranda ese número hasta el
 * tamaño del contenido cuando algo se desborda sin recorte: valía 495, igual que la fila, y
 * la cuenta daba que todo entraba. Esta prueba compara contra el ancho real de la pantalla.
 *
 * El mismo bug ya se había corregido antes en el panel del pintor. Volvió porque no había
 * nada que lo vigilara.
 */
const ANCHO = 390;

module.exports = {
  nombre: "celular · nada queda fuera de la pantalla ni sin forma de alcanzarlo",

  async correr(t, { k }) {
    const { browser, page } = await k.abrir({ movil: true });
    try {
      const rutas = [
        ["/", null],
        ["/obras", null],
        ["/pintores", null],
        ["/simulador", null],
        ["/trabajos", null],
        ["/privacidad", null],
        ["/terminos", null],
        ["/cliente", "cliente"],
        ["/dashboard", "pintor2"],
        ["/mi-cuenta", "cliente"],
        ["/publicar", "cliente"], // la puerta de entrada del marketplace desde que /cotizar redirige acá
      ];

      let sesion = null;
      for (const [ruta, rol] of rutas) {
        if (rol && rol !== sesion) {
          await k.salir(page);
          await k.ingresar(page, rol);
          sesion = rol;
        }
        await k.ir(page, ruta);

        const r = await page.evaluate(() => {
          // El ancho real de la pantalla, no `window.innerWidth`: ver la nota del archivo.
          const real = document.documentElement.clientWidth;
          const fuera = [];
          for (const el of document.querySelectorAll("body *")) {
            const caja = el.getBoundingClientRect();
            if (caja.width === 0 || caja.height === 0) continue;
            if (caja.right <= real + 2 && caja.left >= -2) continue;
            // ¿Está afuera a propósito, o recortado por alguien?
            //
            //  · `aria-hidden` afuera de la pantalla es la trampa anti-spam de los
            //    formularios: un campo "No completar" parado en -9999 px que sólo llenan los
            //    robots. Está escondido de todo el mundo —lector de pantalla incluido— y
            //    sacarlo de ahí sería romperlo. Lo primero que marcó esta prueba fue eso.
            //  · Un ancestro (o el propio elemento) con scroll u overflow oculto significa que
            //    al contenido se llega, o que está escondido a propósito. Tampoco es el bug.
            //
            // Lo que queda son las dos cosas que sí importan: algo visible, fuera de la
            // pantalla, y sin ninguna forma de alcanzarlo.
            let tapado = false;
            for (let n = el; n && n !== document.body; n = n.parentElement) {
              const o = getComputedStyle(n);
              if (n.getAttribute("aria-hidden") === "true") { tapado = true; break; }
              if (n !== el && (/(auto|scroll|hidden)/.test(o.overflowX) || /(auto|scroll|hidden)/.test(o.overflow))) {
                tapado = true;
                break;
              }
              if (n === el && /(auto|scroll|hidden)/.test(o.overflowX + o.overflow) && caja.width <= 2) {
                // Un elemento de 1 px que se recorta a sí mismo: el envoltorio de la trampa.
                tapado = true;
                break;
              }
            }
            if (tapado) continue;
            const texto = (el.innerText || el.tagName).trim().replace(/\s+/g, " ").slice(0, 30);
            fuera.push(`${texto} [${Math.round(caja.left)}-${Math.round(caja.right)}]`);
          }
          return {
            ancho: real,
            scrollHorizontal: document.documentElement.scrollWidth > real + 2,
            fuera: [...new Set(fuera)].slice(0, 5),
          };
        });

        t.igual(r.ancho, ANCHO, `${ruta}: la pantalla no mide ${ANCHO} px`);
        t.cierto(
          r.fuera.length === 0,
          `${ruta}: hay contenido fuera de la pantalla y sin forma de alcanzarlo -> ${r.fuera.join(" · ")}`,
        );
        t.cierto(!r.scrollHorizontal, `${ruta}: la pagina se puede desplazar de costado`);
      }

      // ── Con el texto del sistema agrandado ──
      // La gente con poca visión agranda la letra desde el celular. Al 200 % los puntos del
      // carrusel de testimonios y el selector Interior/Exterior del simulador no entraban,
      // estiraban la página, y el encabezado fijo se estiraba con ella hasta dejar el botón
      // del menú FUERA de la pantalla: sin forma de navegar. Lo midió el agente
      // `accesibilidad`. Con texto normal esta prueba daba verde, y por eso no lo veía.
      await k.salir(page);
      for (const ruta of ["/", "/simulador", "/pintores", "/obras", "/contacto"]) {
        await k.ir(page, ruta);
        await page.addStyleTag({ content: "html{font-size:200% !important}" });
        await page.evaluate(async () => {
          for (let y = 0; y < document.body.scrollHeight; y += 500) {
            window.scrollTo(0, y);
            await new Promise((r) => setTimeout(r, 60));
          }
          window.scrollTo(0, 0);
        });
        await page.waitForTimeout(400);
        const g = await page.evaluate(() => {
          const W = document.documentElement.clientWidth;
          const menu = document.querySelector('header button[aria-label*="men" i]');
          const m = menu ? menu.getBoundingClientRect() : null;
          return { ancho: document.documentElement.scrollWidth, W, menuFuera: !!m && (m.right > W + 1 || m.left < -1) };
        });
        t.cierto(g.ancho <= g.W + 2, `${ruta} con el texto al 200 %: la página mide ${g.ancho} px en una pantalla de ${g.W}`);
        t.cierto(!g.menuFuera, `${ruta} con el texto al 200 %: el botón del menú queda fuera de la pantalla`);
      }
    } finally {
      await browser.close();
    }
  },
};
