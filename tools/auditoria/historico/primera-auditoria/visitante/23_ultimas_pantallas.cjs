const k = require("/workspaces/codespaces-blank/.auditoria/kit/navegador.cjs");
const DIR = "/workspaces/codespaces-blank/.auditoria/kit/visitante/";
(async () => {
  const { browser, page } = await k.abrir({ movil: true });
  try {
    for (const [n, r] of [["ingresar","/ingresar"],["crear_cuenta","/crear-cuenta"],["recuperar","/recuperar"],["nosotros","/nosotros"]]) {
      await k.ir(page, r);
      await page.waitForTimeout(400);
      await page.screenshot({ path: DIR + "m_" + n + ".png", fullPage: true });
    }
    // Probar cierre del menú hamburguesa
    await k.ir(page, "/");
    await page.waitForTimeout(400);
    const boton = await page.$('button[aria-label*="menu" i], button[aria-label*="menú" i], [aria-label*="Abrir" i]');
    await boton.click();
    await page.waitForTimeout(300);
    const abiertoAntes = await page.evaluate(() => document.body.innerText.includes("Cotizar mi obra"));
    // Buscar boton de cerrar (X) o volver a tocar el hamburguesa
    const botonCerrar = await page.$('button[aria-label*="cerrar" i], button[aria-label*="close" i]');
    if (botonCerrar) {
      await botonCerrar.click();
    } else {
      await boton.click();
    }
    await page.waitForTimeout(400);
    const scrollBloqueado = await page.evaluate(() => getComputedStyle(document.body).overflow);
    const menuVisible = await page.evaluate(() => {
      const nav = document.querySelector('[role="dialog"], nav');
      return document.body.innerText.includes("Cotizar mi obra") ;
    });
    console.log({ abiertoAntes, tieneBotonCerrarExplicito: !!botonCerrar, scrollBodyOverflowTrasIntentoCierre: scrollBloqueado });
    await page.screenshot({ path: DIR + "m_menu_tras_cerrar.png" });

    // click en Escape como alternativa
    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);
    await page.screenshot({ path: DIR + "m_menu_tras_escape.png" });
  } finally {
    await browser.close();
  }
})();
