/**
 * Lo que la base cuida de un trabajo, probado como lo haría cualquiera con un `curl`: con la
 * sesión de un cliente y de un pintor de verdad, sin pasar por la web (migración 0027).
 *
 * Los huecos que encontró la revisión del 6/10/2026 (no costaban plata, pero sí confianza):
 *   H1  el pintor cambiaba el monto de una cotización ya enviada con un PATCH, y el cliente
 *       aceptaba un precio que nunca vio (la web acepta por id, sin comparar el monto);
 *   H5  aceptar, ver el teléfono del otro y cancelar no dejaba rastro de quién ni cuándo;
 *   H8  un pedido ya adjudicado se podía borrar;
 *   H10 el cliente podía borrar al pintor de su trabajo (y con él, quién era el deudor), y el
 *       pintor al cliente (que perdía el registro y la posibilidad de reseñar).
 */
const { PASS, CUENTAS } = require("../navegador.cjs");

module.exports = {
  nombre: "trabajos por la API · lo enviado no se edita, las partes no se borran, queda el rastro",
  necesitaBase: true,

  async correr(t, { base }) {
    try {
      await base.leer("jobs", "limit=1", "aceptado_en");
    } catch {
      t.nota("la base no tiene la migración 0027 (rastro de los trabajos): se saltea");
      return;
    }
    const marca = `zzagent-trabajos-api-${Date.now()}`;
    const cliente = await base.comoUsuario(CUENTAS.cliente2, PASS);
    const pintor = await base.comoUsuario(CUENTAS.pintor3, PASS);
    const pintor2 = await base.comoUsuario(CUENTAS.pintor2, PASS);
    let pedido = null;
    // Los pintores demo cotizan durante el lanzamiento; si ya terminó, el corredor les da un
    // acceso manual de 3 horas (correr.cjs). Igual se asegura acá, por si se corre suelta.
    const accesos = await base.insertar("suscripciones", [pintor.id, pintor2.id].map((id) => ({
      pintor_id: id, proveedor: "manual", estado: "activa", acceso_hasta: new Date(Date.now() + 3600e3).toISOString(), nota: `ZZAGENT ${marca}`,
    })));
    try {
      [pedido] = await base.insertar("projects", [
        { owner_id: cliente.id, type: "service", title: "ZZAGENT pedido para probar por la API", slug: marca, published: true },
      ]);
      const cotizar = (quien, monto) =>
        quien.insertar("jobs", { project_id: pedido.id, client_id: cliente.id, painter_id: quien.id, status: "quoted", amount: monto, note: "ZZAGENT dos manos" });
      const a = await cotizar(pintor, 250000);
      const b = await cotizar(pintor2, 300000);
      t.igual([a.status, b.status], [201, 201], `los pintores no pudieron cotizar: ${JSON.stringify([a.cuerpo, b.cuerpo]).slice(0, 200)}`);
      const jobA = a.cuerpo?.[0]?.id;
      const jobB = b.cuerpo?.[0]?.id;
      if (!jobA || !jobB) return;

      // ── H1: lo enviado no se edita ──
      const monto = await pintor.actualizar("jobs", `id=eq.${jobA}`, { amount: 1500 });
      t.cierto(monto.status >= 400, `el pintor cambió el monto de una cotización enviada (HTTP ${monto.status})`);
      const nota = await pintor.actualizar("jobs", `id=eq.${jobA}`, { note: "llamame al 1144445555" });
      t.cierto(nota.status >= 400, `el pintor reescribió la nota después de enviarla (HTTP ${nota.status})`);
      const [tras] = await base.leer("jobs", `id=eq.${jobA}`, "amount,note");
      t.igual([tras?.amount, tras?.note], [250000, "ZZAGENT dos manos"], "la cotización enviada cambió");

      // ── H10: nadie borra a la otra parte ──
      const sinPintor = await cliente.actualizar("jobs", `id=eq.${jobA}`, { painter_id: null });
      t.cierto(sinPintor.status >= 400, `el cliente borró al pintor del trabajo (HTTP ${sinPintor.status})`);
      const sinCliente = await pintor.actualizar("jobs", `id=eq.${jobA}`, { client_id: null });
      t.cierto(sinCliente.status >= 400, `el pintor borró al cliente del trabajo (HTTP ${sinCliente.status})`);
      // Lo que cuenta es cómo quedó la fila: un PATCH que no toca ninguna fila también da 200.
      const [partes] = await base.leer("jobs", `id=eq.${jobA}`, "client_id,painter_id");
      t.igual([partes?.client_id, partes?.painter_id], [cliente.id, pintor.id], "las partes del trabajo cambiaron");

      // ── H5: aceptar y cancelar dejan rastro, y las perdedoras las cancela el sistema ──
      const acepta = await cliente.actualizar("jobs", `id=eq.${jobA}`, { status: "accepted" });
      t.igual(acepta.status, 200, `el cliente no pudo aceptar: ${JSON.stringify(acepta.cuerpo).slice(0, 160)}`);
      const [aceptado] = await base.leer("jobs", `id=eq.${jobA}`, "status,aceptado_en");
      t.cierto(aceptado?.status === "accepted" && !!aceptado?.aceptado_en, "aceptar no dejó la fecha");
      const [perdedora] = await base.leer("jobs", `id=eq.${jobB}`, "status,cancelado_por");
      t.igual([perdedora?.status, perdedora?.cancelado_por], ["cancelled", "sistema"], "la cotización perdedora no quedó cancelada por el sistema");

      // ── H8: el pedido adjudicado no se borra ──
      await cliente.borrar("projects", `id=eq.${pedido.id}`);
      t.igual(await base.contar("projects", `id=eq.${pedido.id}`), 1, "el cliente borró un pedido ya adjudicado");

      // Cancelar después de aceptar: queda quién y cuándo, y no se puede pisar.
      const cancela = await cliente.actualizar("jobs", `id=eq.${jobA}`, { status: "cancelled" });
      t.igual(cancela.status, 200, `el cliente no pudo cancelar: ${JSON.stringify(cancela.cuerpo).slice(0, 160)}`);
      await cliente.actualizar("jobs", `id=eq.${jobA}`, { cancelado_por: "pintor" });
      const [cancelado] = await base.leer("jobs", `id=eq.${jobA}`, "status,aceptado_en,cancelado_en,cancelado_por");
      t.igual(
        [cancelado?.status, cancelado?.cancelado_por, !!cancelado?.aceptado_en, !!cancelado?.cancelado_en],
        ["cancelled", "cliente", true, true],
        "cancelar después de aceptar no dejó (o dejó pisar) el rastro",
      );
    } finally {
      if (pedido) {
        await base.borrar("jobs", `project_id=eq.${pedido.id}`).catch(() => {});
        await base.borrar("projects", `id=eq.${pedido.id}`).catch(() => {});
      }
      for (const s of accesos ?? []) await base.borrar("suscripciones", `id=eq.${s.id}`).catch(() => {});
    }
  },
};
