const k = require("/workspaces/codespaces-blank/.auditoria/kit/navegador.cjs");

const PAGINAS = [
  "/", "/obras",
  "/obras/casa-barracas", "/obras/loft-palermo", "/obras/estudio-nordelta",
  "/pintores",
  "/pintor/225f594d-00e1-420e-b392-af2a15bd1f9d",
  "/pintor/5e1a6016-3712-446c-b4d9-f0c8a75133ed",
  "/mapa", "/simulador", "/colores", "/cotizar", "/aprender", "/novedades",
  "/asesoramiento", "/nosotros", "/contacto", "/registro", "/trabajos",
  "/privacidad", "/terminos", "/ingresar", "/crear-cuenta", "/recuperar",
];

const PROTEGIDAS = ["/dashboard", "/cliente", "/admin", "/panel", "/publicar", "/cotizaciones"];

const movil = process.argv[2] === "movil";

(async () => {
  const { browser, page, eventos } = await k.abrir({ movil });
  const salida = { movil, paginas: [], protegidas: [] };
  try {
    for (const ruta of PAGINAS) {
      k.limpiarEventos(eventos);
      let status = null;
      try {
        status = await k.ir(page, ruta);
      } catch (e) {
        salida.paginas.push({ ruta, status: "ERROR_NAV", error: String(e).slice(0, 200) });
        continue;
      }
      const auditoria = await k.auditar(page, eventos);
      salida.paginas.push({ ruta, status, auditoria });
    }

    for (const ruta of PROTEGIDAS) {
      k.limpiarEventos(eventos);
      let status = null;
      try {
        status = await k.ir(page, ruta);
      } catch (e) {
        salida.protegidas.push({ ruta, status: "ERROR_NAV", error: String(e).slice(0, 200) });
        continue;
      }
      const urlFinal = page.url();
      const auditoria = await k.auditar(page, eventos);
      salida.protegidas.push({ ruta, status, urlFinal, auditoria });
    }
  } finally {
    await browser.close();
  }
  console.log(JSON.stringify(salida, null, 2));
})();
