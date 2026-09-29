#!/usr/bin/env node
// Carga liviana contra la compilación de PRODUCCIÓN (:3100, `bash tools/auditoria/produccion.sh`).
// Nunca contra :3000: es el servidor de desarrollo que usan todos los agentes.
//
// Vive en el repo y no en /tmp porque /tmp se borra con cada reinicio del Codespace: el script
// con el que `escala-y-volumen` midió la línea de base el 28/9 se perdió así, y para comparar
// hubo que escribirlo de nuevo. Mismo método que aquel: 85 pedidos por página y por nivel de
// concurrencia (10, 25, 50), mediana y p95 en milisegundos.
//
// Pega contra el Supabase real (del plan gratuito): no subir los números sin pensarlo.
//
// Uso: node tools/auditoria/escala/carga.mjs [base] [ruta...]
const BASE = process.argv[2] ?? "http://localhost:3100";
const RUTAS = process.argv.slice(3).length ? process.argv.slice(3) : ["/", "/pintores", "/obras"];
const PEDIDOS = 85;
const NIVELES = [10, 25, 50];

async function uno(url) {
  const t0 = performance.now();
  const r = await fetch(url, { headers: { "user-agent": "pinturapro-carga" } });
  await r.arrayBuffer();
  return { ms: performance.now() - t0, ok: r.ok, estado: r.status };
}

async function tanda(url, concurrencia) {
  const tiempos = [];
  let errores = 0;
  let pendientes = PEDIDOS;
  await Promise.all(
    Array.from({ length: concurrencia }, async () => {
      while (pendientes-- > 0) {
        try {
          const r = await uno(url);
          tiempos.push(r.ms);
          if (!r.ok) errores++;
        } catch {
          errores++;
        }
      }
    }),
  );
  tiempos.sort((a, b) => a - b);
  const p = (q) => Math.round(tiempos[Math.min(tiempos.length - 1, Math.floor(q * tiempos.length))] ?? NaN);
  return { p50: p(0.5), p95: p(0.95), errores };
}

console.log(`base ${BASE} · ${PEDIDOS} pedidos por celda · ms (p50 / p95)`);
console.log(["ruta", ...NIVELES.map((c) => `c=${c}`)].join("\t"));
for (const ruta of RUTAS) {
  await uno(BASE + ruta); // la primera visita llena la caché: no cuenta
  const celdas = [];
  for (const c of NIVELES) {
    const r = await tanda(BASE + ruta, c);
    celdas.push(`${r.p50}/${r.p95}${r.errores ? ` (${r.errores} err)` : ""}`);
  }
  console.log([ruta, ...celdas].join("\t"));
}
