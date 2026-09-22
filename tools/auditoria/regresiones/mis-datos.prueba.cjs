/**
 * Vigila que cada persona pueda ejercer sola sus derechos sobre sus datos.
 *
 * Antes los dos —ver lo que hay guardado y borrar la cuenta— se atendían por correo: alguien
 * tenía que leerlo y responder dentro de los plazos de la Ley 25.326 (10 días corridos para
 * dar acceso, 5 hábiles para borrar). Ahora hay una pantalla.
 *
 * Esta prueba NO borra ninguna cuenta: comprueba que el camino está, que la descarga trae los
 * datos correctos, y que la confirmación mal escrita NO borra nada. El borrado completo se
 * verificó a mano una vez, con una cuenta descartable: la cuenta, el perfil y el pedido
 * publicado desaparecieron, mientras el trabajo y la reseña del pintor quedaron sin nombre y
 * su reputación no se movió (4,9 sobre 10 reseñas, antes y después).
 */
module.exports = {
  nombre: "mis datos · descargar y dar de baja, sin depender de nadie",

  async correr(t, { k }) {
    // ── Sin sesión no se descarga nada ──
    {
      const { browser, page } = await k.abrir({ movil: false });
      try {
        const r = await page.request.get(`${k.BASE}/api/mis-datos`);
        t.igual(r.status(), 401, "la descarga de datos responde sin sesión");
      } finally {
        await browser.close();
      }
    }

    // ── Con sesión: la pantalla ofrece las dos cosas y la descarga trae lo que corresponde ──
    {
      const { browser, page } = await k.abrir({ movil: false });
      try {
        await k.ingresar(page, "cliente");
        await k.ir(page, "/mi-cuenta");

        const pantalla = await page.evaluate(() => ({
          hayDescarga: !!document.querySelector('a[href="/api/mis-datos"]'),
          hayBorrado: /Eliminar mi cuenta/.test(document.body.innerText),
          // La pantalla tiene que decir qué queda después de la baja: es lo que más se
          // malinterpreta, y si no está escrito la persona cree que se borra todo.
          explicaQueQueda: /reseñas|trabajos/i.test(document.body.innerText),
        }));
        t.cierto(pantalla.hayDescarga, "falta el botón de descargar los datos");
        t.cierto(pantalla.hayBorrado, "falta la opción de eliminar la cuenta");
        t.cierto(pantalla.explicaQueQueda, "no se explica qué queda después de la baja");

        const r = await page.request.get(`${k.BASE}/api/mis-datos`);
        t.igual(r.status(), 200, "la descarga falla con sesión iniciada");
        const cabecera = r.headers()["content-disposition"] ?? "";
        t.contiene(cabecera, "attachment", "el archivo no se descarga, se abre en pantalla");

        const datos = await r.json();
        for (const clave of [
          "cuenta",
          "perfil",
          "obrasYPedidosPublicados",
          "trabajosYCotizaciones",
          "resenasQueEscribiste",
          "resenasQueRecibiste",
          "consultasYFormularios",
        ]) {
          t.cierto(clave in datos, `el archivo no incluye "${clave}"`);
        }
        t.cierto(!!datos.cuenta?.email, "el archivo no trae el email de la cuenta");
        // Lo que NO tiene que estar: la contraseña, ni siquiera cifrada.
        const crudo = JSON.stringify(datos);
        t.cierto(
          !/encrypted_password|password_hash/i.test(crudo),
          "el archivo incluye la contraseña: nunca debería salir de la base",
        );
      } finally {
        await browser.close();
      }
    }

    // ── La confirmación mal escrita no borra nada ──
    {
      const { browser, page } = await k.abrir({ movil: false });
      try {
        await k.ingresar(page, "cliente2");
        await k.ir(page, "/mi-cuenta");
        await page.fill('input[type=text]', "si");
        await page.evaluate(() =>
          document.querySelector('input[type=text]').closest("form").querySelector('button[type=submit]').click(),
        );
        await page.waitForTimeout(2500);

        const hayError = await page.evaluate(() => !!document.querySelector('[role="alert"]'));
        t.cierto(hayError, "escribir cualquier cosa en la confirmación no dio ningún error");

        // Y la cuenta tiene que seguir existiendo: si se hubiera borrado, esta navegación
        // terminaría en /ingresar.
        await k.ir(page, "/mi-cuenta");
        t.igual(
          await page.evaluate(() => location.pathname),
          "/mi-cuenta",
          "la cuenta se borró con una confirmación mal escrita",
        );
      } finally {
        await browser.close();
      }
    }
  },
};
