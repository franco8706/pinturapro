/**
 * scrape-brands.mjs — Andamiaje para reemplazar el dataset CURADO de lib/brands.ts
 * por colores oficiales de cada marca.
 *
 * CONTEXTO: a junio 2026, los sitios oficiales no exponen sus cartas de color en
 * el HTML (las renderan con apps JS internas). Por eso este script queda como
 * scaffold: hay que, por marca, identificar el endpoint/JSON interno que alimenta
 * su selector de color (mirar la pestaña Network del navegador en su "buscador de
 * colores") y completar cada `extract*` abajo.
 *
 * Uso (cuando esté implementado):
 *   node scripts/scrape-brands.mjs > apps/web/lib/brands.generated.json
 *
 * Requiere Node 18+ (fetch nativo). Para sitios 100% JS, usar Playwright:
 *   const { chromium } = await import("playwright");
 *
 * ⚠️ Respetar términos de uso / robots.txt de cada sitio antes de scrapear.
 */

const SOURCES = {
  alba: {
    name: "Alba",
    // TODO: endpoint real del buscador de colores de pinturasalba.com.ar
    url: "https://www.pinturasalba.com.ar",
    extract: async (_html) => [], // -> [{ name, code, hex, line, usage }]
  },
  "sherwin-williams": {
    name: "Sherwin Williams",
    // NOTA: el dominio .com.ar no respondía; probar sherwin-williams.com / API de colores SW
    url: "https://www.sherwin-williams.com",
    extract: async (_html) => [],
  },
  sinteplast: {
    name: "Sinteplast",
    url: "https://www.sinteplast.com.ar",
    extract: async (_html) => [],
  },
  plavicon: {
    name: "Plavicon",
    url: "https://www.plavicon.com",
    extract: async (_html) => [],
  },
};

async function run() {
  const out = {};
  for (const [id, src] of Object.entries(SOURCES)) {
    try {
      const res = await fetch(src.url, { redirect: "follow" });
      const html = await res.text();
      const colors = await src.extract(html);
      out[id] = { name: src.name, colors };
      console.error(`${id}: ${colors.length} colores`);
    } catch (e) {
      console.error(`${id}: ERROR ${e.message}`);
      out[id] = { name: src.name, colors: [] };
    }
  }
  process.stdout.write(JSON.stringify(out, null, 2));
}

run();
