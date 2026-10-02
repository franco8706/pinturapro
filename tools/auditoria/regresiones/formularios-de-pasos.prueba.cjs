/**
 * Vigila dos cosas de los formularios de pasos (/publicar y /registro), que es por donde entra
 * un cliente y por donde se postula un pintor.
 *
 * 1. Que digan QUÉ falta. "Continuar" con el paso incompleto decía "completá los datos de este
 *    paso" aunque faltaran dos campos distintos: quien usa lector de pantalla tenía que recorrer
 *    el paso entero para adivinar. Estuvo abierto varias rondas (BITÁCORA); se arregló el 29/9
 *    con `faltan` en `multi-step-form.tsx`.
 * 2. Que al terminar, el foco quede en el título de confirmación. El formulario desaparece y
 *    con él el botón que tenía el foco: quedaba en <body>, y un lector de pantalla no se
 *    enteraba de que el envío había funcionado. Lo midió `accesibilidad` el 29/9.
 *
 * Publica un pedido ZZAGENT con `cliente2` y lo borra al final. En /registro no envía nada:
 * los formularios de contacto tienen un tope de 5 por hora que comparten con otras pruebas.
 */
module.exports = {
  nombre: "formularios de pasos · dicen qué falta y avisan cuando terminan",

  async correr(t, { k, base }) {
    const { browser, page } = await k.abrir({ movil: false });
    const titulo = `ZZAGENT pasos ${Date.now()}`;
    const texto = () => page.evaluate(() => document.querySelector("main").innerText);
    // Con el teclado, no con `page.click`: cuando el paso está incompleto el botón lleva
    // `aria-disabled` (se puede apretar igual, y explica qué falta), y Playwright se niega a
    // hacer clic en un elemento así — espera 30 s y explota, sin que el producto tenga nada.
    const continuar = async () => {
      await page.focus("button:has-text('Continuar')");
      await page.keyboard.press("Enter");
      await page.waitForTimeout(400);
    };

    try {
      // ── /registro, sin cuenta: el primer paso nombra sus dos campos ──
      await k.ir(page, "/registro");
      await continuar();
      t.contiene(await texto(), "Para seguir, completá tu nombre y los años de experiencia (de 1 a 70).", "/registro no dice qué falta en el primer paso");

      // ── /publicar ──
      await k.ingresar(page, "cliente2");
      await k.ir(page, "/publicar");
      await continuar();
      t.contiene(await texto(), "Para seguir, completá el título y el tipo de trabajo.", "/publicar no nombra los dos campos que faltan");

      await page.fill("input[placeholder^='Ej: Pintura']", titulo);
      await continuar();
      const conTitulo = await texto();
      t.contiene(conTitulo, "Para seguir, completá el tipo de trabajo.", "con el título puesto, /publicar no dice que falta sólo el tipo");
      t.cierto(!/completá el título/.test(conTitulo), "/publicar sigue pidiendo el título después de completarlo");

      // Se completa y se publica.
      await page.click("button:has-text('interior')");
      await continuar();
      // Una superficie absurda no avanza. `Number("999999999") > 0` la dejaba pasar, igual que
      // "Infinity" (formularios-hostiles publicó un pedido de "Infinity m²" el 2/10).
      await page.fill("input[type=number]", "999999999");
      await page.fill("input[placeholder^='Ej: Palermo']", "ZZAGENT barrio");
      await continuar();
      t.contiene(await texto(), "completá la superficie en m²", "/publicar dejó avanzar con una superficie de 999.999.999 m²");
      await page.fill("input[type=number]", "40");
      await continuar();
      await page.click("button:has-text('A definir')");
      await page.click("button:has-text('Publicar trabajo')");
      await page.waitForFunction(() => /Tu trabajo está publicado/.test(document.body.innerText), { timeout: 30000 });
      // El foco se mueve en un efecto, después de pintar: se lee en OTRA llamada (REGLAS §5).
      await page.waitForTimeout(300);
      const foco = await page.evaluate(() => {
        const e = document.activeElement;
        return e ? `${e.tagName} ${(e.innerText || "").trim().slice(0, 40)}` : "ninguno";
      });
      t.cierto(
        /^H1 Tu trabajo está publicado/.test(foco),
        `al publicar, el foco quedó en "${foco}" y no en el título de confirmación: un lector de pantalla no se entera de que funcionó`,
      );

      // Recargar la confirmación no puede dejar a la persona frente a un formulario vacío sin
      // pista de que el pedido ya entró: lo cargaba de nuevo (recorrido-web navegación, 2/10).
      await page.reload();
      await page.waitForFunction(() => /Recibí cotizaciones/.test(document.body.innerText), { timeout: 30000 });
      await page.waitForTimeout(500);
      t.contiene(await texto(), "ya está publicado", "al recargar después de publicar, nada dice que el pedido ya está publicado");
    } finally {
      await browser.close();
      if (base) {
        const borrados = await base.borrar("projects", `title=eq.${encodeURIComponent(titulo)}`);
        t.nota?.(`pedido de prueba borrado: ${borrados}`);
      }
    }
  },
};
