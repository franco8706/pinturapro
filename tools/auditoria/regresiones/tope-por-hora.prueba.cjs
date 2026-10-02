/**
 * Vigila que una cuenta no pueda publicar pedidos sin límite.
 *
 * Publicar un pedido no tenía ningún tope (los formularios de contacto sí, 5 por hora): el
 * agente `formularios-hostiles` publicó 8 seguidos con una cuenta y cotizó los 8 con otra sin
 * que nada lo frenara (2/10). Un programa con una sola cuenta podía llenar el tablero público.
 * Ahora la acción cuenta lo que la cuenta creó en la última hora (`TOPE_POR_HORA` en
 * `@pinturapro/dominio`: 10 pedidos, 30 cotizaciones).
 *
 * Arma el escenario por la base (10 pedidos ZZAGENT de `cliente3` recién creados) y prueba
 * que el undécimo, por la pantalla, se rechace con un mensaje que se entienda. Borra todo al
 * final. El tope de cotizaciones usa la misma función y no se prueba aparte.
 */
module.exports = {
  nombre: "tope por hora · una cuenta no puede publicar pedidos sin límite",

  async correr(t, { k, base }) {
    if (!base) {
      t.cierto(false, "hace falta la clave de servicio (apps/web/.env.local) para armar el escenario");
      return;
    }
    const marca = `ZZAGENT tope ${Date.now()}`;
    const { browser, page } = await k.abrir({ movil: false });
    try {
      const [cuenta] = await base.leer("profiles", "full_name=eq.Sof%C3%ADa%20Luna&type=eq.client", "id");
      t.cierto(!!cuenta, "no encontré la cuenta de cliente3 (Sofía Luna)");
      if (!cuenta) return;
      await base.insertar(
        "projects",
        Array.from({ length: 10 }, (_, i) => ({
          owner_id: cuenta.id,
          type: "service",
          title: `${marca} n${i}`,
          slug: `zzagent-tope-${Date.now()}-${i}`,
          published: false, // no hace falta que se vean en el tablero para contar
        })),
      );

      await k.ingresar(page, "cliente3");
      await k.ir(page, "/publicar");
      const continuar = async () => {
        await page.focus("button:has-text('Continuar')");
        await page.keyboard.press("Enter");
        await page.waitForTimeout(400);
      };
      await page.fill("input[placeholder^='Ej: Pintura']", `${marca} el undécimo`);
      await page.click("button:has-text('interior')");
      await continuar();
      await page.fill("input[type=number]", "30");
      await page.fill("input[placeholder^='Ej: Palermo']", "ZZAGENT barrio");
      await continuar();
      await page.click("button:has-text('A definir')");
      await page.click("button:has-text('Publicar trabajo')");
      await page.waitForFunction(
        () => /Publicaste muchos pedidos|Tu trabajo está publicado/.test(document.body.innerText),
        { timeout: 30000 },
      );
      const texto = await page.evaluate(() => document.querySelector("main").innerText);
      t.contiene(texto, "Publicaste muchos pedidos en poco tiempo", "el undécimo pedido de la hora se publicó igual: no hay tope");
      t.igual(
        await base.contar("projects", `title=eq.${encodeURIComponent(`${marca} el undécimo`)}`),
        0,
        "el pedido que tenía que rechazarse quedó guardado en la base",
      );
    } finally {
      await browser.close();
      await base.borrar("projects", `title=like.${encodeURIComponent(`${marca}%`)}`);
    }
  },
};
