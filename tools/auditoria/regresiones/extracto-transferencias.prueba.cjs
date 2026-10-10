/**
 * La transferencia, de punta a punta: el pintor avisa (`yaTransferi`), el dueño carga el extracto
 * del banco (`cargarExtracto`) y el pago se confirma solo; el mismo extracto dos veces no cobra
 * dos veces; el libro no se borra ni se edita (`libro_solo_agregar`); lo que no alcanza queda
 * para revisar y se confirma a mano (`confirmarTransferencia`); "No llegó"
 * (`rechazarTransferencia`) anula el aviso sin sumar nada; "Devolver" (`devolverPago`) le saca el mes.
 *
 * Y lo que encontraron abuso-marketplace y dinero-y-comisiones el 8/10/2026, cada cosa vista
 * fallar contra el código anterior:
 *  · "Llegó" registraba lo PEDIDO: $6.930 transferidos quedaban como $7.700 en el libro;
 *  · "Llegó" + el mismo dinero en el extracto daban dos meses por un pago;
 *  · un aviso vencido seguía fijando el precio del dólar viejo, y "Mi plan" escondía el botón;
 *  · el pintor leía por la API la línea del extracto, con el saldo de la cuenta del negocio.
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

/** Hoy en Argentina, como lo escribe un extracto: "10/10/2026". */
function hoyAR() {
  const d = new Date(Date.now() - 3 * 3600e3);
  return `${String(d.getUTCDate()).padStart(2, "0")}/${String(d.getUTCMonth() + 1).padStart(2, "0")}/${d.getUTCFullYear()}`;
}

module.exports = {
  nombre: "suscripción · transferencia: aviso, extracto que confirma solo, sin duplicados",
  necesitaBase: true,

  async correr(t, { k, base }) {
    if (!process.env.PINTURAPRO_BASE_LOCAL) {
      t.nota("sólo corre contra la base local (el libro de pagos no se borra): se saltea");
      return;
    }
    try {
      await base.leer("cobros", "limit=1", "id,monto_recibido");
    } catch {
      t.nota("la base no tiene la migración 0027 (con lo recibido): se saltea");
      return;
    }

    const marca = `zzagent-transferencia-${Date.now()}`;
    const email = `${marca}@pinturapro.demo`;
    const password = `Zz-${Math.random().toString(36).slice(2)}-Aa9`;
    const hoy = hoyAR();
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
    const alCobro = async () => {
      await k.ingresar(page, "admin");
      await k.ir(page, "/admin");
      await page.click("button:has-text('Cobro')");
    };
    const cargar = async (ruta) => {
      await alCobro();
      await page.setInputFiles("input[name=extracto]", ruta);
      await page.click("button:has-text('Cargar extracto')");
      await page.waitForFunction(() => /créditos leídos/.test(document.body.innerText), { timeout: 30000 }).catch(() => {});
      const texto = await page.evaluate(() => document.body.innerText.match(/\d+ créditos leídos[^\n]*/)?.[0] ?? "");
      await k.salir(page);
      return texto;
    };
    /** En /admin → Cobro, la primera fila de la cola con el código: "Llegó" (y confirmar) o "No llegó". */
    const resolver = async (codigo, boton) => {
      await alCobro();
      const id = await page.locator("tr[data-cobro]", { hasText: codigo }).first().getAttribute("data-cobro").catch(() => null);
      if (!id) {
        await k.salir(page);
        return null;
      }
      const fila = page.locator(`tr[data-cobro="${id}"]`);
      await fila.locator(`button:text-is('${boton}')`).click(); // text-is: has-text('Llegó') también encuentra "No llegó"
      if (boton === "Llegó") await fila.locator("button:has-text('Sí, registrar')").click();
      for (let i = 0; i < 40 && (await fila.count()); i++) await page.waitForTimeout(500);
      await k.salir(page);
      return id;
    };
    const avisar = async () => {
      await k.ingresar(page, { email, password });
      await k.ir(page, "/dashboard/plan");
      await page.click("button:has-text('Ya transferí')");
      await page.waitForFunction(() => /Esperamos|Listo: esperamos/.test(document.body.innerText), { timeout: 20000 }).catch(() => {});
      await k.salir(page);
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
      await k.salir(page);
      await avisar();
      const [cobro] = await base.leer("cobros", `pintor_id=eq.${pintor.id}&medio=eq.transferencia`, "id,monto_ars,estado,codigo");
      t.igual([cobro?.monto_ars, cobro?.estado, cobro?.codigo], [7700, "pendiente", codigo], "el aviso no dejó un cobro pendiente por el monto del día");
      if (!codigo) return;

      // ── 2. El extracto confirma solo (98 % alcanza: el dólar se movió; el saldo cierra) ──
      const extracto1 = csv([`${hoy};TRANSF RECIBIDA ${codigo} ${marca};;7.547,00;100.000,00`, `${hoy};COMISION MANTENIMIENTO;1.500,00;;98.500,00`]);
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

      // El pintor ve su pago pero no la línea del banco (trae el saldo de la cuenta del negocio).
      const yo = await base.comoUsuario(email, password);
      const linea = await yo.leer("pagos_suscripcion", "limit=1", "linea_extracto");
      const suyo = await yo.leer("pagos_suscripcion", "limit=1", "fecha,monto_ars");
      t.igual([linea.status >= 400, suyo.status, suyo.cuerpo?.length], [true, 200, 1], `el pintor lee la línea del extracto (HTTP ${linea.status}) o no ve su pago (HTTP ${suyo.status})`);

      // ── 4. Un monto que no alcanza queda para revisar, y "Llegó" registra lo que LLEGÓ ──
      await avisar();
      const r3 = await cargar(csv([`${hoy};TRANSF RECIBIDA ${codigo} ${marca} corto;;6.930,00;105.000,00`, `${hoy};IMPUESTO;10,00;;104.990,00`]));
      t.cierto(/1 para revisar/.test(r3), `un 90 % del monto no quedó para revisar: "${r3}"`);
      t.igual(await pagos(), 1, "un monto que no alcanza se registró como pago");
      await alCobro();
      const enCobro = await page.evaluate(() => document.body.innerText);
      // Las métricas le llegan al admin (`metricas_suscripciones`) y cuentan el aviso corto.
      t.cierto(/Transferencias para revisar:\s*[1-9]/.test(enCobro),
        `las métricas del admin no cuentan la transferencia para revisar: "${enCobro.match(/Al día:[^\n]*/)?.[0] ?? "no aparecen"}"`);
      t.cierto(/6\.930/.test(enCobro), "la cola del admin no muestra cuánto llegó");
      await k.salir(page);
      await resolver(codigo, "Llegó");
      t.igual(await pagos(), 2, "confirmar a mano no registró el pago");
      const [ultimoPago] = await base.leer("pagos_suscripcion", `pintor_id=eq.${pintor.id}&order=registrado_en.desc&limit=1`, "monto_ars");
      t.igual(Number(ultimoPago?.monto_ars), 6930, "\"Llegó\" registró lo pedido y no lo que llegó");
      const v2 = await vigente();
      t.cierto(!!v1 && !!v2 && Math.abs(v2.getTime() - v1.getTime() - 30 * DIA) < 3 * DIA,
        `el segundo pago no sumó otro mes desde el vencimiento anterior: ${v1?.toISOString()} → ${v2?.toISOString()}`);
      const vivos = await base.contar("cobros", `pintor_id=eq.${pintor.id}&estado=eq.pendiente`);
      t.igual(vivos, 0, "la revisión confirmada no saldó el aviso del pintor");

      // ── 5. "No llegó": el aviso se anula y no suma nada ──
      await avisar();
      const anulado = await resolver(codigo, "No llegó");
      const [estadoAnulado] = anulado ? await base.leer("cobros", `id=eq.${anulado}`, "estado") : [];
      t.igual(estadoAnulado?.estado, "anulado", "\"No llegó\" no anuló el aviso");
      t.igual(await pagos(), 2, "\"No llegó\" registró un pago");
      t.igual((await vigente())?.toISOString(), v2?.toISOString(), "\"No llegó\" cambió hasta cuándo puede cotizar");

      // ── 6. "Llegó" a mano y después la misma plata en el extracto: no son dos meses ──
      await avisar();
      await resolver(codigo, "Llegó");
      t.igual(await pagos(), 3, "\"Llegó\" sobre un aviso no registró el pago");
      const r6 = await cargar(csv([`${hoy};TRANSF RECIBIDA ${codigo} ${marca} a mano;;7.700,00;200.000,00`, `${hoy};IMPUESTO;10,00;;199.990,00`]));
      t.cierto(/0 confirmadas/.test(r6) && /1 para revisar/.test(r6), `la plata ya confirmada a mano se volvió a confirmar con el extracto: "${r6}"`);
      t.igual(await pagos(), 3, "\"Llegó\" + el extracto registraron dos pagos por una transferencia");
      const v3 = await vigente();

      // ── 7. Un aviso vencido no fija el precio, y "Mi plan" deja volver a avisar ──
      await avisar();
      const [viejo] = await base.leer("cobros", `pintor_id=eq.${pintor.id}&estado=eq.pendiente`, "id");
      if (viejo) {
        await base.actualizar("cobros", `id=eq.${viejo.id}`, {
          monto_ars: 5000,
          created_at: new Date(Date.now() - 10 * DIA).toISOString(),
          vence_en: new Date(Date.now() - 7 * DIA).toISOString(),
        });
      }
      await k.ingresar(page, { email, password });
      await k.ir(page, "/dashboard/plan");
      const plan = await page.evaluate(() => document.querySelector("#transferencia")?.innerText ?? "");
      t.cierto(!/5\.000/.test(plan) && /Ya transferí/.test(plan), `con el aviso vencido, "Mi plan" sigue esperando el precio viejo: "${plan.slice(-200)}"`);
      await k.salir(page);
      const r7 = await cargar(csv([`${hoy};TRANSF RECIBIDA ${codigo} ${marca} viejo;;4.850,00;300.000,00`, `${hoy};IMPUESTO;10,00;;299.990,00`]));
      t.cierto(/0 confirmadas/.test(r7) && /1 para revisar/.test(r7), `el 97 % del precio de un aviso vencido se confirmó solo: "${r7}"`);
      t.igual(await pagos(), 3, "un aviso vencido fijó el precio de un pago");

      // ── 8. "Devolver" (`devolverPago`): queda en el libro y le saca ese mes ──
      const [ultimo] = await base.leer("pagos_suscripcion", `pintor_id=eq.${pintor.id}&tipo=eq.cobro&order=registrado_en.desc&limit=1`, "id");
      await alCobro();
      const filaPago = page.locator(`tr[data-pago="${ultimo?.id}"]`);
      await filaPago.locator("button:text-is('Devolver')").click();
      await filaPago.locator("button:has-text('Sí, devolví')").click();
      await page.waitForFunction((id) => /Devuelto/.test(document.querySelector(`tr[data-pago="${id}"]`)?.textContent ?? ""), ultimo?.id, { timeout: 20000 }).catch(() => {});
      await k.salir(page);
      t.igual(await base.contar("pagos_suscripcion", `pintor_id=eq.${pintor.id}&tipo=eq.devolucion`), 1, "la devolución no quedó en el libro");
      const v4 = await vigente();
      t.cierto(!!v3 && !!v4 && Math.abs(v3.getTime() - v4.getTime() - 30 * DIA) < 3 * DIA,
        `la devolución no le sacó el mes: ${v3?.toISOString()} → ${v4?.toISOString()}`);
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
