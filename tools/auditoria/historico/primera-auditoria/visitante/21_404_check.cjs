const k = require("/workspaces/codespaces-blank/.auditoria/kit/navegador.cjs");
(async () => {
  const { browser, page, eventos } = await k.abrir({ movil: false });
  try {
    const rutas = [
      "/obras/no-existe-esta-obra",
      "/pintor/00000000-0000-0000-0000-000000000000",
      "/pintor/id-invalido-no-uuid",
      "/pagina-que-no-existe",
    ];
    for (const ruta of rutas) {
      k.limpiarEventos(eventos);
      let status;
      try { status = await k.ir(page, ruta); } catch(e) { status = "ERROR:"+e; }
      const a = await k.auditar(page, eventos);
      console.log(ruta, "-> status:", status, "| titulo:", a.titulo, "| h1:", a.h1, "| textosProhibidos:", a.textosProhibidos, "| jsErrors:", a.erroresJs, "| consola:", a.erroresConsola, "| reqFallidos:", a.requestsFallidos);
    }
  } finally {
    await browser.close();
  }
})();
