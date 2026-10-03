/**
 * Vigila el ciclo entero de un trabajo, de punta a punta y por la pantalla:
 *   el cliente publica → el pintor cotiza → el cliente acepta → el pintor completa →
 *   el cliente deja su reseña. Y aparte: el pintor retira una cotización.
 *
 * Por qué existe: es lo que el marketplace HACE, y no tenía ninguna prueba. El mapa de
 * cobertura del cierre de la ronda de escala (2/10/2026) mostró que 9 de las 15 acciones de
 * servidor no las nombraba nadie —`dejarResena`, `marcarCompletado`, `cancelarTrabajo`,
 * `aceptarCotizacion` entre ellas—: cada una se había probado suelta, a mano, en alguna ronda,
 * y ninguna quedó vigilada. Un cambio en una policy o en un trigger podía cortar el ciclo por
 * la mitad sin que `pnpm verificar` se enterara.
 *
 * Cada paso se hace con clics y se comprueba en la BASE (el estado del trabajo), no en un
 * cartel: los carteles son fugaces y cambian de texto.
 *
 * Usa `cliente2` y `pintor3`, todo con la marca ZZAGENT, y deja la base como estaba: borra la
 * reseña, los trabajos y los pedidos, y confirma que el promedio del pintor volvió al de antes.
 */
module.exports = {
  nombre: "ciclo de trabajo · publicar, cotizar, aceptar, completar y reseñar",

  async correr(t, { k, base }) {
    if (!base) {
      t.cierto(false, "hace falta la clave de servicio (apps/web/.env.local) para seguir el estado del trabajo");
      return;
    }
    const marca = `ZZAGENT ciclo ${Date.now()}`;
    const titulo = `${marca} living`;
    const tituloRetiro = `${marca} retiro`;
    const { browser, page } = await k.abrir({ movil: false });

    /**
     * Aprieta el botón `texto` de la tarjeta que nombra `dentroDe`.
     *
     * "Un botón que tenga cerca el título" no alcanza: la lista entera contiene todos los
     * títulos, así que el PRIMER botón de la página ya cumple. Así fue como el script de un
     * agente dejó una cotización en el pedido de otra persona (29/9), y como la primera
     * versión de esta prueba retiró la cotización equivocada. Se elige el botón cuyo
     * contenedor MÁS CHICO nombra al pedido.
     */
    const apretar = (dentroDe, texto) =>
      page.evaluate(
        ([cerca, tx]) => {
          let mejor = null;
          for (const boton of [...document.querySelectorAll("button")].filter((b) => new RegExp(tx).test(b.textContent || ""))) {
            for (let n = boton.parentElement, i = 0; n && i < 10; n = n.parentElement, i++) {
              if ((n.textContent || "").includes(cerca)) {
                const largo = (n.textContent || "").length;
                if (!mejor || largo < mejor.largo) mejor = { boton, largo };
                break;
              }
            }
          }
          if (!mejor) return false;
          mejor.boton.click();
          return true;
        },
        [dentroDe, texto],
      );
    /** Clic y confirmación en línea ("¿Confirmar?"), con el respiro que necesita React entre los dos. */
    const apretarYConfirmar = async (dentroDe, texto) => {
      const primero = await apretar(dentroDe, texto);
      await page.waitForTimeout(500);
      const segundo = primero && (await apretar(dentroDe, "Confirmar"));
      return primero && segundo;
    };
    /** Espera a que el trabajo llegue a un estado, mirando la base. */
    const estadoDe = async (filtro, esperado) => {
      let ultimo = null;
      for (let i = 0; i < 30; i++) {
        const [fila] = await base.leer("jobs", filtro, "id,status,amount,commission_amount");
        ultimo = fila ?? null;
        if (fila && fila.status === esperado) return fila;
        await page.waitForTimeout(500);
      }
      return ultimo;
    };

    let pintor = null;
    try {
      [pintor] = await base.leer("profiles", "full_name=eq.Diego%20Sosa&type=eq.painter", "id,rating,rating_count");
      const [cliente] = await base.leer("profiles", "full_name=eq.Javier%20M%C3%A9ndez&type=eq.client", "id");
      t.cierto(!!pintor && !!cliente, "no encontré a pintor3 (Diego Sosa) o a cliente2 (Javier Méndez)");
      if (!pintor || !cliente) return;

      // ── 1. El cliente publica ──
      await k.ingresar(page, "cliente2");
      await k.ir(page, "/publicar");
      const continuar = async () => {
        await page.focus("button:has-text('Continuar')");
        await page.keyboard.press("Enter");
        await page.waitForTimeout(400);
      };
      await page.fill("input[placeholder^='Ej: Pintura']", titulo);
      await page.click("button:has-text('interior')");
      await continuar();
      await page.fill("input[type=number]", "45");
      await page.fill("input[placeholder^='Ej: Palermo']", "ZZAGENT barrio");
      await continuar();
      await page.click("button:has-text('A definir')");
      await page.click("button:has-text('Publicar trabajo')");
      await page.waitForFunction(() => /Tu trabajo está publicado/.test(document.body.innerText), { timeout: 30000 });
      const [pedido] = await base.leer("projects", `title=eq.${encodeURIComponent(titulo)}`, "id,published,type,description");
      t.cierto(!!pedido && pedido.published && pedido.type === "service", "el pedido publicado no quedó en la base como un pedido abierto");
      if (!pedido) return;
      t.contiene(pedido.description || "", "45", "la descripción del pedido no trae la superficie que se cargó");
      await k.salir(page);

      // Un segundo pedido con una cotización ya hecha, para probar el retiro sin repetir todo.
      const [pedidoRetiro] = await base.insertar("projects", [
        { owner_id: cliente.id, type: "service", title: tituloRetiro, slug: `zzagent-ciclo-retiro-${Date.now()}`, published: true },
      ]);
      await base.insertar("jobs", [
        { project_id: pedidoRetiro.id, client_id: cliente.id, painter_id: pintor.id, status: "quoted", amount: 180000, commission_rate: 0.1, commission_amount: 18000, note: marca },
      ]);

      // ── 2. El pintor cotiza ──
      await k.ingresar(page, "pintor3");
      await k.ir(page, "/trabajos");
      t.cierto(await apretar(titulo, "Cotizar este trabajo"), "el pedido recién publicado no aparece en el tablero con su botón de cotizar");
      await page.waitForTimeout(800);
      await page.fill(`article:has-text("${titulo}") input[name=amount]`, "250.000");
      // Sin la marca de tiempo: trece dígitos seguidos son, para el detector de contactos, un
      // teléfono, y la cotización se rechaza (bien). El pedido ya identifica el dato de prueba.
      await page.fill(`article:has-text("${titulo}") textarea[name=note]`, "ZZAGENT dos manos, con materiales");
      await page.click(`article:has-text("${titulo}") form button[type=submit]`);
      const cotizado = await estadoDe(`project_id=eq.${pedido.id}`, "quoted");
      t.cierto(cotizado?.status === "quoted", "la cotización no quedó guardada");
      if (!cotizado) return;
      t.igual([cotizado.amount, cotizado.commission_amount], [250000, 25000], "el monto o la comisión guardados no son los que se cotizaron");

      // ── 2 bis. El pintor retira la OTRA cotización ──
      await k.ir(page, "/dashboard");
      t.cierto(await apretarYConfirmar(tituloRetiro, "Retirar cotización"), "no encontré 'Retirar cotización' en el panel del pintor");
      const retirado = await estadoDe(`project_id=eq.${pedidoRetiro.id}`, "cancelled");
      t.igual(retirado?.status, "cancelled", "retirar la cotización no la dejó cancelada");
      await k.salir(page);

      // ── 3. El cliente acepta ──
      await k.ingresar(page, "cliente2");
      await k.ir(page, "/cotizaciones");
      t.cierto(await apretarYConfirmar(titulo, "Aceptar cotización"), "la cotización no aparece en /cotizaciones con su botón de aceptar");
      const aceptado = await estadoDe(`id=eq.${cotizado.id}`, "accepted");
      t.igual(aceptado?.status, "accepted", "aceptar la cotización no cambió el estado del trabajo");
      const [cerrado] = await base.leer("projects", `id=eq.${pedido.id}`, "published");
      t.igual(cerrado?.published, false, "el pedido siguió publicado en el tablero después de adjudicarse");
      await k.salir(page);

      // ── 4. El pintor completa ──
      await k.ingresar(page, "pintor3");
      await k.ir(page, "/dashboard");
      t.contiene(await page.evaluate(() => document.querySelector("main").innerText), "Comisión 10", "el panel del pintor no muestra la comisión del trabajo");
      t.cierto(await apretarYConfirmar(titulo, "Marcar completado"), "el trabajo aceptado no aparece en el panel del pintor con 'Marcar completado'");
      const completado = await estadoDe(`id=eq.${cotizado.id}`, "completed");
      t.igual(completado?.status, "completed", "marcar completado no cambió el estado del trabajo");
      await k.salir(page);

      // ── 5. El cliente deja su reseña ──
      await k.ingresar(page, "cliente2");
      await k.ir(page, "/cliente");
      t.cierto(await apretar(titulo, "Calificar a"), "el trabajo terminado no ofrece 'Calificar' en el panel del cliente");
      await page.waitForSelector("textarea[name=comment]", { timeout: 10000 });
      await page.click('button[aria-label="4 estrellas"]');
      await page.fill("textarea[name=comment]", `${marca} prolijo y a tiempo`);
      await page.click("button:has-text('Publicar reseña')");
      let resena = null;
      for (let i = 0; i < 30 && !resena; i++) {
        [resena] = await base.leer("reviews", `job_id=eq.${cotizado.id}`, "id,rating,target_id");
        if (!resena) await page.waitForTimeout(500);
      }
      t.cierto(!!resena, "la reseña no quedó guardada");
      if (resena) {
        t.igual([resena.rating, resena.target_id], [4, pintor.id], "la reseña quedó con otra nota o para otro pintor");
        const [con] = await base.leer("profiles", `id=eq.${pintor.id}`, "rating_count");
        t.igual(con.rating_count, pintor.rating_count + 1, "la reseña nueva no se sumó al contador del pintor");
      }
    } finally {
      await browser.close();
      // Orden: reseñas → trabajos → pedidos (las claves foráneas).
      const pedidos = await base.leer("projects", `title=like.${encodeURIComponent(`${marca}%`)}`, "id").catch(() => []);
      for (const p of pedidos) {
        const trabajos = await base.leer("jobs", `project_id=eq.${p.id}`, "id").catch(() => []);
        for (const j of trabajos) await base.borrar("reviews", `job_id=eq.${j.id}`).catch(() => {});
        await base.borrar("jobs", `project_id=eq.${p.id}`).catch(() => {});
        await base.borrar("projects", `id=eq.${p.id}`).catch(() => {});
      }
      if (pintor) {
        const [despues] = await base.leer("profiles", `id=eq.${pintor.id}`, "rating,rating_count").catch(() => [null]);
        if (despues) {
          t.igual(
            [Number(despues.rating), despues.rating_count],
            [Number(pintor.rating), pintor.rating_count],
            "después de limpiar, el promedio del pintor demo no volvió a lo que era",
          );
        }
      }
    }
  },
};
