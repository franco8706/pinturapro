/**
 * Vigila que guardar el perfil avise que se guardó.
 *
 * Lo que se rompió (20/9, BITÁCORA "Corregido, sin prueba todavía"): `updateProfile` guardaba
 * y hacía `redirect("/dashboard")` en silencio. La persona volvía a su panel sin ningún indicio
 * de si el cambio había entrado —el único rastro era el botón diciendo "Guardando…" un
 * instante— y en la duda, muchas veces volvía a guardar. El arreglo agrega
 * `?guardado=perfil` a la redirección y un cartel en `/dashboard` que lo lee.
 *
 * La prueba no cambia ningún dato real del perfil: reenvía el formulario con los mismos
 * valores que ya tenía (un guardado sin cambios es el camino más común: alguien entra sólo
 * para mirar y aprieta guardar de cualquier forma) y comprueba que el cartel aparezca.
 */
module.exports = {
  nombre: "perfil · guardar avisa que se guardó",

  async correr(t, { k }) {
    const { browser, page } = await k.abrir({ movil: false });
    try {
      await k.ingresar(page, "pintor3");
      await k.ir(page, "/dashboard/perfil");

      const antes = await page.evaluate(() => ({
        full_name: document.querySelector('input[name=full_name]')?.value,
        bio: document.querySelector('textarea[name=bio]')?.value,
      }));
      t.cierto(!!antes.full_name, "no encontré el campo de nombre en /dashboard/perfil");
      if (!antes.full_name) return;

      // Reenvía el formulario tal cual está: ningún campo se toca.
      // OJO: la página de salida es justo `/dashboard/perfil`, así que el patrón de llegada
      // tiene que exigir la RAÍZ exacta — `/\/dashboard\b/` matchea también la URL de partida
      // (el límite de palabra cae entre "dashboard" y la próxima "/") y la espera se resuelve
      // antes de que el envío siquiera salga.
      await Promise.all([
        page.waitForURL((u) => /^\/dashboard\/?$/.test(u.pathname), { timeout: 20000 }),
        page.evaluate(() => document.querySelector('input[name=full_name]').closest("form").requestSubmit()),
      ]);

      const urlFinal = new URL(page.url());
      t.igual(urlFinal.searchParams.get("guardado"), "perfil", `guardar no volvió con "?guardado=perfil" (fue a ${page.url()})`);
      t.contiene(
        await page.evaluate(() => document.body.innerText),
        "Listo, guardamos los cambios de tu perfil",
        "falta el aviso de que el perfil se guardó",
      );

      // El reenvío no debió cambiar nada: los mismos valores siguen ahí.
      await k.ir(page, "/dashboard/perfil");
      const despues = await page.evaluate(() => ({
        full_name: document.querySelector('input[name=full_name]')?.value,
        bio: document.querySelector('textarea[name=bio]')?.value,
      }));
      t.igual(despues, antes, "reenviar el formulario sin tocar nada cambió los datos del perfil");
    } finally {
      await browser.close();
    }
  },
};
