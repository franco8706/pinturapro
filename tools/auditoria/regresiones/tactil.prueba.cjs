/**
 * Vigila el tamaño de los controles que se tocan con el dedo.
 *
 * Lo que se rompió: los puntos de los carruseles de la home medían 6 px de alto, y "Editar",
 * "Borrar" y "Retirar cotización" del panel medían 17 px. Son acciones reales —una de ellas
 * borra una obra— y en un celular se erran.
 *
 * El mínimo que recomiendan iOS y Android es 44 px. Acá se exige 24 px, que es el piso donde
 * empieza a ser usable, para no convertir la prueba en una discusión de diseño: lo que se
 * vigila es que no vuelvan a aparecer controles de 6 px.
 *
 * Los links del pie de página quedan fuera a propósito: son navegación secundaria, están
 * documentados, y meterlos acá dejaría la prueba siempre en rojo por algo que nadie va a
 * cambiar hoy.
 */
const MINIMO = 24;

module.exports = {
  nombre: "táctil · los controles de acción se pueden tocar con el dedo",

  async correr(t, { k }) {
    const { browser, page } = await k.abrir({ movil: true });
    try {
      for (const ruta of ["/", "/simulador", "/obras", "/trabajos", "/pintores"]) {
        await k.ir(page, ruta);
        // La home carga por scroll: hay que recorrerla para que aparezcan los carruseles.
        await page.evaluate(async () => {
          for (let y = 0; y < document.body.scrollHeight; y += 600) {
            window.scrollTo(0, y);
            await new Promise((r) => setTimeout(r, 120));
          }
          window.scrollTo(0, 0);
        });
        await page.waitForTimeout(800);

        const chicos = await page.evaluate((MINIMO) => {
          const fuera = [];
          // Botones Y enlaces sueltos. Esta prueba medía sólo botones y además salteaba el pie
          // "por ser navegación secundaria": los enlaces de 17 px del pie, de la barra y de
          // /trabajos quedaron abiertos varias rondas y los reportaron cinco agentes seguidos,
          // porque aquí nada podía ponerse en rojo.
          // Un enlace DENTRO de una oración está exento (WCAG 2.5.8): se reconoce porque su
          // bloque dice más que el enlace. Uno suelto —un ítem del pie, un "Ingresá…"— no.
          const bloque = (el) => {
            let n = el.parentElement;
            while (n && getComputedStyle(n).display.startsWith("inline")) n = n.parentElement;
            return n;
          };
          for (const el of document.querySelectorAll("button, [role=button], a[href]")) {
            if (el.tagName === "A") {
              const b = bloque(el);
              if (b && (b.innerText || "").trim().length > (el.innerText || "").trim().length + 3) continue;
            }
            const r = el.getBoundingClientRect();
            if (r.width === 0 || r.height === 0) continue;
            if (r.height < MINIMO || r.width < MINIMO) {
              fuera.push(`${(el.innerText || el.getAttribute("aria-label") || el.tagName).trim().slice(0, 26)} [${Math.round(r.width)}x${Math.round(r.height)}]`);
            }
          }
          return fuera;
        }, MINIMO);

        t.cierto(chicos.length === 0, `${ruta}: controles por debajo de ${MINIMO} px → ${chicos.slice(0, 6).join(" · ")}`);
      }
    } finally {
      await browser.close();
    }
  },
};
