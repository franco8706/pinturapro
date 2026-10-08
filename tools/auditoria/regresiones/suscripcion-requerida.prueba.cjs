/**
 * Un pintor sin suscripción NO cotiza: ni por la pantalla, ni hablándole directo a la API.
 *
 * Desde el 6/10/2026 la plataforma no cobra comisión: el pintor paga una suscripción mensual
 * (US$5 en pesos al dólar del día) y la base no deja cotizar a quien no tiene acceso
 * (`puede_cotizar()` en la policy de cotizar, migración 0027). La barrera es la base: la clave
 * anon viaja en el navegador y en el teléfono, así que lo que importa es qué pasa con un
 * `POST /rest/v1/jobs` hecho con la sesión del propio pintor, no qué muestra la pantalla.
 *
 * El pintor es una cuenta descartable (ZZAGENT), sin la inscripción al lanzamiento: así la
 * prueba corre cualquier día, sin tocar la fecha global del lanzamiento ni las cuentas demo.
 * La contraprueba (con un acceso manual, la MISMA cotización entra) asegura que lo que frena es
 * la suscripción y no otra cosa —un frenado por cualquier motivo pasaba por bueno en los
 * ensayos de 0024, que rompía todas las cotizaciones—.
 */
module.exports = {
  nombre: "suscripción · sin acceso no se cotiza (por la API ni por la pantalla)",
  necesitaBase: true,

  async correr(t, { k, base }) {
    // La base todavía sin la 0027: no hay suscripción que probar.
    try {
      await base.leer("ajustes_de_cobro", "id=eq.true", "id");
    } catch {
      t.nota("la base no tiene la migración 0027 (suscripción): se saltea");
      return;
    }

    const marca = `zzagent-suscripcion-${Date.now()}`;
    const email = `${marca}@pinturapro.demo`;
    const password = `Zz-${Math.random().toString(36).slice(2)}-Aa9`;
    const [cliente] = await base.leer("profiles", "full_name=eq.Javier%20M%C3%A9ndez", "id");
    const [otroPintor] = await base.leer("profiles", "full_name=eq.Diego%20Sosa", "id");
    let pintor = null;
    let pedido = null;

    const { browser, page } = await k.abrir({ movil: false });
    try {
      pintor = await base.crearUsuario({ email, password, full_name: "ZZAGENT Pintor sin plan", type: "painter" });
      // Todo pintor nuevo entra al lanzamiento (`inscribir_al_lanzamiento`)...
      const inscripcion = await base.leer("suscripciones", `pintor_id=eq.${pintor.id}&proveedor=eq.lanzamiento`, "estado");
      t.igual(inscripcion.length, 1, "un pintor nuevo no quedó inscripto al lanzamiento");
      // ...y se le saca, para tener un pintor sin ningún acceso.
      await base.borrar("suscripciones", `pintor_id=eq.${pintor.id}`);
      [pedido] = await base.insertar("projects", [
        { owner_id: cliente.id, type: "service", title: "ZZAGENT pedido para el pintor sin plan", slug: marca, published: true },
      ]);
      const cotizacion = { project_id: pedido.id, client_id: cliente.id, painter_id: pintor.id, status: "quoted", amount: 250000 };

      // ── 1. Por la API, con su propia sesión (lo frena el trigger `exigir_suscripcion`) ──
      const yo = await base.comoUsuario(email, password);
      const intento = await yo.insertar("jobs", cotizacion);
      t.cierto(intento.status >= 400, `un pintor sin suscripción cotizó por la API (HTTP ${intento.status})`);
      t.cierto(
        /suscripci/i.test(JSON.stringify(intento.cuerpo)),
        `lo frenó, pero no por la suscripción: ${JSON.stringify(intento.cuerpo).slice(0, 160)}`,
      );
      t.igual(await base.contar("jobs", `project_id=eq.${pedido.id}`), 0, "quedó una cotización guardada");

      // Las cuentas del cobro son del admin (`metricas_suscripciones`): una cuenta común no ve
      // cuántos pagan ni cuánto entra. Que el admin sí las ve lo mira extracto-transferencias.
      const metricas = await yo.rpc("metricas_suscripciones");
      t.igual(Array.isArray(metricas.cuerpo) ? metricas.cuerpo.length : 0, 0, "una cuenta común ve las métricas de la suscripción");

      // No se puede fabricar el acceso.
      const falsa = await yo.insertar("suscripciones", { pintor_id: pintor.id, proveedor: "manual", estado: "activa", acceso_hasta: "2099-01-01" });
      t.cierto(falsa.status === 401 || falsa.status === 403, `un pintor se insertó una suscripción hasta 2099 (HTTP ${falsa.status})`);
      const pago = await yo.insertar("pagos_suscripcion", {
        pintor_id: pintor.id, proveedor: "transferencia", tipo: "cobro", proveedor_evento_id: marca, monto_ars: 7700, fecha: new Date().toISOString(),
      });
      t.cierto(pago.status === 401 || pago.status === 403, `un pintor se anotó un pago (HTTP ${pago.status})`);
      // Ni averiguar si otro pintor paga: la función contesta sobre quien pregunta.
      const espia = await yo.rpc("puede_cotizar", { uid: otroPintor.id });
      t.igual(espia.cuerpo, false, "preguntar por otro pintor revela si tiene acceso");

      // ── 2. Por la pantalla: el motivo y el camino, no un formulario que va a rebotar ──
      await k.ingresar(page, { email, password });
      await k.ir(page, "/trabajos");
      const tarjeta = page.locator("article", { hasText: "ZZAGENT pedido para el pintor sin plan" });
      if ((await tarjeta.count()) === 0) {
        t.nota("el pedido de prueba no apareció en /trabajos (¿caché de 60 s?): no se mira la pantalla");
      } else {
        const texto = await tarjeta.first().innerText();
        t.cierto(/suscripción activa/i.test(texto), `la tarjeta no explica que falta la suscripción: "${texto.slice(0, 160)}"`);
        t.igual(await tarjeta.first().locator("button:has-text('Cotizar este trabajo')").count(), 0, "a un pintor sin acceso se le ofrece el formulario de cotizar");
        t.cierto((await tarjeta.first().locator("a[href='/dashboard/plan']").count()) === 1, "la tarjeta no lleva a Mi plan");
      }
      await k.salir(page);

      // ── 3. Contraprueba: con acceso, la MISMA cotización entra ──
      await base.insertar("suscripciones", [
        { pintor_id: pintor.id, proveedor: "manual", estado: "activa", acceso_hasta: new Date(Date.now() + 3600e3).toISOString(), nota: "ZZAGENT contraprueba" },
      ]);
      const conAcceso = await yo.insertar("jobs", cotizacion);
      t.igual(conAcceso.status, 201, `con acceso, la cotización no entró: ${JSON.stringify(conAcceso.cuerpo).slice(0, 160)}`);
      const [guardada] = await base.leer("jobs", `project_id=eq.${pedido.id}`, "amount,commission_amount");
      t.igual(guardada?.commission_amount ?? null, null, "se guardó una comisión: la plataforma ya no cobra comisión");
    } finally {
      await browser.close();
      if (pedido) {
        await base.borrar("jobs", `project_id=eq.${pedido.id}`).catch(() => {});
        await base.borrar("projects", `id=eq.${pedido.id}`).catch(() => {});
      }
      if (pintor) {
        await base.borrar("suscripciones", `pintor_id=eq.${pintor.id}`).catch(() => {});
        await base.borrarUsuario(pintor.id).catch(() => {});
      }
    }
  },
};
