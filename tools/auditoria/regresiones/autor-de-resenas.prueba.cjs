/**
 * Vigila QUIÉN ve el nombre del autor de una reseña.
 *
 * La regla (migración 0013 y /privacidad): quien tiene cuenta ve el nombre de quien escribió
 * cada reseña; un visitante sin cuenta, no — ve "Cliente". El formulario de reseña lo promete
 * ("queda en el perfil del pintor, con tu nombre").
 *
 * Lo que se rompió (29/9): las páginas públicas pasaron a leer de una caché que consulta la
 * base como visitante anónimo, y desde ese momento NADIE veía nombres, ni siquiera la autora
 * de una reseña recién escrita. Lo encontró `recorrido-web` (cliente). El arreglo completa los
 * nombres con los permisos de quien mira (`conNombresDeAutores`).
 *
 * También vigila lo contrario: que el visitante anónimo no reciba el nombre, ni el id del
 * autor escondido en los datos de la página.
 *
 * Sólo lee: usa el perfil de `pintor` (Martín Rojas), que tiene reseñas del seed.
 */
module.exports = {
  nombre: "reseñas · el nombre del autor lo ve quien tiene cuenta, no el anónimo",

  async correr(t, { k, base }) {
    if (!base) {
      t.cierto(false, "hace falta la clave de servicio (apps/web/.env.local) para saber los autores");
      return;
    }
    const [pintor] = await base.leer("profiles", "full_name=eq.Mart%C3%ADn%20Rojas&type=eq.painter", "id");
    t.cierto(!!pintor, "no encontré a Martín Rojas");
    if (!pintor) return;
    const resenas = await base.leer("reviews", `target_id=eq.${pintor.id}&author_id=not.is.null&order=created_at.desc&limit=30`, "author_id");
    const autorIds = [...new Set(resenas.map((r) => r.author_id))];
    const autores = autorIds.length
      ? await base.leer("profiles", `id=in.(${autorIds.join(",")})`, "id,full_name")
      : [];
    const nombres = autores.map((a) => a.full_name).filter(Boolean);
    t.cierto(nombres.length > 0, "el perfil de Martín no tiene reseñas con autor: la prueba no mide nada");
    if (!nombres.length) return;

    const { browser, page } = await k.abrir({ movil: false });
    try {
      // Sin cuenta: "Cliente", ningún nombre y ningún id de autor en todo el HTML.
      const anon = await (await page.request.get(`${k.BASE}/pintor/${pintor.id}`)).text();
      t.cierto(/Cliente/.test(anon), "sin cuenta, las reseñas deberían firmar como \"Cliente\"");
      for (const n of nombres) t.cierto(!anon.includes(n), `sin cuenta se ve el nombre de un cliente (${n}): 0013 dice que no`);
      for (const id of autorIds) t.cierto(!anon.includes(id), "el id del autor de una reseña llega al navegador de un visitante anónimo");

      // Con cuenta: aparece al menos uno de los nombres.
      await k.ingresar(page, "cliente2");
      await k.ir(page, `/pintor/${pintor.id}`);
      const conCuenta = await page.evaluate(() => document.querySelector("main").innerText);
      t.cierto(
        nombres.some((n) => conCuenta.includes(n)),
        "con sesión, las reseñas siguen firmando como \"Cliente\": se perdió el nombre que promete /privacidad",
      );
    } finally {
      await browser.close();
    }
  },
};
