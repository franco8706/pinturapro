#!/usr/bin/env node
/**
 * Corredor de regresiones de Pintura Pro.
 *
 * Por qué existe: cada cosa que se arregló acá se había roto sin que nadie se enterara, y se
 * descubrió recién cuando alguien la probó a mano en un navegador. Una revisión manual no
 * escala y no se acuerda: este corredor sí. **Cada arreglo deja su prueba acá**, así que el
 * sistema sabe más después de cada ronda en vez de volver a empezar.
 *
 * Uso:
 *   node tools/auditoria/regresiones/correr.cjs            # todas
 *   node .../correr.cjs --solo seguridad                   # sólo las pruebas que matcheen
 *
 * Las pruebas que escriben en la base limpian lo suyo. Las que necesitan CONTAR filas usan
 * `base.cjs` (API REST con la clave de servicio de `apps/web/.env.local`); si esa clave no
 * está, se saltean con aviso, no en silencio.
 */
const fs = require("fs");
const path = require("path");
const k = require("../navegador.cjs");
const { abrirBase } = require("./base.cjs");

const DIR = __dirname;
const filtro = (() => {
  const i = process.argv.indexOf("--solo");
  return i >= 0 ? process.argv[i + 1] : null;
})();

/** Afirmaciones mínimas: no hace falta un framework para esto. */
function crearContexto(nombre) {
  const fallas = [];
  const notas = [];
  return {
    nombre,
    fallas,
    notas,
    /** Compara y guarda la falla en vez de cortar: una prueba reporta TODO lo que ve. */
    igual(obtenido, esperado, que) {
      const ok = JSON.stringify(obtenido) === JSON.stringify(esperado);
      if (!ok) fallas.push(`${que}: esperaba ${JSON.stringify(esperado)}, obtuve ${JSON.stringify(obtenido)}`);
      return ok;
    },
    cierto(cond, que) {
      if (!cond) fallas.push(que);
      return cond;
    },
    contiene(texto, fragmento, que) {
      const ok = String(texto).includes(fragmento);
      if (!ok) fallas.push(`${que}: no encontré "${fragmento}" en "${String(texto).slice(0, 120)}"`);
      return ok;
    },
    nota(t) {
      notas.push(t);
    },
  };
}

async function main() {
  const archivos = fs
    .readdirSync(DIR)
    .filter((f) => f.endsWith(".prueba.cjs"))
    .filter((f) => !filtro || f.includes(filtro))
    .sort();

  if (!archivos.length) {
    console.log("No hay pruebas que coincidan.");
    process.exit(1);
  }

  // Si el servidor no responde, todas las pruebas fallarían por la misma razón y el reporte
  // no diría nada útil. Mejor cortar acá con el motivo real.
  const vivo = await fetch(k.BASE, { signal: AbortSignal.timeout(15000) })
    .then((r) => r.ok || r.status < 500)
    .catch(() => false);
  if (!vivo) {
    console.error(`\n✗ El servidor no responde en ${k.BASE}. Levantalo con "pnpm dev" desde apps/web.\n`);
    process.exit(2);
  }

  const base = abrirBase();
  console.log(`\nRegresiones de Pintura Pro · ${archivos.length} pruebas · ${k.BASE}`);
  console.log(base ? "Con acceso a la base: corren también las pruebas que cuentan filas.\n" : "Sin clave de servicio en apps/web/.env.local: se saltean las pruebas que cuentan filas.\n");

  // La suscripción (0027): cuando termine el lanzamiento, los pintores demo dejan de poder
  // cotizar, y todas las pruebas que cotizan fallarían por eso y no por lo que miran. Se les da
  // un acceso manual de 3 horas mientras corre la tanda, y se borra al final; si la corrida se
  // cae a la mitad, el acceso vence solo. Sin la 0027 en la base, no hay nada que dar.
  const ACCESO_PRUEBAS = "ZZAGENT regresiones";
  if (base) {
    try {
      const pintores = await base.leer("profiles", "type=in.(painter,company)&full_name=not.like.ZZAGENT*", "id");
      const hasta = new Date(Date.now() + 3 * 3600e3).toISOString();
      await base.insertar(
        "suscripciones",
        pintores.map((p) => ({ pintor_id: p.id, proveedor: "manual", estado: "activa", acceso_hasta: hasta, vigente_hasta: hasta, nota: ACCESO_PRUEBAS })),
      );
    } catch {
      /* la base sin la 0027 */
    }
  }

  let fallaron = 0;
  let salteadas = 0;
  const detalle = [];

  for (const archivo of archivos) {
    const prueba = require(path.join(DIR, archivo));
    const ctx = crearContexto(prueba.nombre || archivo);
    if (prueba.necesitaBase && !base) {
      salteadas++;
      console.log(`  ⊘ ${ctx.nombre} — necesita la clave de servicio en apps/web/.env.local`);
      continue;
    }
    const t0 = Date.now();
    try {
      await prueba.correr(ctx, { k, base });
    } catch (e) {
      ctx.fallas.push(`explotó: ${String(e).slice(0, 300)}`);
    }
    const ms = Date.now() - t0;
    if (ctx.fallas.length) {
      fallaron++;
      console.log(`  ✗ ${ctx.nombre}  (${(ms / 1000).toFixed(1)}s)`);
      for (const f of ctx.fallas) console.log(`      ${f}`);
      detalle.push({ prueba: ctx.nombre, fallas: ctx.fallas });
    } else {
      console.log(`  ✓ ${ctx.nombre}  (${(ms / 1000).toFixed(1)}s)`);
    }
    for (const n of ctx.notas) console.log(`      · ${n}`);
  }

  if (base) await base.borrar("suscripciones", `nota=eq.${encodeURIComponent(ACCESO_PRUEBAS)}`).catch(() => {});

  const total = archivos.length - salteadas;
  console.log(`\n${total - fallaron}/${total} en verde${salteadas ? ` · ${salteadas} salteadas` : ""}\n`);
  if (fallaron) {
    console.log("Cada falla de acá es algo que YA se había arreglado y volvió a romperse.");
    console.log("Antes de tocar la prueba, comprobá a mano si el producto sigue bien.\n");
  }
  process.exit(fallaron ? 1 : 0);
}

main();
