/**
 * Pruebas del paquete de reglas. Se corren sin navegador y sin base:
 *   node packages/dominio/pruebas.ts
 *
 * Node 22+ ejecuta TypeScript directamente, así que no hace falta compilar nada. Las
 * importaciones llevan la extensión `.ts` porque node la exige; el `index.ts` del paquete no,
 * porque ahí resuelve el empaquetador de cada app.
 */
import { montoDesdeTexto, comisionDe } from "./src/montos.ts";
import { revisarLargos, TOPES } from "./src/topes.ts";
import { mensajeDeError } from "./src/errores.ts";
import { puedeCotizar } from "./src/roles.ts";

let fallas = 0;
function igual(obtenido: unknown, esperado: unknown, que: string) {
  if (JSON.stringify(obtenido) !== JSON.stringify(esperado)) {
    console.log(`  ✗ ${que}: esperaba ${JSON.stringify(esperado)}, obtuve ${JSON.stringify(obtenido)}`);
    fallas++;
  }
}

// ── Montos ──
// El caso que rompía en la app móvil: formato argentino multiplicado por cien.
igual(montoDesdeTexto("150.000,50"), 150000, "150.000,50 es ciento cincuenta mil");
igual(montoDesdeTexto("320.000"), 320000, "el punto es separador de miles");
igual(montoDesdeTexto("$ 45.500"), 45500, "el signo pesos y los espacios se ignoran");
igual(montoDesdeTexto("1250"), 1250, "un número pelado");
// Un negativo se rechaza en vez de "corregirse" a positivo, que era lo peligroso.
igual(montoDesdeTexto("-99999"), null, "un monto negativo se rechaza");
igual(montoDesdeTexto("0"), null, "cero no es un monto");
igual(montoDesdeTexto("abc"), null, "letras no son un monto");
igual(montoDesdeTexto(""), null, "vacío no es un monto");
igual(montoDesdeTexto("99999999999"), null, "un monto absurdo se rechaza (desborda en la base)");
igual(comisionDe(500000), 50000, "la comisión es el 10%");

// ── Topes de largo ──
igual(revisarLargos({ titulo: "corto" }), null, "un título corto pasa");
igual(
  revisarLargos({ titulo: "x".repeat(TOPES.titulo + 1) }),
  "El título no puede superar los 120 caracteres.",
  "un título largo se explica en castellano",
);
igual(revisarLargos({ bio: null, descripcion: undefined }), null, "campos vacíos no molestan");

// ── Errores de la base ──
igual(
  mensajeDeError({ code: "23514", message: 'violates check constraint "projects_title_largo"' }),
  "El título es demasiado largo (máximo 120 caracteres).",
  "el tope de largo de la base se traduce",
);
igual(
  mensajeDeError({ code: "42501", message: "new row violates row-level security policy" }),
  "No podés hacer esa acción sobre este trabajo.",
  "un error de permisos se traduce",
);

// ── Roles ──
igual(puedeCotizar("painter"), true, "un pintor puede cotizar");
igual(puedeCotizar("company"), true, "una empresa puede cotizar");
igual(puedeCotizar("client"), false, "un cliente no puede cotizar");
igual(puedeCotizar(null), false, "sin perfil, no");

console.log(fallas === 0 ? "reglas de negocio: todo en verde" : `reglas de negocio: ${fallas} fallas`);
process.exit(fallas ? 1 : 0);
