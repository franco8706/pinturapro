/**
 * Vigila que una reseña abusiva tenga salida dentro del sitio.
 *
 * Lo que pasaba (abuso-marketplace, 2/10): un cliente dejó una estrella con "te voy a arruinar
 * la reputación si no me devolvés la plata" y se publicó al instante. El pintor no recibía
 * aviso ni veía el texto en su panel (sólo un contador); el dueño no tenía ninguna pantalla
 * donde leer reseñas, y mucho menos sacarlas. /terminos prometía "lo damos de baja" sin que
 * existiera con qué.
 *
 * Arma por la base un trabajo completado y una reseña ZZAGENT de `cliente3` sobre `pintor3`,
 * y comprueba: (1) el pintor la lee en /dashboard con un enlace para denunciarla; (2) el
 * administrador la ve en /admin → Reseñas; (3) NADIE más puede borrarla llamando a la acción
 * directamente (sin sesión, un cliente, el propio pintor); (4) el administrador la da de baja y
 * (5) el promedio del pintor vuelve exactamente a lo que era. Borra lo que haya quedado en el `finally`.
 */
module.exports = {
  nombre: "moderación · el pintor ve sus reseñas y el dueño puede dar de baja una",

  async correr(t, { k, base }) {
    if (!base) {
      t.cierto(false, "hace falta la clave de servicio (apps/web/.env.local) para armar el escenario");
      return;
    }
    const marca = `ZZAGENT moderacion ${Date.now()}`;
    let jobId = null;
    let reviewId = null;
    const { browser, page } = await k.abrir({ movil: false });
    try {
      const [pintor] = await base.leer("profiles", "full_name=eq.Diego%20Sosa&type=eq.painter", "id,rating,rating_count");
      const [cliente] = await base.leer("profiles", "full_name=eq.Sof%C3%ADa%20Luna&type=eq.client", "id");
      t.cierto(!!pintor && !!cliente, "no encontré a pintor3 (Diego Sosa) o a cliente3 (Sofía Luna)");
      if (!pintor || !cliente) return;

      const [job] = await base.insertar("jobs", [
        { client_id: cliente.id, painter_id: pintor.id, status: "completed", amount: 100000, commission_rate: 0.1, commission_amount: 10000, note: marca },
      ]);
      jobId = job.id;
      const [review] = await base.insertar("reviews", [
        { job_id: jobId, author_id: cliente.id, target_id: pintor.id, rating: 1, comment: marca },
      ]);
      reviewId = review.id;

      // 1. El pintor la lee en su panel y tiene cómo denunciarla.
      await k.ingresar(page, "pintor3");
      await k.ir(page, "/dashboard");
      const panel = await page.evaluate(() => document.querySelector("main").innerText);
      t.contiene(panel, marca, "el pintor no ve el texto de su reseña en /dashboard");
      const denuncia = await page.evaluate(
        (id) => [...document.querySelectorAll("a[href^='mailto:']")].some((a) => decodeURIComponent(a.href).includes(id)),
        reviewId,
      );
      t.cierto(denuncia, "falta el enlace para denunciar la reseña (con su identificador) en /dashboard");
      await k.salir(page);

      // 2. El dueño la ve en su panel.
      await k.ingresar(page, "admin");
      await k.ir(page, "/admin");
      await page.click("button:has-text('Reseñas')");
      let fila = page.locator("tr", { hasText: marca });
      await fila.waitFor({ timeout: 15000 });

      // 3. La acción de borrar, llamada por alguien que NO es administrador.
      //    Una Server Action es un endpoint: se puede llamar sin pasar por la pantalla, y la
      //    página de /admin que la rodea no la protege. Se intercepta el pedido del propio
      //    administrador para quedarse con su identificador (sin dejarlo llegar), y se repite
      //    con la sesión de un cliente y sin sesión. La reseña tiene que seguir ahí.
      let pedido = null;
      await page.route("**/admin", async (route) => {
        const r = route.request();
        if (r.method() === "POST" && r.headers()["next-action"]) {
          pedido = { accion: r.headers()["next-action"], tipo: r.headers()["content-type"], cuerpo: r.postData() };
          return route.abort();
        }
        return route.continue();
      });
      await fila.locator("button:has-text('Dar de baja')").click();
      await fila.locator("button:has-text('Sí, borrarla')").click();
      await page.waitForTimeout(1500);
      await page.unroute("**/admin");
      t.cierto(!!pedido, "no pude capturar la acción de dar de baja: ¿cambió la pantalla?");
      t.igual(await base.contar("reviews", `id=eq.${reviewId}`), 1, "la reseña se borró cuando sólo se estaba capturando la acción");

      if (pedido) {
        const repetir = () =>
          page.request.post(`${k.BASE}/admin`, {
            headers: { "next-action": pedido.accion, "content-type": pedido.tipo, accept: "text/x-component" },
            data: pedido.cuerpo,
            maxRedirects: 0,
          });
        await k.salir(page);
        await repetir().catch(() => {});
        t.igual(await base.contar("reviews", `id=eq.${reviewId}`), 1, "SIN SESIÓN se pudo borrar una reseña llamando a la acción directamente");
        await k.ingresar(page, "cliente");
        await repetir().catch(() => {});
        t.igual(await base.contar("reviews", `id=eq.${reviewId}`), 1, "una cuenta de CLIENTE pudo borrar una reseña llamando a la acción directamente");
        await k.salir(page);
        await k.ingresar(page, "pintor3");
        await repetir().catch(() => {});
        t.igual(await base.contar("reviews", `id=eq.${reviewId}`), 1, "el PINTOR reseñado pudo borrar su propia reseña mala llamando a la acción directamente");
        await k.salir(page);
      }

      // 4. Ahora sí, el dueño la da de baja.
      await k.ingresar(page, "admin");
      await k.ir(page, "/admin");
      await page.click("button:has-text('Reseñas')");
      fila = page.locator("tr", { hasText: marca });
      await fila.waitFor({ timeout: 15000 });
      await fila.locator("button:has-text('Dar de baja')").click();
      await fila.locator("button:has-text('Sí, borrarla')").click();
      await page.waitForFunction((m) => !document.body.innerText.includes(m), marca, { timeout: 30000 });
      t.igual(await base.contar("reviews", `id=eq.${reviewId}`), 0, "la reseña sigue en la base después de darla de baja");

      // 5. El promedio vuelve a ser el de antes (lo recalcula el trigger al borrar).
      const [despues] = await base.leer("profiles", `id=eq.${pintor.id}`, "rating,rating_count");
      t.igual(
        [Number(despues.rating), despues.rating_count],
        [Number(pintor.rating), pintor.rating_count],
        "el promedio del pintor no volvió a lo que era después de dar de baja la reseña",
      );
    } finally {
      await browser.close();
      if (reviewId) await base.borrar("reviews", `id=eq.${reviewId}`).catch(() => {});
      if (jobId) await base.borrar("jobs", `id=eq.${jobId}`).catch(() => {});
    }
  },
};
