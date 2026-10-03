const k = require("/workspaces/codespaces-blank/.auditoria/kit/navegador.cjs");
const DIR = "/workspaces/codespaces-blank/.auditoria/kit/visitante/";

const PAGINAS = [
  ["obras", "/obras"],
  ["obra_casa_barracas", "/obras/casa-barracas"],
  ["pintores", "/pintores"],
  ["pintor_diego", "/pintor/225f594d-00e1-420e-b392-af2a15bd1f9d"],
  ["mapa", "/mapa"],
  ["simulador", "/simulador"],
  ["colores", "/colores"],
  ["trabajos", "/trabajos"],
  ["cotizar", "/cotizar"],
  ["registro", "/registro"],
  ["aprender", "/aprender"],
  ["novedades", "/novedades"],
  ["asesoramiento", "/asesoramiento"],
];

(async () => {
  const { browser, page } = await k.abrir({ movil: true });
  const textos = {};
  try {
    for (const [nombre, ruta] of PAGINAS) {
      await k.ir(page, ruta);
      await page.waitForTimeout(400);
      await page.screenshot({ path: DIR + "m_" + nombre + ".png", fullPage: true });
      textos[ruta] = (await page.evaluate(() => document.body.innerText)).slice(0, 4000);
    }
  } finally {
    await browser.close();
  }
  require("fs").writeFileSync(DIR + "textos_movil.json", JSON.stringify(textos, null, 2));
  console.log("listo");
})();
