/**
 * Vigila que no se pueda cambiar la contraseña con una sesión que sólo quedó abierta.
 *
 * /nueva-contrasena aceptaba CUALQUIER sesión. Alguien frente a una computadora donde la
 * cuenta quedó iniciada podía fijar una contraseña nueva sin saber la actual ni tener el mail,
 * y quedarse con la cuenta para siempre. Lo midió el agente `sesiones-y-acceso`.
 *
 * Ahora, si la sesión no viene del enlace de recuperación (Supabase anota `amr: otp` en el
 * token; medido), se pide la contraseña actual. La prueba NO cambia ninguna contraseña: sólo
 * mira qué pide la pantalla con una sesión común.
 */
module.exports = {
  nombre: "contraseña · con una sesión común, cambiarla pide la contraseña actual",

  async correr(t, { k }) {
    const { browser, page } = await k.abrir({});
    try {
      await k.ingresar(page, "cliente3");
      await k.ir(page, "/nueva-contrasena");
      await page.waitForFunction(() => !/Verificando|Cargando/i.test(document.body.innerText), { timeout: 20000 }).catch(() => {});
      const campos = await page.evaluate(() =>
        [...document.querySelectorAll("label")].map((l) => (l.textContent || "").trim()),
      );
      t.cierto(
        campos.some((c) => /Contraseña actual/i.test(c)),
        `con una sesión común la pantalla no pide la contraseña actual (campos: ${campos.join(", ")})`,
      );
    } finally {
      await browser.close();
    }
  },
};
