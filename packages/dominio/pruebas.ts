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
igual(montoDesdeTexto("150 000"), 150000, "con espacio de miles también");
igual(montoDesdeTexto("1.000.000.000"), 1000000000, "el tope exacto se acepta");

// Lo que antes se adivinaba mal. Cada uno con el número que salía, para que se entienda por
// qué rechazar es mejor que intentar interpretar: un rechazo lo ve la persona y lo corrige;
// un número mal adivinado viaja a una cotización que el cliente acepta.
igual(montoDesdeTexto("1,500,000"), null, "miles en notación inglesa: daba 1, no 1.500.000");
igual(montoDesdeTexto("150,000,000"), null, "idem con tres grupos: daba 150");
igual(montoDesdeTexto("150,000.50"), null, "formato inglés con decimales: daba 150");
igual(montoDesdeTexto("1,500"), null, "una coma con tres dígitos es separador de miles, no centavos");
igual(montoDesdeTexto("1500.50"), null, "decimal inglés sin coma: daba 150.050, cien veces más");
igual(montoDesdeTexto("150.00"), null, "idem: daba 15.000");
igual(montoDesdeTexto("1.50.000"), null, "grupos de miles que no son de tres dígitos");
igual(montoDesdeTexto("1.5e6"), null, "notación científica: daba 156");
igual(montoDesdeTexto("1.50E+06"), null, "científica de Excel: daba 15.006, un número creíble");
igual(montoDesdeTexto("abc150000"), null, "letras pegadas al número: las borraba en silencio");
igual(montoDesdeTexto("1e999"), null, "no hay forma de pasar el tope por notación científica");
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
