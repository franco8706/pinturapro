#!/usr/bin/env node
/**
 * Vigilancia de Pintura Pro en producción.
 *
 * Corre sin navegador y sin dependencias: sólo `fetch`. Pensado para ejecutarse solo, en una
 * máquina que no sea la de nadie: un **trabajo programado de Cloud Run**, disparado por Cloud
 * Scheduler, que es donde va a vivir el proyecto.
 *
 * Cuando encuentra algo, lo escribe con severidad ERROR en formato JSON: así Cloud Logging lo
 * reconoce como error y una alerta basada en logs puede avisar por mail sin configurar nada
 * más. Con `LOG_JSON=0` escribe texto plano, para leerlo desde una terminal.
 *
 * Qué mira, y por qué cada cosa está acá:
 *
 *  · **Que el sitio conteste.** Obvio, pero es el 90% de los sustos.
 *  · **Que la base responda**, vía /api/health, que prueba seis sondas reales. Los dos
 *    incidentes que tuvo este proyecto fueron permisos rotos en UNA tabla o función, no la
 *    base entera caída: por eso no alcanza con "la home carga".
 *  · **Que las páginas legales sigan en pie.** Si /privacidad o /terminos se rompen, el sitio
 *    sigue andando y nadie se entera, pero queda operando sin los textos que la ley exige.
 *  · **Que los paneles privados no se indexen** ni queden abiertos sin sesión.
 *  · **Que las cabeceras de seguridad estén.** Se pierden con un cambio de configuración y
 *    no se nota hasta que alguien mete el sitio en un iframe.
 *
 * Uso:
 *   PINTURAPRO_URL=https://... node tools/auditoria/vigilancia/revisar.mjs
 *   node tools/auditoria/vigilancia/revisar.mjs            # contra localhost:3000
 *
 * Sale con código 1 si algo falla, que es lo que dispara el aviso.
 */

const BASE = (process.env.PINTURAPRO_URL || "http://localhost:3000").replace(/\/+$/, "");
const ESPERA = Number(process.env.VIGILANCIA_TIMEOUT_MS || 20000);

/**
 * Cloud Logging entiende una línea JSON con `severity` y `message` como una entrada
 * estructurada; cualquier otra cosa la guarda como texto suelto, que no sirve para alertar.
 * Se activa solo cuando corre en Cloud Run (`K_SERVICE` lo pone la plataforma).
 */
const JSON_LOGS = process.env.LOG_JSON ? process.env.LOG_JSON !== "0" : !!process.env.K_SERVICE;

function registrar(severity, message, extra = {}) {
  if (JSON_LOGS) {
    console.log(JSON.stringify({ severity, message, sitio: BASE, ...extra }));
  } else {
    console.log(message);
  }
}

const fallas = [];
const notas = [];

function falla(que, detalle) {
  fallas.push(`${que}${detalle ? ` — ${detalle}` : ""}`);
}

async function pedir(ruta, opciones = {}) {
  const t0 = Date.now();
  try {
    const r = await fetch(BASE + ruta, {
      redirect: "manual",
      signal: AbortSignal.timeout(ESPERA),
      headers: { "User-Agent": "vigilancia-pinturapro" },
      ...opciones,
    });
    return { ok: true, status: r.status, headers: r.headers, texto: await r.text(), ms: Date.now() - t0 };
  } catch (e) {
    return { ok: false, error: String(e).slice(0, 200), ms: Date.now() - t0 };
  }
}

// ── 1. La base, por la sonda que prueba tabla por tabla ──
async function salud() {
  const r = await pedir("/api/health");
  if (!r.ok) return falla("no se pudo consultar /api/health", r.error);
  let cuerpo;
  try {
    cuerpo = JSON.parse(r.texto);
  } catch {
    return falla("/api/health no devolvió JSON", r.texto.slice(0, 120));
  }
  if (r.status !== 200 || cuerpo.status !== "ok") {
    return falla(
      `la base no está sana (HTTP ${r.status}, estado "${cuerpo.status}")`,
      cuerpo.failing ? `fallan: ${JSON.stringify(cuerpo.failing)}` : "",
    );
  }
  if (cuerpo.servingMockData) {
    falla("el sitio está sirviendo datos de ejemplo en lugar de los reales");
  }
  notas.push(`base OK · ${cuerpo.checks} sondas · ${cuerpo.latencyMs} ms`);
}

// ── 2. Las páginas que tienen que estar ──
const PUBLICAS = ["/", "/pintores", "/obras", "/simulador", "/cotizar", "/contacto"];
const LEGALES = ["/privacidad", "/terminos"];

async function paginas() {
  for (const ruta of [...PUBLICAS, ...LEGALES]) {
    const r = await pedir(ruta);
    if (!r.ok) {
      falla(`${ruta} no respondió`, r.error);
      continue;
    }
    if (r.status !== 200) {
      falla(`${ruta} devolvió HTTP ${r.status}`);
      continue;
    }
    if (r.ms > 8000) notas.push(`${ruta} tardó ${r.ms} ms`);
  }
}

// ── 3. Los textos legales siguen siendo textos legales ──
// Una página que carga pero se quedó vacía es peor que una caída: nadie se entera.
const SENALES_LEGALES = {
  "/privacidad": ["responsable", "datos personales", "25.326"],
  "/terminos": ["comisión", "reseñas", "cuenta"],
};

async function legales() {
  for (const [ruta, señales] of Object.entries(SENALES_LEGALES)) {
    const r = await pedir(ruta);
    if (!r.ok || r.status !== 200) continue; // ya lo reportó `paginas()`
    const texto = r.texto.toLowerCase();
    const faltan = señales.filter((s) => !texto.includes(s.toLowerCase()));
    if (faltan.length) {
      falla(`${ruta} perdió contenido`, `no aparece: ${faltan.join(", ")}`);
    }
  }
}

// ── 4. Lo privado sigue siendo privado ──
const PRIVADAS = ["/dashboard", "/cliente", "/admin", "/panel", "/cotizaciones", "/mi-cuenta"];

async function privadas() {
  for (const ruta of PRIVADAS) {
    const r = await pedir(ruta);
    if (!r.ok) {
      falla(`${ruta} no respondió`, r.error);
      continue;
    }
    // Sin sesión tiene que redirigir al ingreso. Un 200 con contenido sería una fuga.
    const redirige = r.status >= 300 && r.status < 400 && /\/ingresar/.test(r.headers.get("location") || "");
    const pantallaDeIngreso = r.status === 200 && /ingres/i.test(r.texto.slice(0, 4000));
    if (!redirige && !pantallaDeIngreso) {
      falla(`${ruta} no pide iniciar sesión`, `HTTP ${r.status}`);
    }
  }

  const robots = await pedir("/robots.txt");
  if (robots.ok && robots.status === 200) {
    for (const ruta of ["/dashboard", "/admin", "/panel", "/mi-cuenta"]) {
      if (!robots.texto.includes(`Disallow: ${ruta}`)) {
        falla(`robots.txt dejó de bloquear ${ruta}`);
      }
    }
  } else {
    falla("no se pudo leer robots.txt");
  }
}

// ── 5. Las cabeceras de seguridad ──
// Se pierden con un cambio de configuración y no se nota hasta que pasa algo.
async function cabeceras() {
  const r = await pedir("/");
  if (!r.ok || r.status !== 200) return;
  const esperadas = {
    "content-security-policy": "la política de contenido",
    "x-frame-options": "el bloqueo de iframes (clickjacking)",
    "x-content-type-options": "el bloqueo de adivinar el tipo de archivo",
    "referrer-policy": "el control de a dónde se manda la dirección de origen",
  };
  for (const [cabecera, para] of Object.entries(esperadas)) {
    if (!r.headers.get(cabecera)) falla(`falta la cabecera ${cabecera}`, para);
  }
  // En producción, sobre HTTPS, además tiene que estar HSTS.
  if (BASE.startsWith("https://") && !r.headers.get("strict-transport-security")) {
    falla("falta la cabecera strict-transport-security", "el navegador puede caer a HTTP");
  }
}

// ── 6. El mapa del sitio no manda a páginas rotas ──
async function sitemap() {
  const r = await pedir("/sitemap.xml");
  if (!r.ok || r.status !== 200) return falla("no se pudo leer sitemap.xml");
  const urls = [...r.texto.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
  if (urls.length === 0) return falla("el sitemap quedó vacío");
  notas.push(`sitemap con ${urls.length} direcciones`);
  // Se prueban tres al azar: revisarlas todas en cada corrida sería innecesario.
  const muestra = urls.sort(() => Math.random() - 0.5).slice(0, 3);
  for (const url of muestra) {
    // El sitemap publica direcciones absolutas armadas con la dirección configurada del sitio,
    // que no siempre es la que estamos revisando (en desarrollo son distintas). Lo que
    // interesa es la ruta.
    let ruta;
    try {
      ruta = new URL(url).pathname;
    } catch {
      falla(`el sitemap tiene una dirección inválida: ${url.slice(0, 80)}`);
      continue;
    }
    const p = await pedir(ruta);
    if (!p.ok || p.status !== 200) {
      falla(`el sitemap lista una página que no funciona: ${ruta}`, `HTTP ${p.status ?? p.error}`);
    }
  }
}

const t0 = Date.now();
registrar("INFO", `Vigilancia de Pintura Pro · ${BASE}`);

await salud();
await paginas();
await legales();
await privadas();
await cabeceras();
await sitemap();

const segundos = ((Date.now() - t0) / 1000).toFixed(1);
for (const n of notas) registrar("INFO", `  · ${n}`);

if (fallas.length) {
  // Una entrada por problema: así la alerta de Cloud Logging puede filtrar por texto y el
  // mail dice QUÉ pasó, en vez de "un trabajo falló".
  for (const f of fallas) registrar("ERROR", `Pintura Pro: ${f}`, { tipo: "vigilancia" });
  registrar("ERROR", `Pintura Pro: ${fallas.length} ${fallas.length === 1 ? "problema" : "problemas"} en ${segundos} s`, {
    tipo: "vigilancia-resumen",
    problemas: fallas,
  });
  if (!JSON_LOGS) {
    console.log(`\n✗ ${fallas.length} ${fallas.length === 1 ? "problema" : "problemas"}:\n`);
    for (const f of fallas) console.log(`  · ${f}`);
    console.log("");
  }
  process.exit(1);
}

registrar("INFO", `Pintura Pro: todo en orden (${segundos} s)`, { tipo: "vigilancia-ok" });
if (!JSON_LOGS) console.log(`\n✓ Todo en orden (${segundos} s)\n`);
