#!/usr/bin/env node
// Mapa de cobertura de Pintura Pro: qué pantallas, acciones, tablas y funciones de la base
// mira alguien —una prueba de regresión, un agente, el vigilante 24/7— y qué no mira nadie.
//
// Para qué: cada ronda de auditoría decidía dónde mirar de memoria, y la memoria del
// orquestador se pierde cada vez que la conversación se compacta. Esto lo saca del código, así
// que la próxima ronda arranca por los huecos y no por lo que ya se revisó tres veces.
//
// Uso: node tools/auditoria/cobertura.mjs      → escribe tools/auditoria/COBERTURA.md
//
// Qué cuenta como "lo mira": que el nombre de la ruta, la acción o la tabla aparezca en el
// archivo de la prueba, del agente o del vigilante. Es una aproximación: una prueba puede
// nombrar una ruta y no medir lo que importa. Sirve para ver lo que NADIE nombra, que seguro
// no lo mira nadie.
import { readFileSync, readdirSync, statSync, writeFileSync, existsSync } from "node:fs";
import { join, relative, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), "../..");
const APP = join(RAIZ, "apps/web/app");
const leer = (f) => readFileSync(f, "utf8");

function archivos(dir, filtro) {
  if (!existsSync(dir)) return [];
  const salida = [];
  for (const nombre of readdirSync(dir)) {
    if (nombre === "node_modules" || nombre.startsWith(".")) continue;
    const ruta = join(dir, nombre);
    if (statSync(ruta).isDirectory()) salida.push(...archivos(ruta, filtro));
    else if (filtro(ruta)) salida.push(ruta);
  }
  return salida;
}

// ---------- Lo que existe ----------

// Rutas: cada page.tsx / route.ts, sin los grupos entre paréntesis.
function rutaDe(archivo) {
  const partes = relative(APP, dirname(archivo)).split("/").filter((p) => p && !/^\(.*\)$/.test(p));
  return "/" + partes.join("/");
}
const paginas = archivos(APP, (f) => /\/page\.tsx?$/.test(f)).map((f) => ({ ruta: rutaDe(f), archivo: f }));
const apis = archivos(APP, (f) => /\/route\.ts$/.test(f)).map((f) => ({ ruta: rutaDe(f), archivo: f }));

// Acciones de servidor: funciones exportadas de archivos "use server".
const acciones = [];
for (const f of archivos(join(RAIZ, "apps/web"), (f) => /\.tsx?$/.test(f) && !f.includes("/.next/"))) {
  const texto = leer(f);
  if (!/^\s*["']use server["']/.test(texto)) continue;
  for (const m of texto.matchAll(/export\s+async\s+function\s+(\w+)/g)) acciones.push({ nombre: m[1], archivo: f });
}

// Tablas y funciones de la base, de las migraciones.
const migraciones = archivos(join(RAIZ, "supabase/migrations"), (f) => f.endsWith(".sql")).sort();
const tablas = new Set();
const funciones = new Set();
for (const f of migraciones) {
  const sql = leer(f).toLowerCase();
  for (const m of sql.matchAll(/create\s+table\s+(?:if\s+not\s+exists\s+)?(?:public\.)?"?(\w+)"?/g)) tablas.add(m[1]);
  for (const m of sql.matchAll(/create\s+(?:or\s+replace\s+)?function\s+(?:public\.)?"?(\w+)"?/g)) funciones.add(m[1]);
  for (const m of sql.matchAll(/drop\s+table\s+(?:if\s+exists\s+)?(?:public\.)?"?(\w+)"?/g)) tablas.delete(m[1]);
}

// ---------- Quién mira ----------

const fuentes = [
  ...archivos(join(RAIZ, "tools/auditoria/regresiones"), (f) => f.endsWith(".prueba.cjs")).map((f) => ({
    tipo: "prueba",
    nombre: f.split("/").pop().replace(".prueba.cjs", ""),
    texto: leer(f),
  })),
  ...(existsSync(join(RAIZ, "packages/dominio/pruebas.ts"))
    ? [{ tipo: "prueba", nombre: "dominio/pruebas.ts", texto: leer(join(RAIZ, "packages/dominio/pruebas.ts")) }]
    : []),
  ...archivos(join(RAIZ, ".claude/agents"), (f) => f.endsWith(".md")).map((f) => ({
    tipo: "agente",
    nombre: f.split("/").pop().replace(".md", ""),
    texto: leer(f),
  })),
  ...archivos(join(RAIZ, "tools/auditoria/vigilancia"), (f) => /\.(mjs|js|cjs)$/.test(f)).map((f) => ({
    tipo: "vigilante",
    nombre: f.split("/").pop(),
    texto: leer(f),
  })),
];

const escapar = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const DINAMICO = "(?:[^\"'`\\s/?#)]+|\\$\\{[^}]+\\})";

// Una ruta se "nombra" si aparece entre comillas, backticks, paréntesis o suelta en un texto.
// La parte dinámica ([slug], [id]) cuenta con cualquier valor, también si se arma con ${...}.
function patronDeRuta(ruta) {
  if (ruta === "/") return /["'`]\/["'`?#]/;
  const cuerpo = ruta
    .split("/")
    .map((seg) => (/^\[.*\]$/.test(seg) ? DINAMICO : escapar(seg)))
    .join("/");
  return new RegExp(`(?:["'\`(\\s]|^)${cuerpo}(?=["'\`?#)\\s,.:;]|$)`, "m");
}
const patronDePalabra = (p) => new RegExp(`\\b${escapar(p)}\\b`);

function quienes(patron) {
  const por = { prueba: [], agente: [], vigilante: [] };
  for (const f of fuentes) if (patron.test(f.texto)) por[f.tipo].push(f.nombre);
  return por;
}

function estado(q) {
  if (q.prueba.length) return "🟢";
  if (q.vigilante.length || q.agente.length) return "🟡";
  return "🔴";
}

// ---------- Salida ----------

const secciones = [];
const conteo = { "🟢": 0, "🟡": 0, "🔴": 0 };
const huecos = [];
function seccion(titulo, nota, items) {
  const orden = { "🔴": 0, "🟡": 1, "🟢": 2 };
  const filas = items
    .map(([nombre, q]) => ({ nombre, q, e: estado(q) }))
    // Primero lo que no mira nadie: es para lo que existe este archivo.
    .sort((a, b) => orden[a.e] - orden[b.e] || a.nombre.localeCompare(b.nombre))
    .map(({ nombre, q, e }) => {
      conteo[e]++;
      if (e === "🔴") huecos.push(`${titulo.toLowerCase()}: ${nombre}`);
      return `| ${e} | \`${nombre}\` | ${q.prueba.join(", ") || "—"} | ${q.agente.join(", ") || "—"} | ${q.vigilante.length ? "sí" : "—"} |`;
    });
  secciones.push(
    `## ${titulo} (${items.length})\n\n${nota}\n\n| | Qué | Pruebas | Agentes | Vigilante |\n|---|---|---|---|---|\n${filas.join("\n")}\n`,
  );
}

seccion(
  "Pantallas",
  "Las páginas que ve la gente. 🔴 = ninguna prueba, agente ni vigilante la nombra.",
  paginas.map((p) => [p.ruta, quienes(patronDeRuta(p.ruta))]),
);
seccion(
  "Puntos de la API",
  "Lo que se puede llamar sin pasar por una pantalla.",
  apis.map((p) => [p.ruta, quienes(patronDeRuta(p.ruta))]),
);
seccion(
  "Acciones de servidor",
  "Son endpoints aunque se escriban como funciones (REGLAS). Que una prueba recorra la pantalla del formulario no aparece acá: se cuenta sólo si alguien nombra la acción.",
  acciones.map((a) => [a.nombre, quienes(patronDePalabra(a.nombre))]),
);
seccion(
  "Tablas de la base",
  "Sacadas de `supabase/migrations/`.",
  [...tablas].sort().map((t) => [t, quienes(patronDePalabra(t))]),
);
seccion(
  "Funciones de la base",
  "Cada una necesita `revoke ... from public, anon` al crearse (ver REGLAS, trampas de la base).",
  [...funciones].sort().map((fn) => [fn, quienes(patronDePalabra(fn))]),
);

const hoy = new Date().toISOString().slice(0, 10);
const nPruebas = fuentes.filter((f) => f.tipo === "prueba").length;
const nAgentes = fuentes.filter((f) => f.tipo === "agente").length;
const encabezado = `# Mapa de cobertura — Pintura Pro

Generado por \`node tools/auditoria/cobertura.mjs\` el ${hoy}. **No se edita a mano**: se vuelve a generar.

🟢 lo nombra una prueba de regresión · 🟡 sólo un agente o el vigilante · 🔴 no lo nombra nadie

**Total:** ${conteo["🟢"]} 🟢 · ${conteo["🟡"]} 🟡 · ${conteo["🔴"]} 🔴 — ${nPruebas} archivos de prueba, ${nAgentes} agentes.

Que algo esté 🟢 no quiere decir que esté bien probado: quiere decir que alguien lo nombra. Lo 🔴
seguro que no lo mira nadie. El agente \`retroalimentacion\` lee este archivo al cerrar cada ronda.
`;

writeFileSync(join(RAIZ, "tools/auditoria/COBERTURA.md"), encabezado + "\n" + secciones.join("\n"));
console.log(
  `COBERTURA.md: ${conteo["🟢"]} 🟢 · ${conteo["🟡"]} 🟡 · ${conteo["🔴"]} 🔴 (${paginas.length} pantallas, ${apis.length} API, ${acciones.length} acciones, ${tablas.size} tablas, ${funciones.size} funciones)`,
);
if (huecos.length) console.log("Sin nadie que los mire:\n  " + huecos.join("\n  "));
