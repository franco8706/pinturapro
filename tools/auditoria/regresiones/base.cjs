/**
 * Acceso a la base para las pruebas que necesitan CONTAR filas.
 *
 * Antes esas pruebas pedían `PINTURAPRO_DB` (una cadena de conexión directa a Postgres) y
 * `psql`. Nunca había ninguna de las dos: el host directo de Supabase es sólo IPv6 y desde
 * este Codespace no anda. Resultado: la prueba del doble envío figuró como "salteada" en
 * TODAS las corridas desde que se escribió. Una prueba que nunca corre no cuida nada, y lo
 * peor es que el "1 salteada" al final se volvió ruido que nadie leía.
 *
 * Esto habla con la API REST de Supabase por HTTPS, con la clave de servicio que la web ya
 * tiene en `apps/web/.env.local`. Sin dependencias: `fetch` alcanza.
 *
 * Las claves se leen del archivo y se usan sólo en las cabeceras; no se imprimen nunca. Si el
 * archivo o las variables no están, `abrirBase()` devuelve null y las pruebas que la
 * necesitan se saltean con aviso, como antes.
 */
const fs = require("fs");
const path = require("path");

const ENV = path.join(__dirname, "../../../apps/web/.env.local");

function leerEnv() {
  if (!fs.existsSync(ENV)) return {};
  const vars = {};
  for (const linea of fs.readFileSync(ENV, "utf8").split("\n")) {
    const m = linea.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m) vars[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
  return vars;
}

function abrirBase() {
  const env = { ...leerEnv(), ...process.env };
  const url = env.NEXT_PUBLIC_SUPABASE_URL;
  const clave = env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !clave) return null;

  const cabeceras = { apikey: clave, Authorization: `Bearer ${clave}` };
  const rest = (tabla, filtro) => `${url.replace(/\/+$/, "")}/rest/v1/${tabla}?${filtro}`;

  return {
    /** Cantidad de filas que cumplen el filtro (sintaxis de PostgREST: `name=eq.algo`). */
    async contar(tabla, filtro) {
      const r = await fetch(rest(tabla, `${filtro}&select=id`), {
        headers: { ...cabeceras, Prefer: "count=exact", Range: "0-0" },
      });
      if (!r.ok && r.status !== 206) throw new Error(`contar ${tabla}: HTTP ${r.status}`);
      const total = (r.headers.get("content-range") || "").split("/")[1];
      return Number(total);
    },
    /** Borra las filas que cumplen el filtro. Devuelve cuántas borró. */
    async borrar(tabla, filtro) {
      if (!filtro || !/=/.test(filtro)) throw new Error("borrar sin filtro: me niego");
      const r = await fetch(rest(tabla, filtro), {
        method: "DELETE",
        headers: { ...cabeceras, Prefer: "return=representation" },
      });
      if (!r.ok) throw new Error(`borrar ${tabla}: HTTP ${r.status}`);
      return (await r.json()).length;
    },
  };
}

module.exports = { abrirBase };
