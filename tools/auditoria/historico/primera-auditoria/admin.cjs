/** ¿Quién puede entrar a /admin y /panel? Sólo la cuenta con is_admin. */
const k = require("/workspaces/codespaces-blank/.auditoria/kit/navegador.cjs");
(async () => {
  const filas = [];
  for (const rol of ["admin", "pintor", "cliente", null]) {
    const { browser, page, eventos } = await k.abrir({ movil: false });
    try {
      if (rol) await k.ingresar(page, rol);
      for (const ruta of ["/admin", "/panel"]) {
        const status = await k.ir(page, ruta);
        const info = await page.evaluate(() => ({
          url: location.pathname,
          h1: (document.querySelector("h1")?.innerText || "").slice(0, 40),
          filtrado: /Ingresos|Comisión|comisión|leads|Leads|Consultas/.test(document.body.innerText),
        }));
        filas.push({ rol: rol ?? "sin cuenta", pide: ruta, status, ...info, js: eventos.jsErrors.length });
        k.limpiarEventos(eventos);
      }
    } catch (e) {
      filas.push({ rol: rol ?? "sin cuenta", error: String(e).slice(0, 120) });
    } finally { await browser.close(); }
  }
  console.log(JSON.stringify(filas, null, 2));
})();
