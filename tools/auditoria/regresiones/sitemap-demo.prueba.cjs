/**
 * Vigila que el sitemap no mande a indexar pintores y obras de demostración.
 *
 * Lo que se rompió (25/9, ver BITÁCORA "Corregido, sin prueba todavía"): el filtro original
 * descartaba sólo lo que "se veía" de ejemplo —slugs que empiezan con "demo-", ids cortos como
 * los de los mocks de `lib/data.ts`— pero los 3 pintores y las 3 obras inventados están
 * cargados en la base como filas normales, con UUID y slug de verdad. El filtro los dejaba
 * pasar sin problema: el sitemap listaba a los tres pintores y las tres obras que no existen.
 * Mandar a Google a indexar profesionales inventados es difícil de deshacer: quedan en caché y
 * en resultados de búsqueda durante meses, y alguien podría contactar a un "pintor" de
 * mentira. El arreglo (`app/sitemap.ts`) corta antes con `NEXT_PUBLIC_DATOS_DEMO` (true por
 * defecto): mientras el contenido sea de muestra, el sitemap sólo lleva las páginas fijas.
 *
 * Esta prueba no puede tocar el entorno del servidor compartido (reiniciarlo para forzar
 * `NEXT_PUBLIC_DATOS_DEMO=false` violaría REGLAS.md), así que vigila el estado real y el que
 * hoy va a producción: con la bandera en su valor por defecto, ninguna URL de `/obras/` o
 * `/pintor/` puede aparecer en el sitemap servido.
 */
module.exports = {
  nombre: "sitemap · no indexa pintores ni obras mientras los datos son de demostración",

  async correr(t, { k }) {
    const r = await fetch(`${k.BASE}/sitemap.xml`, { signal: AbortSignal.timeout(30000) });
    t.igual(r.status, 200, "el sitemap no responde 200");
    const xml = await r.text();

    const urls = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
    t.cierto(urls.length > 0, "el sitemap vino vacío: la prueba no puede decir nada");

    const dinamicas = urls.filter((u) => /\/obras\/[^/]+$|\/pintor\/[^/]+$/.test(u));
    t.cierto(
      dinamicas.length === 0,
      `el sitemap incluye páginas dinámicas con datos de demostración -> ${dinamicas.join(", ")}`,
    );

    // Las fijas sí tienen que estar: si el filtro se pasa de largo y corta TODO, esta prueba
    // no puede confundir "protegió bien" con "no generó nada".
    t.cierto(urls.some((u) => u.endsWith("/obras")), "falta hasta la página fija de /obras en el sitemap");
    t.cierto(urls.some((u) => u.endsWith("/pintores")), "falta hasta la página fija de /pintores en el sitemap");
  },
};
