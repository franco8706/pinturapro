/**
 * Vigila la separación de roles del marketplace.
 *
 * Lo que se rompió (19/9/2026, medido en Chrome): una cuenta de tipo cliente entraba a
 * /trabajos, veía "Cotizar este trabajo" en el pedido de OTRA clienta, mandaba un monto y la
 * cotización se creaba. Ninguna de las tres capas miraba el rol. Cualquiera con una cuenta
 * gratis podía hacerse pasar por pintor, cobrar una seña y desaparecer.
 *
 * Arreglado en la migración 0016 (`es_pintor()`) + la página + la acción.
 */
module.exports = {
  nombre: "seguridad de roles · un cliente no puede cotizar ni publicar obras",

  async correr(t, { k }) {
    // ── Una cuenta de cliente en /trabajos ──
    {
      const { browser, page } = await k.abrir({ movil: false });
      try {
        await k.ingresar(page, "cliente");
        await k.ir(page, "/trabajos");
        const tarjetas = await page.evaluate(() =>
          [...document.querySelectorAll("article")].map((a) => ({
            propio: /Este es tu pedido/.test(a.textContent),
            hayFormulario: !!a.querySelector("form"),
            hayBotonCotizar: [...a.querySelectorAll("button")].some((b) => /Cotizar/.test(b.textContent)),
            aviso: (a.querySelector(".mt-auto")?.textContent || "").replace(/\s+/g, " ").trim(),
          })),
        );
        t.cierto(tarjetas.length > 0, "no había ningún pedido publicado para probar");
        for (const c of tarjetas.filter((x) => !x.propio)) {
          t.cierto(!c.hayBotonCotizar, "a un cliente se le ofrece 'Cotizar este trabajo' en un pedido ajeno");
          t.cierto(!c.hayFormulario, "a un cliente se le muestra el formulario de cotización");
          t.contiene(c.aviso, "Las cotizaciones las envían los pintores", "falta el aviso de por qué no puede cotizar");
        }
      } finally {
        await browser.close();
      }
    }

    // ── Una cuenta de cliente en el formulario de obras ──
    {
      const { browser, page } = await k.abrir({ movil: false });
      try {
        await k.ingresar(page, "cliente3");
        await k.ir(page, "/dashboard/nueva-obra");
        const r = await page.evaluate(() => ({
          url: location.pathname,
          hayFormulario: !!document.querySelector("input[name=title]"),
        }));
        t.igual(r.url, "/cliente", "un cliente debería terminar en su panel, no en el formulario de obras");
        t.cierto(!r.hayFormulario, "a un cliente se le muestra el formulario de nueva obra");
      } finally {
        await browser.close();
      }
    }

    // ── Un pintor sí puede, que es lo que el arreglo no debe romper ──
    {
      const { browser, page } = await k.abrir({ movil: false });
      try {
        await k.ingresar(page, "pintor2");
        await k.ir(page, "/dashboard/nueva-obra");
        t.cierto(
          await page.evaluate(() => !!document.querySelector("input[name=title]")),
          "un pintor YA NO puede abrir el formulario de nueva obra (el arreglo se pasó de largo)",
        );
      } finally {
        await browser.close();
      }
    }
  },
};
