const k = require("/workspaces/codespaces-blank/.auditoria/kit/navegador.cjs");

const RUTAS_PRIVADAS = [
  "/dashboard",
  "/dashboard/nueva-obra",
  "/dashboard/editar/estudio-nordelta", // existe, de martín (pintor)
  "/dashboard/perfil",
  "/cliente",
  "/panel",
  "/admin",
  "/publicar",
  "/cotizaciones",
  "/mi-panel",
];

(async () => {
  const { browser, page, eventos } = await k.abrir({ movil: false });
  const resultados = { sinSesion: {}, conSesionCliente: {} };
  try {
    console.log("### SIN SESION ###");
    for (const ruta of RUTAS_PRIVADAS) {
      k.limpiarEventos(eventos);
      const status = await k.ir(page, ruta);
      const info = await k.auditar(page, eventos);
      resultados.sinSesion[ruta] = { status, url: info.url, h1: info.h1, textosProhibidos: info.textosProhibidos, requestsFallidos: info.requestsFallidos, erroresConsola: info.erroresConsola };
      console.log(ruta, "->", status, "| final url:", info.url, "| h1:", info.h1);
    }

    console.log("\n### CON SESION (cliente) — probando rutas de OTRO rol / marketplace ###");
    await k.ingresar(page, "cliente");
    console.log("Logueado como cliente. URL:", page.url());
    const rutasComoCliente = ["/dashboard", "/panel", "/admin", "/dashboard/editar/estudio-nordelta", "/dashboard/nueva-obra"];
    for (const ruta of rutasComoCliente) {
      k.limpiarEventos(eventos);
      const status = await k.ir(page, ruta);
      const info = await k.auditar(page, eventos);
      resultados.conSesionCliente[ruta] = { status, url: info.url, h1: info.h1, textosProhibidos: info.textosProhibidos, requestsFallidos: info.requestsFallidos, erroresConsola: info.erroresConsola };
      console.log(ruta, "->", status, "| final url:", info.url, "| h1:", info.h1, "| prohibidos:", info.textosProhibidos);
    }
  } finally {
    await browser.close();
  }
  console.log("\n\nRESUMEN JSON:\n", JSON.stringify(resultados, null, 2));
})();
