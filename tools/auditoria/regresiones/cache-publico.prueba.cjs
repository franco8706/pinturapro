/**
 * Vigila que la caché de las páginas públicas no le muestre a nadie un dato viejo después de
 * que el dueño lo cambió.
 *
 * Desde el 29/9 lo que ve cualquiera sin cuenta (el perfil del pintor, el directorio, las
 * obras) se lee de Supabase como mucho una vez por minuto (`lib/cache-publico.ts`): antes cada
 * visita consultaba la base, y a escala eso es la base del plan entero trabajando para
 * devolver siempre lo mismo. El riesgo del cambio es el contrario: que el pintor guarde su
 * perfil y su página pública siga mostrando lo de antes durante un minuto —o que alguien se dé
 * de baja y siga apareciendo—. Las acciones que cambian algo público limpian su parte con
 * `olvidar(...)`. Esta prueba lo mide con el perfil, que es el camino más corto.
 *
 * Además es la primera prueba que abre `/pintor/<id>`, la página pública que más gente puede
 * traer y que hasta el mapa de cobertura del 28/9 no nombraba nadie.
 *
 * Usa `pintor3` y le devuelve la bio EXACTA en el `finally` (REGLAS §3 bis).
 */
module.exports = {
  nombre: "caché pública · un cambio del pintor se ve al instante en su perfil",

  async correr(t, { k, base }) {
    if (!base) {
      t.cierto(false, "hace falta la clave de servicio (apps/web/.env.local) para saber el id del pintor");
      return;
    }
    const { browser, page } = await k.abrir({ movil: false });
    let id = null;
    let bioOriginal = null;

    const perfilPublico = async () => {
      const r = await page.request.get(`${k.BASE}/pintor/${id}`);
      return { estado: r.status(), html: await r.text() };
    };
    async function guardarBio(bio) {
      await k.ir(page, "/dashboard/perfil");
      await page.fill("textarea[name=bio]", bio);
      await Promise.all([
        page.waitForURL((u) => /^\/dashboard\/?$/.test(u.pathname), { timeout: 30000 }),
        page.evaluate(() => document.querySelector("textarea[name=bio]").closest("form").requestSubmit()),
      ]);
    }

    try {
      await k.ingresar(page, "pintor3");
      await k.ir(page, "/dashboard/perfil");
      const nombre = await page.inputValue("input[name=full_name]");
      bioOriginal = await page.inputValue("textarea[name=bio]");
      const filas = await base.leer("profiles", `full_name=eq.${encodeURIComponent(nombre)}&type=eq.painter`, "id,bio");
      t.igual(filas.length, 1, `no encontré un único pintor llamado ${nombre}`);
      if (filas.length !== 1) return;
      id = filas[0].id;

      // 1. La página pública queda en la caché con la bio de siempre.
      const antes = await perfilPublico();
      t.igual(antes.estado, 200, `/pintor/${id} no respondió 200`);

      // 2. El pintor cambia su bio desde el formulario.
      const marca = `ZZAGENT-cache-${Date.now()}`;
      await guardarBio(`${bioOriginal} ${marca}`.trim());

      // 3. El pedido SIGUIENTE ya la muestra. Sin `olvidar`, saldría la bio vieja hasta un
      //    minuto más: se confirmó rompiéndolo (ver BITÁCORA).
      const despues = await perfilPublico();
      t.cierto(
        despues.html.includes(marca),
        "el perfil público siguió mostrando la bio vieja después de guardarla: la caché no se limpió",
      );
    } finally {
      try {
        if (id !== null && bioOriginal !== null) {
          await guardarBio(bioOriginal);
          const [fila] = await base.leer("profiles", `id=eq.${id}`, "bio");
          if ((fila?.bio ?? "") !== bioOriginal) await base.actualizar("profiles", `id=eq.${id}`, { bio: bioOriginal });
        }
      } finally {
        await browser.close();
      }
    }
  },
};
