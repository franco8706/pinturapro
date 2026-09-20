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
 *   node tools/auditoria/regresiones/correr.cjs            # todo lo que no necesita la base
 *   PINTURAPRO_DB='postgresql://...' node .../correr.cjs   # suma las pruebas que cuentan filas
 *   node .../correr.cjs --solo seguridad                   # sólo las pruebas que matcheen
 *
 * Las pruebas que escriben en la base limpian lo suyo. Las que necesitan contar filas se
 * saltean (con aviso, no en silencio) si no hay `PINTURAPRO_DB`.
 */
const fs = require("fs");
const path = require("path");
const k = require("../navegador.cjs");

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

  const db = process.env.PINTURAPRO_DB || null;
  console.log(`\nRegresiones de Pintura Pro · ${archivos.length} pruebas · ${k.BASE}`);
  console.log(db ? "Con acceso a la base: se corren también las pruebas que cuentan filas.\n" : "Sin PINTURAPRO_DB: se saltean las pruebas que cuentan filas.\n");

  let fallaron = 0;
  let salteadas = 0;
  const detalle = [];

  for (const archivo of archivos) {
    const prueba = require(path.join(DIR, archivo));
    const ctx = crearContexto(prueba.nombre || archivo);
    if (prueba.necesitaBase && !db) {
      salteadas++;
      console.log(`  ⊘ ${ctx.nombre} — necesita PINTURAPRO_DB`);
      continue;
    }
    const t0 = Date.now();
    try {
      await prueba.correr(ctx, { k, db });
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

  const total = archivos.length - salteadas;
  console.log(`\n${total - fallaron}/${total} en verde${salteadas ? ` · ${salteadas} salteadas` : ""}\n`);
  if (fallaron) {
    console.log("Cada falla de acá es algo que YA se había arreglado y volvió a romperse.");
    console.log("Antes de tocar la prueba, comprobá a mano si el producto sigue bien.\n");
  }
  process.exit(fallaron ? 1 : 0);
}

main();
