/**
 * El dólar de la suscripción: la tarea lo lee, lo controla y sólo usa lo que tiene sentido.
 *
 * Decisión del dueño (6/10/2026): "todos cobran 5 dólares; hay que monitorear el dólar a la hora
 * de cobrar". Cloud Scheduler llama a POST /api/cotizacion/actualizar 3 veces por día hábil con
 * su token; la tarea lee el oficial del Banco Nación (venta) y lo controla con el BCRA. Se toca
 * plata, así que ante la duda NO se usa:
 *   · un salto de más del 10 % queda "a confirmar" y se sigue usando el anterior;
 *   · si las dos fuentes difieren más del 5 %, se descarta;
 *   · si la fuente se cae, no se guarda nada y se sigue con el último valor bueno;
 *   · sin el token, 401.
 *
 * No depende del dólar real: la prueba levanta un servidor propio que hace de las dos fuentes, y
 * la web lo usa porque `COTIZACION_FUENTE_URL` y `COTIZACION_CONTROL_URL` apuntan a él (los pone
 * `tools/auditoria/base-local/levantar.sh` en web.env). Contra otra configuración se saltea.
 */
const http = require("http");

const PUERTO = 54399;
const TOKEN = process.env.COTIZACION_TOKEN || "";

module.exports = {
  nombre: "suscripción · el dólar se lee, se controla y un salto no se usa solo",
  necesitaBase: true,

  async correr(t, { k, base }) {
    try {
      await base.leer("cotizaciones_dolar", "limit=1", "id");
    } catch {
      t.nota("la base no tiene la migración 0027: se saltea");
      return;
    }
    const ruta = `${k.BASE}/api/cotizacion/actualizar`;

    // Sin token: 401 (o 503 si el servidor no tiene token configurado). Nunca 200.
    const sinToken = await fetch(ruta, { method: "POST" });
    t.cierto(sinToken.status === 401 || sinToken.status === 503, `la tarea del dólar respondió ${sinToken.status} sin token`);
    const mal = await fetch(ruta, { method: "POST", headers: { Authorization: "Bearer otro" } });
    t.cierto(mal.status === 401 || mal.status === 503, `con un token equivocado respondió ${mal.status}`);
    if (!TOKEN || !process.env.COTIZACION_FUENTE_URL?.includes(`:${PUERTO}`)) {
      t.nota("sin COTIZACION_TOKEN / fuentes de prueba en el entorno (base-local/web.env): sólo se probó el token");
      return;
    }

    // Las fuentes de mentira: lo que respondan lo decide la prueba.
    let bna = { compra: 1490, venta: 1540 };
    let bcra = 1520;
    let caida = false;
    const servidor = http.createServer((req, res) => {
      if (caida) {
        res.writeHead(500).end("caída");
        return;
      }
      res.writeHead(200, { "Content-Type": "application/json" });
      if (req.url.startsWith("/bna")) res.end(JSON.stringify({ moneda: "USD", casa: "oficial", ...bna }));
      else res.end(JSON.stringify({ status: 200, results: [{ fecha: "2026-10-08", detalle: [{ codigoMoneda: "USD", tipoCotizacion: bcra }] }] }));
    });
    await new Promise((r) => servidor.listen(PUERTO, "127.0.0.1", r));
    const desde = new Date().toISOString();
    const correr = async () => {
      const r = await fetch(ruta, { method: "POST", headers: { Authorization: `Bearer ${TOKEN}` } });
      return { status: r.status, cuerpo: await r.json().catch(() => null) };
    };
    const vigente = async () => (await base.rpc("cotizacion_vigente"))?.[0]?.venta ?? null;

    try {
      // 1. Una lectura normal queda vigente, y el precio en pesos sale de ella (US$5 de `planes`).
      let r = await correr();
      t.igual([r.status, r.cuerpo?.estado], [200, "vigente"], `una lectura normal no quedó vigente: ${JSON.stringify(r.cuerpo)}`);
      t.igual(Number(await vigente()), 1540, "la cotización vigente no es la que se leyó");
      t.igual(await base.rpc("precio_ars", { plan: "pintor" }), 7700, "US$5 al 1540 no dan $7.700");
      // La pantalla lo muestra enseguida: la tarea olvida la caché pública del cobro al guardar.
      const tablero = await (await fetch(`${k.BASE}/trabajos`)).text();
      t.cierto(/hoy \$\s?7\.700/.test(tablero), "el aviso de /trabajos no muestra el precio en pesos del día");

      // 2. Un salto de 12 %: a confirmar, y se sigue cobrando con la anterior.
      bna = { compra: 1700, venta: 1725 };
      bcra = 1720;
      r = await correr();
      t.igual(r.cuerpo?.estado, "a_confirmar", `un salto de 12 % no quedó a confirmar: ${JSON.stringify(r.cuerpo)}`);
      t.igual(Number(await vigente()), 1540, "un salto sin confirmar cambió el precio");

      // 3. Las fuentes no coinciden: se descarta.
      bna = { compra: 1500, venta: 1545 };
      bcra = 1300;
      r = await correr();
      t.igual(r.cuerpo?.estado, "descartada", `con las fuentes en desacuerdo no se descartó: ${JSON.stringify(r.cuerpo)}`);
      t.igual(Number(await vigente()), 1540, "una lectura descartada cambió el precio");

      // 4. La fuente se cae: no se guarda nada y el precio sigue.
      caida = true;
      const antes = await base.contar("cotizaciones_dolar", `leida_en=gte.${encodeURIComponent(desde)}`);
      r = await correr();
      t.igual(r.cuerpo?.guardada, false, "con la fuente caída se guardó algo");
      t.igual(await base.contar("cotizaciones_dolar", `leida_en=gte.${encodeURIComponent(desde)}`), antes, "con la fuente caída cambió la tabla");
      t.igual(Number(await vigente()), 1540, "con la fuente caída cambió el precio");

      // 5. El admin confirma el salto desde /admin → Cobro (`confirmarCotizacion`), y recién ahí cambia el precio.
      const { browser, page } = await k.abrir({ movil: false });
      try {
        await k.ingresar(page, "admin");
        await k.ir(page, "/admin");
        await page.click("button:has-text('Cobro')");
        await page.click("button:has-text('Confirmar')");
        await page.click("button:has-text('Sí, usar')");
        // Esperar el resultado en pantalla, no que desaparezca el botón: al apretarlo pasa a
        // "Confirmando…" y cerrar el navegador ahí cortaba la acción antes de llegar al servidor.
        await page
          .waitForFunction(() => /Vigente: \$\s?1\.725/.test(document.body.innerText), { timeout: 30000 })
          .catch(() => {});
      } finally {
        await browser.close();
      }
      t.igual(Number(await vigente()), 1725, "confirmar el salto desde /admin no lo dejó vigente");
      t.igual(await base.rpc("precio_ars", { plan: "pintor" }), 8700, "con el salto confirmado, US$5 al 1725 no dan $8.700");

      // 6. El chequeo de salud dice hace cuánto se leyó (el vigilante avisa a las 48 h).
      const salud = await (await fetch(`${k.BASE}/api/health`)).json();
      t.igual(salud?.cobro?.cotizacionLeidaHaceHoras, 0, `/api/health no informa la cotización recién leída: ${JSON.stringify(salud?.cobro)}`);
    } finally {
      servidor.close();
      await base.borrar("cotizaciones_dolar", `leida_en=gte.${encodeURIComponent(desde)}`).catch(() => {});
    }
  },
};
