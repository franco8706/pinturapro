/**
 * Kit de navegador para los agentes de auditoría de Pintura Pro.
 *
 * Vive DENTRO del repositorio a propósito: antes estaba en /tmp y el Codespace se lo llevó
 * puesto dos veces al reiniciarse, y había que reescribirlo entero (y volver a explicárselo
 * a cada agente). Acá viaja con el proyecto: cualquier sesión, en cualquier máquina, lo
 * tiene sin que nadie lo reconstruya.
 *
 * Cada agente abre SU PROPIO Chrome con esto (playwright como librería) en vez de compartir
 * el navegador del MCP, que es uno solo para todos.
 */
const path = require("path");
const fs = require("fs");

function cargarChromium() {
  const bases = fs.readdirSync("/home/codespace/.npm/_npx").map((d) =>
    path.join("/home/codespace/.npm/_npx", d, "node_modules/playwright-core"),
  );
  for (const b of bases) {
    if (fs.existsSync(b)) return require(b).chromium;
  }
  throw new Error("no encontré playwright-core en la caché de npx");
}
const chromium = cargarChromium();

const BASE = process.env.PINTURAPRO_URL || "http://localhost:3000";
const PASS = "Demo1234!";
const PREFIJO = "ZZAGENT";

const CUENTAS = {
  admin: "empresa@pinturapro.demo",
  pintor: "martin.rojas@pinturapro.demo",
  pintor2: "lucia.fernandez@pinturapro.demo",
  pintor3: "diego.sosa@pinturapro.demo",
  cliente: "marina.acosta@pinturapro.demo",
  cliente2: "javier.mendez@pinturapro.demo",
  cliente3: "sofia.luna@pinturapro.demo",
  cliente4: "carolina.ruiz@pinturapro.demo",
};

async function abrir({ movil = false, hasTouch = null } = {}) {
  const browser = await chromium.launch({
    executablePath: "/usr/bin/google-chrome",
    args: ["--no-sandbox", "--disable-dev-shm-usage"],
  });
  const context = await browser.newContext({
    viewport: movil ? { width: 390, height: 844 } : { width: 1440, height: 900 },
    deviceScaleFactor: movil ? 3 : 1,
    isMobile: movil,
    hasTouch: hasTouch === null ? movil : hasTouch,
    locale: "es-AR",
  });
  const page = await context.newPage();
  const eventos = { consola: [], jsErrors: [], requests: [] };
  page.on("console", (m) => {
    if (m.type() === "error") eventos.consola.push(m.text().slice(0, 300));
  });
  page.on("pageerror", (e) => eventos.jsErrors.push(String(e).slice(0, 300)));
  page.on("response", (r) => {
    if (r.status() >= 400) eventos.requests.push(`${r.status()} ${r.url().slice(0, 140)}`);
  });
  return { browser, context, page, eventos };
}

async function ir(page, ruta) {
  const r = await page.goto(BASE + ruta, { waitUntil: "domcontentloaded", timeout: 60000 });
  // Esperar a que React tome el control de la página (hidratación). Sin esto, en modo
  // desarrollo —donde compilar una ruta tarda segundos— los clics y los archivos que manda
  // el script caen en una página todavía muerta: no pasa nada y parece un bug del producto.
  // Ya arruinó una medición del simulador.
  await page
    .waitForFunction(
      () => {
        const nodos = document.querySelectorAll("button, input, a");
        for (const n of nodos) {
          for (const k in n) if (k.startsWith("__react")) return true;
        }
        return nodos.length === 0; // página sin interactivos: nada que esperar
      },
      { timeout: 30000 },
    )
    .catch(() => {});
  await page.waitForTimeout(500);
  return r ? r.status() : null;
}

async function ingresar(page, rol) {
  const email = CUENTAS[rol];
  if (!email) throw new Error("rol desconocido: " + rol);
  await ir(page, "/ingresar");
  await page.fill("input[type=email]", email);
  await page.fill("input[type=password]", PASS);
  await Promise.all([
    page.waitForURL((u) => !/\/(ingresar|mi-panel)/.test(u.pathname), { timeout: 30000 }).catch(() => {}),
    page.click("button[type=submit]"),
  ]);
  await page.waitForTimeout(800);
  return page.url();
}

async function salir(page) {
  await page.goto(BASE + "/auth/signout", { waitUntil: "domcontentloaded" }).catch(() => {});
  await page.context().clearCookies();
}

function limpiarEventos(eventos) {
  eventos.consola.length = 0;
  eventos.jsErrors.length = 0;
  eventos.requests.length = 0;
}

/** Radiografía estándar de la pantalla actual. Todo debería venir vacío o en cero. */
async function auditar(page, eventos) {
  const medido = await page.evaluate(() => {
    const prohibidos = [
      "Internal Server Error", "TypeError", "undefined is not", "NaN", "Invalid Date",
      "permission denied", "violates row-level security", "null value in column",
      "[object Object]", "Application error",
    ];
    const texto = document.body.innerText || "";
    const chicos = [];
    for (const el of document.querySelectorAll("a,button,input[type=submit],[role=button]")) {
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) continue;
      if (r.width < 24 || r.height < 24) {
        chicos.push(`${(el.innerText || el.getAttribute("aria-label") || el.tagName).trim().slice(0, 28)} [${Math.round(r.width)}x${Math.round(r.height)}]`);
      }
    }
    const fuera = [];
    for (const el of document.querySelectorAll("body *")) {
      const r = el.getBoundingClientRect();
      if (r.width > 0 && (r.right > window.innerWidth + 2 || r.left < -2)) {
        fuera.push(`${el.tagName}.${String(el.className).slice(0, 30)}`);
        if (fuera.length > 6) break;
      }
    }
    return {
      titulo: document.title,
      h1: [...document.querySelectorAll("h1")].map((h) => h.innerText.trim()),
      scrollHorizontal: document.documentElement.scrollWidth > window.innerWidth + 2,
      elementosFueraDePantalla: fuera,
      objetivosTactilesChicos: chicos,
      imagenesRotas: [...document.images].filter((i) => i.complete && i.naturalWidth === 0).map((i) => i.currentSrc.slice(0, 100)),
      textosProhibidos: prohibidos.filter((p) => texto.includes(p)),
    };
  });
  return {
    url: page.url(),
    ...medido,
    erroresConsola: [...eventos.consola],
    erroresJs: [...eventos.jsErrors],
    requestsFallidos: [...eventos.requests],
  };
}

module.exports = { BASE, PASS, PREFIJO, CUENTAS, abrir, ir, ingresar, salir, auditar, limpiarEventos };
