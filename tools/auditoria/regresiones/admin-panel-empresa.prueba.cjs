/**
 * Vigila que /admin y /panel se abran sólo con `is_admin`, nunca con el rol "empresa".
 *
 * Lo que se rompió (medido por la sonda `admin.cjs` de la primera auditoría; corregido en el
 * commit `c0235d7`, "gatear /admin y /panel por is_admin, no por el rol de empresa"): el gate
 * de las dos pantallas miraba `profile.type === "company"`. Ese rol lo elige libremente
 * cualquiera en el `<select>` del alta pública — una cerradura con la llave adentro del
 * mismo sobre. Con eso alcanzaba para ver, sin ser quien administra la plataforma, el panel
 * analítico completo (volumen transado, comisión generada mes a mes) y la bandeja de
 * consultas de /admin.
 *
 * El arreglo pasó a `profile.isAdmin` (columna aparte, que nadie elige solo), pero quedó sin
 * ninguna prueba: nada en este directorio volvía a probar una cuenta "empresa" no
 * administradora contra estas dos rutas. Si el gate volviera a mirar `type` en vez de
 * `isAdmin` — por ejemplo al tocar el formulario de alta, donde "empresa" es una opción de
 * rol perfectamente legítima para el marketplace — esto no se notaría hasta que alguien lo
 * mirara a mano.
 *
 * No hay ninguna cuenta demo con `type=company` que además tenga `is_admin=false` (la única
 * "empresa" de la base ES la admin), así que la prueba le presta el rol "empresa" a una
 * cuenta de pintor por un instante con la clave de servicio, mide, y se lo devuelve en el
 * `finally` — tal como pide REGLAS.md para los datos demo que no son propios.
 */
const NOMBRE_PERFIL = "Diego Sosa"; // pintor3: painter, is_admin=false, la cuenta que menos usan las otras pruebas.

module.exports = {
  nombre: "admin y panel · una cuenta 'empresa' sin is_admin no entra",
  necesitaBase: true,

  async correr(t, { k, base }) {
    const filas = await base.leer("profiles", `full_name=eq.${encodeURIComponent(NOMBRE_PERFIL)}`, "id,type,is_admin");
    const perfil = filas[0];
    if (!perfil) {
      t.nota(`no encontré el perfil de "${NOMBRE_PERFIL}"; la prueba no puede correr`);
      return;
    }
    if (perfil.is_admin) {
      t.nota(`"${NOMBRE_PERFIL}" ya es admin en esta base; prestarle el rol de empresa no probaría nada`);
      return;
    }
    const tipoOriginal = perfil.type;

    try {
      // Prestado: durante la prueba esta cuenta es 'company', igual que la que se auto-asigna
      // cualquiera en /crear-cuenta. Se devuelve en el finally pase lo que pase.
      await base.actualizar("profiles", `id=eq.${perfil.id}`, { type: "company" });

      const { browser, page } = await k.abrir({ movil: false });
      try {
        await k.ingresar(page, "pintor3");
        for (const ruta of ["/admin", "/panel"]) {
          await k.ir(page, ruta);
          const info = await page.evaluate(() => ({ url: location.pathname, texto: document.body.innerText }));
          // El destino exacto no importa (hoy `/mi-panel` la reenvía a `/dashboard`, porque
          // "empresa" comparte panel con "pintor"); lo que importa es que NUNCA se quede en
          // la ruta que pidió.
          t.cierto(info.url !== ruta, `una cuenta 'empresa' sin is_admin entró a ${ruta} (terminó en ${info.url})`);
          t.cierto(
            !/Suscripciones: ingreso del mes|Valor de trabajos completados|Consultas y pintores/i.test(info.texto),
            `${ruta} le mostró cifras o consultas del negocio a una cuenta 'empresa' sin is_admin`,
          );
        }
      } finally {
        await browser.close();
      }

      // Lo que el arreglo no debe romper: la cuenta admin de verdad sigue entrando.
      const { browser: browser2, page: page2 } = await k.abrir({ movil: false });
      try {
        await k.ingresar(page2, "admin");
        await k.ir(page2, "/panel");
        const info = await page2.evaluate(() => ({ url: location.pathname, texto: document.body.innerText }));
        t.igual(info.url, "/panel", "la cuenta admin de verdad ya no puede entrar a /panel (el arreglo se pasó de largo)");
        t.contiene(info.texto, "Suscripciones: ingreso del mes", "a la cuenta admin no le aparecen las cifras del negocio en /panel");
      } finally {
        await browser2.close();
      }
    } finally {
      await base.actualizar("profiles", `id=eq.${perfil.id}`, { type: tipoOriginal });
    }
  },
};
