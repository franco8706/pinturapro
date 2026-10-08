/**
 * La transferencia, de punta a punta: el pintor avisa (`yaTransferi`), el dueño carga el extracto
 * del banco (`cargarExtracto`) y el pago se confirma solo; el mismo extracto dos veces no cobra
 * dos veces; el libro no se borra ni se edita (`libro_solo_agregar`); lo que no alcanza queda
 * para revisar y se confirma a mano (`confirmarTransferencia`); "No llegó"
 * (`rechazarTransferencia`) anula el aviso sin sumar nada.
 *
 * Es el medio de pago que no depende de ninguna empresa (decisión del dueño, 6/10/2026: "no
 * quiero quedar supeditado a un solo medio de pago"). La regla que importa: cada pago aprobado
 * suma UN mes, y nada se registra dos veces (el libro de pagos no se edita ni se borra).
 *
 * Sólo contra la BASE LOCAL (tools/auditoria/base-local): el libro de pagos no se puede borrar,
 * ni con la clave de servicio, así que esta prueba no deja pagos de mentira en la base en vivo.
 */
const fs = require("fs");
const os = require("os");
const path = require("path");

module.exports = {
  nombre: "suscripción · transferencia: aviso, extracto que confirma solo, sin duplicados",
  necesitaBase: true,

  async correr(t, { k, base }) {
    if (!process.env.PINTURAPRO_BASE_LOCAL) {
      t.nota("sólo corre contra la base local (el libro de pagos no se borra): se saltea");
      return;
    }
    try {
      await base.leer("cobros", "limit=1", "id");
    } catch {
      t.nota("la base no tiene la migración 0027: se saltea");
      return;
    }

    const marca = `zzagent-transferencia-${Date.now()}`;
    const email = `${marca}@pinturapro.demo`;
    const password = `Zz-${Math.random().toString(36).slice(2)}-Aa9`;
    const [cotizacion] = await base.insertar("cotizaciones_dolar", [{ fuente: "bna", venta: 1540, control: 1520, estado: "vigente", motivo: "ZZAGENT transferencia" }]);
    let pintor = null;
    const archivos = [];
    const csv = (lineas) => {
      const ruta = path.join(os.tmpdir(), `${marca}-${archivos.length}.csv`);
      fs.writeFileSync(ruta, ["Fecha;Concepto;Débito;Crédito;Saldo", ...lineas].join("\n"));
      archivos.push(ruta);
      return ruta;
    };
    const { browser, page } = await k.abrir({ movil: false });
    const cargar = async (ruta) => {
      await k.ingresar(page, "admin");
      await k.ir(page, "/admin");
      await page.click("button:has-text('Cobro')");
      await page.setInputFiles("input[name=extracto]", ruta);
      await page.click("button:has-text('Cargar extracto')");
      await page.waitForFunction(() => /créditos leídos/.test(document.body.innerText), { timeout: 30000 }).catch(() => {});
      const texto = await page.evaluate(() => document.body.innerText.match(/\d+ créditos leídos[^\n]*/)?.[0] ?? "");
      await k.salir(page);
      return texto;
    };
    const pagos = () => base.contar("pagos_suscripcion", `pintor_id=eq.${pintor.id}`);
    const vigente = async () => {
      const filas = await base.leer("suscripciones", `pintor_id=eq.${pintor.id}&proveedor=eq.transferencia`, "vigente_hasta");
      return filas[0]?.vigente_hasta ? new Date(filas[0].vigente_hasta) : null;
    };
    const DIA = 86400e3;

    try {
      pintor = await base.crearUsuario({ email, password, full_name: "ZZAGENT Pintor que transfiere", type: "painter" });
      await base.borrar("suscripciones", `pintor_id=eq.${pintor.id}`);

      // ── 1. El pintor ve los datos y avisa ──
      await k.ingresar(page, { email, password });
      await k.ir(page, "/dashboard/plan");
      const seccion = await page.evaluate(() => document.querySelector("#transferencia")?.innerText ?? "");
      const codigo = seccion.match(/PP-\d{4,}/)?.[0];
      if (!codigo) {
        const todo = await page.evaluate(() => document.querySelector("main")?.innerText ?? document.body.innerText);
        t.cierto(false, `"Mi plan" no muestra el código de transferencia (${page.url()}): "${todo.slice(0, 600).replace(/\n+/g, " | ")}"`);
      }
      t.cierto(/pinturapro\.prueba/.test(seccion) && /7\.700/.test(seccion), "\"Mi plan\" no muestra el alias o el monto del día ($7.700)");
      await page.click("button:has-text('Ya transferí')");
      await page.waitForFunction(() => /Esperamos|Listo: esperamos/.test(document.body.innerText), { timeout: 20000 }).catch(() => {});
      const [cobro] = await base.leer("cobros", `pintor_id=eq.${pintor.id}&medio=eq.transferencia`, "id,monto_ars,estado,codigo");
      t.igual([cobro?.monto_ars, cobro?.estado, cobro?.codigo], [7700, "pendiente", codigo], "el aviso no dejó un cobro pendiente por el monto del día");
      await k.salir(page);
      if (!codigo) return;

      // ── 2. El extracto confirma solo (98 % alcanza: el dólar se movió) ──
      const extracto1 = csv([`08/10/2026;TRANSF RECIBIDA ${codigo} ${marca};;7.547,00;100.000,00`, "08/10/2026;COMISION MANTENIMIENTO;1.500,00;;98.500,00"]);
      const r1 = await cargar(extracto1);
      t.cierto(/1 confirmadas/.test(r1), `el extracto no confirmó la transferencia: "${r1}"`);
      t.igual(await pagos(), 1, "no quedó el pago en el libro");
      const [pagado] = await base.leer("cobros", `id=eq.${cobro.id}`, "estado");
      t.igual(pagado?.estado, "pagado", "el aviso no quedó pagado");
      const v1 = await vigente();
      t.cierto(!!v1 && Math.abs(v1.getTime() - Date.now() - 30 * DIA) < 3 * DIA, `el pago no dio un mes de acceso: vigente hasta ${v1?.toISOString()}`);
      t.igual(await base.rpc("puede_cotizar", { uid: pintor.id }), true, "con el pago confirmado, el pintor sigue sin poder cotizar");

      // ── 3. El mismo extracto otra vez: nada nuevo ──
      const r2 = await cargar(extracto1);
      t.cierto(/1 ya cargadas/.test(r2), `cargar el mismo extracto dos veces no lo reconoció: "${r2}"`);
      t.igual(await pagos(), 1, "el mismo extracto dos veces registró el pago dos veces");

      // El libro no se toca, ni con la clave de servicio: ni borrar ni cambiar el monto.
      const borradas = await base.borrar("pagos_suscripcion", `pintor_id=eq.${pintor.id}`).catch(() => 0);
      const editadas = await base.actualizar("pagos_suscripcion", `pintor_id=eq.${pintor.id}`, { monto_ars: 1 }).catch(() => []);
      const [asiento] = await base.leer("pagos_suscripcion", `pintor_id=eq.${pintor.id}`, "monto_ars");
      t.igual([borradas, editadas.length, Number(asiento?.monto_ars)], [0, 0, 7547], "el libro de pagos se pudo borrar o editar con la clave de servicio");

      // ── 4. Un monto que no alcanza queda para revisar, y se confirma a mano ──
      await k.ingresar(page, { email, password });
      await k.ir(page, "/dashboard/plan");
      await page.click("button:has-text('Ya transferí')");
      await page.waitForFunction(() => /Esperamos|Listo: esperamos/.test(document.body.innerText), { timeout: 20000 }).catch(() => {});
      await k.salir(page);
      const r3 = await cargar(csv([`09/10/2026;TRANSF RECIBIDA ${codigo} ${marca} corto;;6.930,00;105.000,00`]));
      t.cierto(/1 para revisar/.test(r3), `un 90 % del monto no quedó para revisar: "${r3}"`);
      t.igual(await pagos(), 1, "un monto que no alcanza se registró como pago");
      await k.ingresar(page, "admin");
      await k.ir(page, "/admin");
      await page.click("button:has-text('Cobro')");
      // Las métricas le llegan al admin (`metricas_suscripciones`) y cuentan el aviso corto.
      const enCobro = await page.evaluate(() => document.body.innerText);
      t.cierto(/Transferencias para revisar:\s*[1-9]/.test(enCobro),
        `las métricas del admin no cuentan la transferencia para revisar: "${enCobro.match(/Al día:[^\n]*/)?.[0] ?? "no aparecen"}"`);
      const abiertos = await base.leer("cobros", `pintor_id=eq.${pintor.id}&estado=in.(pendiente,a_revisar)`, "estado,monto_ars,created_at");
      t.igual(abiertos.length, 1, `después del extracto corto tendría que quedar un solo aviso abierto: ${JSON.stringify(abiertos)}`);
      const fila = page.locator("tr", { hasText: codigo }).first();
      await fila.locator("button:text-is('Llegó')").click(); // text-is: has-text('Llegó') también encuentra "No llegó"
      await page.waitForFunction((c) => !document.body.innerText.includes(c), codigo, { timeout: 20000 }).catch(() => {});
      await k.salir(page);
      t.igual(await pagos(), 2, "confirmar a mano no registró el pago");
      const v2 = await vigente();
      t.cierto(!!v1 && !!v2 && Math.abs(v2.getTime() - v1.getTime() - 30 * DIA) < 3 * DIA,
        `el segundo pago no sumó otro mes desde el vencimiento anterior: ${v1?.toISOString()} → ${v2?.toISOString()}`);

      // ── 5. "No llegó": el aviso se anula y no suma nada ──
      await k.ingresar(page, { email, password });
      await k.ir(page, "/dashboard/plan");
      await page.click("button:has-text('Ya transferí')");
      await page.waitForFunction(() => /Esperamos|Listo: esperamos/.test(document.body.innerText), { timeout: 20000 }).catch(() => {});
      await k.salir(page);
      await k.ingresar(page, "admin");
      await k.ir(page, "/admin");
      await page.click("button:has-text('Cobro')");
      await page.locator("tr", { hasText: codigo }).first().locator("button:text-is('No llegó')").click();
      await page.waitForFunction((c) => !document.body.innerText.includes(c), codigo, { timeout: 20000 }).catch(() => {});
      await k.salir(page);
      const [ultimo] = await base.leer("cobros", `pintor_id=eq.${pintor.id}&order=created_at.desc&limit=1`, "estado");
      t.igual(ultimo?.estado, "anulado", "\"No llegó\" no anuló el aviso");
      t.igual(await pagos(), 2, "\"No llegó\" registró un pago");
      t.igual((await vigente())?.toISOString(), v2?.toISOString(), "\"No llegó\" cambió hasta cuándo puede cotizar");
    } finally {
      await browser.close();
      for (const f of archivos) fs.rmSync(f, { force: true });
      if (pintor) {
        await base.borrar("cobros", `pintor_id=eq.${pintor.id}`).catch(() => {});
        await base.borrar("suscripciones", `pintor_id=eq.${pintor.id}`).catch(() => {});
        await base.borrar("codigos_de_pago", `pintor_id=eq.${pintor.id}`).catch(() => {});
        await base.borrarUsuario(pintor.id).catch(() => {});
      }
      // El libro la referencia y el libro no se borra: si no se puede borrar, se descarta, para que
      // no quede como el dólar vigente de la base local.
      await base
        .borrar("cotizaciones_dolar", `id=eq.${cotizacion.id}`)
        .catch(() => base.actualizar("cotizaciones_dolar", `id=eq.${cotizacion.id}`, { estado: "descartada" }))
        .catch(() => {});
    }
  },
};
