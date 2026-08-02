/**
 * Siembra ACTIVIDAD del marketplace (pedidos y cotizaciones en curso).
 *
 * `scripts/seed_supabase.py` deja todo el historial en `completed` + reseñado, así que los
 * paneles se ven "al final de la película": 0 solicitudes activas, /trabajos y /cotizaciones
 * vacíos. Este script agrega los estados intermedios para poder recorrer el flujo completo:
 *
 *   1. pedido publicado SIN cotizar   → el pintor lo ve en /trabajos y puede cotizar
 *   2. pedido CON 3 cotizaciones      → el cliente compara y acepta en /cotizaciones
 *   3. trabajo aceptado (en curso)    → el pintor lo marca completado en /dashboard
 *   4. trabajo completado SIN reseñar → el cliente deja la reseña en /cliente
 *
 * Idempotente: marca lo que crea con un prefijo en el slug y lo borra antes de re-sembrar,
 * así se puede correr las veces que haga falta sin duplicar.
 *
 * Uso:  cd apps/web && node scripts/seed-marketplace-activity.mjs
 *       (lee apps/web/.env.local; necesita SUPABASE_SERVICE_ROLE_KEY porque escribe
 *        en nombre de varios usuarios, salteando RLS)
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const envPath = resolve(here, "../.env.local");

// .env.local mínimo (KEY=VALUE por línea); evita sumar una dependencia solo para esto.
for (const line of readFileSync(envPath, "utf8").split("\n")) {
  const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim();
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("Faltan NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY en apps/web/.env.local");
  process.exit(1);
}
const db = createClient(url, key, { auth: { persistSession: false } });

const TAG = "demo-activo"; // marca de lo sembrado acá (para poder limpiarlo)
const COMMISSION = 0.1;

const fail = (label, error) => {
  if (error) {
    console.error(`✗ ${label}:`, error.message);
    process.exit(1);
  }
};

// ── Actores ────────────────────────────────────────────────────────────────
const { data: profiles, error: pErr } = await db.from("profiles").select("id, full_name, type, location");
fail("leer profiles", pErr);

const painters = profiles.filter((p) => p.type === "painter");
const clients = profiles.filter((p) => p.type === "client");
if (painters.length < 3 || clients.length < 1) {
  console.error("Se necesitan al menos 3 pintores y 1 cliente. ¿Corriste scripts/seed_supabase.py?");
  process.exit(1);
}

// Carolina es la cuenta demo documentada; si no está, cae al primer cliente.
const cliente = clients.find((c) => /carolina/i.test(c.full_name ?? "")) ?? clients[0];
console.log(`Cliente: ${cliente.full_name}`);
console.log(`Pintores: ${painters.map((p) => p.full_name).join(", ")}\n`);

// ── Limpieza de corridas anteriores ────────────────────────────────────────
const { data: viejos } = await db.from("projects").select("id").like("slug", `${TAG}-%`);
if (viejos?.length) {
  const ids = viejos.map((p) => p.id);
  await db.from("jobs").delete().in("project_id", ids);
  await db.from("projects").delete().in("id", ids);
  console.log(`Limpiadas ${ids.length} siembras anteriores.\n`);
}

// ── 1-3. Pedidos del cliente ───────────────────────────────────────────────
const pedidos = [
  {
    title: "Pintura completa de PH en Barracas",
    description:
      "PH de 3 ambientes, 78 m². Necesito interior completo: paredes, cielorrasos y aberturas de madera. " +
      "Hay humedad en una pared del patio que habría que tratar antes.",
    location: "Barracas, CABA",
    budget_min: 800000,
    budget_max: 1400000,
    estado: "sin-cotizar",
  },
  {
    title: "Frente y medianera de casa en Caballito",
    description:
      "Casa de dos plantas. Frente descascarado con revoque flojo en la parte baja y medianera de 12 m " +
      "que nunca se pintó. Busco terminación impermeabilizante.",
    location: "Caballito, CABA",
    budget_min: 1200000,
    budget_max: 2000000,
    estado: "con-cotizaciones",
  },
  {
    title: "Living y cocina de departamento en Palermo",
    description: "Departamento de 2 ambientes, 55 m². Living, cocina integrada y pasillo. Colores claros.",
    location: "Palermo, CABA",
    budget_min: 450000,
    budget_max: 700000,
    estado: "aceptado",
  },
  {
    title: "Dormitorios y pasillo en Villa Crespo",
    description: "Dos dormitorios y pasillo, 40 m². Trabajo ya terminado, falta calificar al pintor.",
    location: "Villa Crespo, CABA",
    budget_min: 300000,
    budget_max: 500000,
    estado: "completado-sin-resena",
  },
];

const creados = [];
for (const [i, p] of pedidos.entries()) {
  const { data, error } = await db
    .from("projects")
    .insert({
      owner_id: cliente.id,
      type: "service",
      title: p.title,
      slug: `${TAG}-${i + 1}`,
      description: p.description,
      location: p.location,
      budget_min: p.budget_min,
      budget_max: p.budget_max,
      published: true,
    })
    .select("id, title")
    .single();
  fail(`crear pedido "${p.title}"`, error);
  creados.push({ ...data, estado: p.estado });
  console.log(`✓ pedido: ${data.title}  [${p.estado}]`);
}

// ── Jobs según el estado que queremos mostrar ──────────────────────────────
const job = (projectId, painterId, status, amount, note) => ({
  project_id: projectId,
  client_id: cliente.id,
  painter_id: painterId,
  status,
  amount,
  commission_amount: Math.round(amount * COMMISSION),
  note: note ?? null,
});

const conCotizaciones = creados.find((c) => c.estado === "con-cotizaciones");
const aceptado = creados.find((c) => c.estado === "aceptado");
const completado = creados.find((c) => c.estado === "completado-sin-resena");

// 3 pintores cotizan el mismo pedido → el cliente compara precios y mensajes.
const cotizaciones = [
  [painters[0].id, 1_450_000, "Incluye tratamiento de humedad con hidrolaca y dos manos de látex acrílico. 6 días de obra."],
  [painters[1].id, 1_780_000, "Trabajo con andamio propio. Uso Sherwin Williams Loxon para el frente. Garantía de 3 años."],
  [painters[2].id, 1_190_000, "Presupuesto ajustado. Materiales a cargo del cliente, mano de obra y andamio incluidos."],
].map(([pid, amount, note]) => job(conCotizaciones.id, pid, "quoted", amount, note));

const { error: qErr } = await db.from("jobs").insert(cotizaciones);
fail("crear cotizaciones", qErr);
console.log(`\n✓ ${cotizaciones.length} cotizaciones sobre "${conCotizaciones.title}"`);

const { error: aErr } = await db
  .from("jobs")
  .insert(job(aceptado.id, painters[0].id, "accepted", 620_000, "Arranco el lunes. Incluye masillado y dos manos."));
fail("crear trabajo aceptado", aErr);
console.log(`✓ trabajo aceptado (en curso) con ${painters[0].full_name}`);

const { error: cErr } = await db
  .from("jobs")
  .insert(job(completado.id, painters[1].id, "completed", 380_000, "Terminado en 3 días."));
fail("crear trabajo completado", cErr);
console.log(`✓ trabajo completado SIN reseña con ${painters[1].full_name}`);

// ── Resumen ────────────────────────────────────────────────────────────────
const { data: final } = await db.from("jobs").select("status").eq("client_id", cliente.id);
const cuenta = final.reduce((acc, j) => ({ ...acc, [j.status]: (acc[j.status] ?? 0) + 1 }), {});
console.log(`\n── Jobs de ${cliente.full_name} ──`);
console.table(cuenta);
console.log(`
Ahora deberías ver:
  /cliente       → solicitudes activas > 0 y un formulario de reseña pendiente
  /cotizaciones  → 3 cotizaciones para comparar y aceptar
  /trabajos      → pedidos abiertos para cotizar (entrando como pintor)
`);
