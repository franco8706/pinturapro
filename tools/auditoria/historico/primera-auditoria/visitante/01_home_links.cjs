const k = require("/workspaces/codespaces-blank/.auditoria/kit/navegador.cjs");

async function recorrer(movil) {
  const { browser, page, eventos } = await k.abrir({ movil });
  const resultados = { movil, home: null, navbarLinks: [], footerLinks: [], hamburguesa: null, linksRotos: [] };
  try {
    k.limpiarEventos(eventos);
    const status = await k.ir(page, "/");
    resultados.home = { status, auditoria: await k.auditar(page, eventos) };

    // Extraer todos los links de nav y footer
    const links = await page.evaluate(() => {
      function extraerLinks(selectorContenedor) {
        const el = document.querySelector(selectorContenedor);
        if (!el) return null;
        return [...el.querySelectorAll("a[href]")].map((a) => ({
          texto: a.innerText.trim().slice(0, 40),
          href: a.getAttribute("href"),
        }));
      }
      const nav = extraerLinks("nav") || extraerLinks("header");
      const footer = extraerLinks("footer");
      return { nav, footer };
    });
    resultados.navbarLinks = links.nav || [];
    resultados.footerLinks = links.footer || [];

    // Probar el menú hamburguesa en mobile
    if (movil) {
      const botonMenu = await page.$('button[aria-label*="menu" i], button[aria-label*="menú" i], [aria-label*="Abrir" i]');
      if (botonMenu) {
        await botonMenu.click();
        await page.waitForTimeout(400);
        const linksMenu = await page.evaluate(() => {
          return [...document.querySelectorAll('a[href]')]
            .filter((a) => {
              const r = a.getBoundingClientRect();
              return r.width > 0 && r.height > 0;
            })
            .map((a) => ({ texto: a.innerText.trim().slice(0, 40), href: a.getAttribute("href") }));
        });
        resultados.hamburguesa = { encontrado: true, links: linksMenu };
        await page.screenshot({ path: "/workspaces/codespaces-blank/.auditoria/kit/visitante/screenshot_menu_mobile.png" });
      } else {
        resultados.hamburguesa = { encontrado: false };
      }
    }

    // Verificar status de cada link único (mismo origen, rutas internas)
    const todos = [...resultados.navbarLinks, ...resultados.footerLinks, ...((resultados.hamburguesa && resultados.hamburguesa.links) || [])];
    const rutas = [...new Set(todos.map((l) => l.href).filter((h) => h && h.startsWith("/")))];
    for (const ruta of rutas) {
      const st = await k.ir(page, ruta);
      if (st >= 400 || st === null) {
        resultados.linksRotos.push({ ruta, status: st });
      }
    }
  } finally {
    await browser.close();
  }
  return resultados;
}

(async () => {
  const desktop = await recorrer(false);
  const mobile = await recorrer(true);
  console.log(JSON.stringify({ desktop, mobile }, null, 2));
})();
