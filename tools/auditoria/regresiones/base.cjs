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
    /** Inserta filas (para armar un escenario; se borran en el `finally` de la prueba). */
    async insertar(tabla, filas) {
      const r = await fetch(`${url.replace(/\/+$/, "")}/rest/v1/${tabla}`, {
        method: "POST",
        headers: { ...cabeceras, "Content-Type": "application/json", Prefer: "return=representation" },
        body: JSON.stringify(filas),
      });
      if (!r.ok) throw new Error(`insertar ${tabla}: HTTP ${r.status} ${await r.text()}`);
      return r.json();
    },
    /** Lee las filas que cumplen el filtro. `columnas` es la lista para `select` (PostgREST). */
    async leer(tabla, filtro, columnas = "*") {
      const r = await fetch(rest(tabla, `${filtro}&select=${columnas}`), { headers: cabeceras });
      if (!r.ok) throw new Error(`leer ${tabla}: HTTP ${r.status}`);
      return r.json();
    },
    /**
     * Actualiza las filas que cumplen el filtro con `cambios`. Se usa para prestar un dato
     * demo por un instante (por ejemplo, el rol de una cuenta) y devolverlo a como estaba en
     * el `finally` de la prueba — nunca para dejarlo así (REGLAS.md, 3 bis).
     */
    async actualizar(tabla, filtro, cambios) {
      if (!filtro || !/=/.test(filtro)) throw new Error("actualizar sin filtro: me niego");
      const r = await fetch(rest(tabla, filtro), {
        method: "PATCH",
        headers: { ...cabeceras, "Content-Type": "application/json", Prefer: "return=representation" },
        body: JSON.stringify(cambios),
      });
      if (!r.ok) throw new Error(`actualizar ${tabla}: HTTP ${r.status} ${await r.text()}`);
      return r.json();
    },
    /** Llama a una función de la base con la clave de servicio. Devuelve el resultado o lanza. */
    async rpc(nombre, args = {}) {
      const r = await fetch(`${url.replace(/\/+$/, "")}/rest/v1/rpc/${nombre}`, {
        method: "POST",
        headers: { ...cabeceras, "Content-Type": "application/json" },
        body: JSON.stringify(args),
      });
      if (!r.ok) throw new Error(`rpc ${nombre}: HTTP ${r.status} ${await r.text()}`);
      return r.json();
    },
    /**
     * Crea una cuenta descartable (para pruebas que necesitan un pintor SIN acceso, sin tocar
     * las cuentas demo). Con `email_confirm`, no sale ningún mail. Se borra con `borrarUsuario`.
     */
    async crearUsuario({ email, password, full_name, type }) {
      const r = await fetch(`${url.replace(/\/+$/, "")}/auth/v1/admin/users`, {
        method: "POST",
        headers: { ...cabeceras, "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, email_confirm: true, user_metadata: { full_name, type } }),
      });
      if (!r.ok) throw new Error(`crearUsuario: HTTP ${r.status} ${await r.text()}`);
      const u = await r.json();
      // El perfil lo crea el trigger de alta; se asegura el tipo y el nombre.
      await this.actualizar("profiles", `id=eq.${u.id}`, { type, full_name, onboarded: true });
      return u;
    },
    async borrarUsuario(id) {
      const r = await fetch(`${url.replace(/\/+$/, "")}/auth/v1/admin/users/${id}`, {
        method: "DELETE",
        headers: cabeceras,
      });
      if (!r.ok && r.status !== 404) throw new Error(`borrarUsuario: HTTP ${r.status}`);
    },
    /**
     * Habla con la API COMO esa cuenta, con la clave anon y su sesión: pasa por las policies y
     * los triggers, como la web, la app móvil o cualquiera con un `curl`. Hasta el 6/10/2026
     * ninguna prueba lo hacía —todas usaban la clave de servicio, que se las saltea— y la 0024
     * rompía TODAS las cotizaciones sin que nada lo marcara.
     *
     * Devuelve `{ status, cuerpo }` en vez de lanzar: lo que se prueba muchas veces es el rechazo.
     */
    async comoUsuario(email, password) {
      const anon = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
      if (!anon) throw new Error("comoUsuario: falta NEXT_PUBLIC_SUPABASE_ANON_KEY");
      const raiz = url.replace(/\/+$/, "");
      const r = await fetch(`${raiz}/auth/v1/token?grant_type=password`, {
        method: "POST",
        headers: { apikey: anon, "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      if (!r.ok) throw new Error(`comoUsuario(${email}): HTTP ${r.status}`);
      const sesion = await r.json();
      const suyas = { apikey: anon, Authorization: `Bearer ${sesion.access_token}`, "Content-Type": "application/json" };
      const pedir = async (metodo, ruta, cuerpo, extra = {}) => {
        const res = await fetch(`${raiz}/rest/v1/${ruta}`, {
          method: metodo,
          headers: { ...suyas, Prefer: "return=representation", ...extra },
          body: cuerpo === undefined ? undefined : JSON.stringify(cuerpo),
        });
        const texto = await res.text();
        let json = null;
        try {
          json = texto ? JSON.parse(texto) : null;
        } catch {
          json = texto;
        }
        return { status: res.status, cuerpo: json };
      };
      return {
        id: sesion.user?.id,
        insertar: (tabla, filas) => pedir("POST", tabla, filas),
        actualizar: (tabla, filtro, cambios) => pedir("PATCH", `${tabla}?${filtro}`, cambios),
        // Sin pedir la fila de vuelta, como hace la web: `projects` tiene permisos de lectura por
        // columna (0020) y un `return=representation` hacía fallar el DELETE por eso, no por la
        // regla que se quería probar (pasó con H8, 8/10/2026: la prueba daba bien sin la regla).
        borrar: (tabla, filtro) => pedir("DELETE", `${tabla}?${filtro}`, undefined, { Prefer: "return=minimal" }),
        leer: (tabla, filtro, columnas = "*") => pedir("GET", `${tabla}?${filtro}&select=${columnas}`),
        rpc: (nombre, args = {}) => pedir("POST", `rpc/${nombre}`, args),
      };
    },
  };
}

module.exports = { abrirBase };
