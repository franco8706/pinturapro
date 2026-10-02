/**
 * Pruebas del paquete de reglas. Se corren sin navegador y sin base:
 *   node packages/dominio/pruebas.ts
 *
 * Node 22+ ejecuta TypeScript directamente, así que no hace falta compilar nada. Las
 * importaciones llevan la extensión `.ts` porque node la exige; el `index.ts` del paquete no,
 * porque ahí resuelve el empaquetador de cada app.
 */
import { montoDesdeTexto, motivoMontoInvalido, motivoCotizacionInvalida, comisionDe } from "./src/montos.ts";
import { contactoEnTexto } from "./src/contacto.ts";
import { dimensionesDeImagen, motivoImagenDesmedida } from "./src/imagen.ts";
import { revisarLargos, TOPES } from "./src/topes.ts";
import { mensajeDeError } from "./src/errores.ts";
import { puedeCotizar } from "./src/roles.ts";
import { superficieDesdeTexto, aniosDesdeTexto } from "./src/medidas.ts";

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

// El motivo del rechazo tiene que ayudar a arreglarlo, y corresponder a la regla que falló.
const dice = (entrada: string, pedazo: string, porque: string) =>
  igual((motivoMontoInvalido(entrada) ?? "").includes(pedazo), true, porque);
igual(motivoMontoInvalido("150.000"), null, "un monto válido no tiene motivo de rechazo");
dice("1,500,000", "comas de miles", "la planilla en inglés: decir que el problema es la coma");
dice("150,000.50", "comas de miles", "formato inglés con decimales");
dice("1,500", "comas de miles", "coma seguida de tres cifras");
dice("1500.50", "centavos van con coma", "decimal inglés: decir cómo van los centavos");
dice("abc150000", "sin letras", "letras");
dice("1.5e6", "sin letras", "notación científica también es 'letras'");
dice("-5000", "negativo", "negativo");
dice("99999999999", "mil millones", "tope");
dice("0", "mayor que cero", "cero");
dice("", "Escribí un monto", "vacío");
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


// ── Imágenes: el tamaño se lee del encabezado, sin decodificar ──
// Encabezados armados a mano con las dimensiones conocidas, uno por formato.
const png = (w: number, h: number) => {
  const b = new Uint8Array(40); b.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, 0x49, 0x48, 0x44, 0x52]);
  new DataView(b.buffer).setUint32(16, w); new DataView(b.buffer).setUint32(20, h); return b;
};
const jpeg = (w: number, h: number) => {
  // SOI · APP0 de 16 bytes · SOF0 con alto y ancho
  const b = new Uint8Array(40); b.set([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]); // el APP0 ocupa 2+16
  b.set([0xff, 0xc0, 0x00, 0x11, 0x08, h >> 8, h & 0xff, w >> 8, w & 0xff], 20); return b;
};
const webpX = (w: number, h: number) => {
  const b = new Uint8Array(40); b.set([...Buffer.from("RIFF"), 0, 0, 0, 0, ...Buffer.from("WEBPVP8X")]);
  const W = w - 1, H = h - 1; b.set([W & 0xff, (W >> 8) & 0xff, (W >> 16) & 0xff, H & 0xff, (H >> 8) & 0xff, (H >> 16) & 0xff], 24); return b;
};
igual(JSON.stringify(dimensionesDeImagen(png(1600, 1200))), JSON.stringify({ ancho: 1600, alto: 1200 }), "PNG: ancho y alto del IHDR");
igual(JSON.stringify(dimensionesDeImagen(jpeg(1600, 900))), JSON.stringify({ alto: 900, ancho: 1600 }), "JPEG: saltea el APP0 y lee el SOF0");
igual(JSON.stringify(dimensionesDeImagen(webpX(1600, 1066))), JSON.stringify({ ancho: 1600, alto: 1066 }), "WEBP extendido");
igual(motivoImagenDesmedida(png(1600, 1200)), null, "una foto achicada por el navegador pasa");
{
  // Un JPEG con 80 KB de metadatos antes del cuadro (EXIF + perfil de color): el SOF queda
  // lejos del principio y tiene que encontrarse igual.
  const b = new Uint8Array(90000); b.set([0xff, 0xd8]);
  let i = 2;
  for (let k = 0; k < 2; k++) { b.set([0xff, 0xe1, 0xa0, 0x00], i); i += 2 + 0xa000; }
  b.set([0xff, 0xc2, 0x00, 0x11, 0x08, 0x03, 0x84, 0x06, 0x40], i); // progresivo, 1600 x 900
  igual(JSON.stringify(dimensionesDeImagen(b)), JSON.stringify({ alto: 900, ancho: 1600 }), "JPEG con metadatos largos y SOF progresivo");
}
igual(motivoImagenDesmedida(png(40000, 40000))?.includes("demasiado grande"), true, "la bomba de 1.600 MP que subió el agente se rechaza");
igual(motivoImagenDesmedida(png(12000, 100))?.includes("demasiado grande"), true, "un lado de más de 10.000 px se rechaza aunque el total sea chico");
igual(motivoImagenDesmedida(new Uint8Array(40))?.includes("No pudimos leer"), true, "sin encabezado reconocible: ante la duda, no");

// ── Medidas: lo que `Number()` acepta y no es una superficie ──
// Cada uno de estos pasaba `Number(v) > 0`, y el primero quedó publicado en el tablero.
for (const [entrada, esperado] of [
  ["40", 40], ["40,5", 40.5], ["40.5", 40.5], ["100000", 100000], [" 85 ", 85],
  ["Infinity", null], ["1e9", null], ["99999999999", null], ["100001", null],
  ["0", null], ["-50", null], ["", null], ["abc", null], ["12.345", null], ["0x10", null],
] as [string, number | null][]) {
  igual(superficieDesdeTexto(entrada), esperado, `superficie ${JSON.stringify(entrada)}`);
}
igual(superficieDesdeTexto(null), null, "superficie: null no rompe");
igual(superficieDesdeTexto(undefined), null, "superficie: undefined no rompe");
for (const [entrada, esperado] of [["5", 5], ["70", 70], ["0", null], ["71", null], ["1e2", null], ["5.5", null], ["", null]] as [string, number | null][]) {
  igual(aniosDesdeTexto(entrada), esperado, `años de experiencia ${JSON.stringify(entrada)}`);
}

// ── El piso de una cotización ──
igual(motivoCotizacionInvalida("1")?.includes("mínimo"), true, "cotizar $1 se rechaza con el motivo");
igual(motivoCotizacionInvalida("999")?.includes("mínimo"), true, "$999 queda abajo del piso");
igual(motivoCotizacionInvalida("1000"), null, "$1.000 vale");
igual(motivoCotizacionInvalida("320.000"), null, "un monto normal vale");
igual(motivoCotizacionInvalida("1,500,000")?.includes("comas de miles"), true, "el motivo del parser sigue saliendo primero");

// ── Contacto en un texto libre ──
for (const [texto, esperado] of [
  ["Incluye materiales y dos manos.", null],
  ["Son $1.500.000 en dos pagos de 750.000", null],
  ["Empiezo el 15-08-2026 y termino el 22/08/2026", null],
  ["120 m2, 3 ambientes, 2 manos de látex", null],
  ["Llamame al 11 4444-5555", "un teléfono"],
  ["+54 9 11 4444 5555 cualquier cosa", "un teléfono"],
  ["mi cel: 1144445555", "un teléfono"],
  ["escribime a pintor@gmail.com", "un email"],
  ["mirá mis trabajos en www.mipagina.com", "un enlace"],
  ["https://wa.me/5491144445555", "un enlace"],
  ["hablame por wsp y cerramos por fuera", "un contacto de WhatsApp"],
  ["te paso mi WhatsApp", "un contacto de WhatsApp"],
] as [string, string | null][]) {
  igual(contactoEnTexto(texto), esperado, `contacto en ${JSON.stringify(texto)}`);
}
igual(contactoEnTexto(null), null, "contacto: null no rompe");

// El resumen va AL FINAL: estuvo en el medio y las pruebas de imágenes que se agregaron
// debajo no corrían nunca — el archivo decía "todo en verde" y salía antes de llegar.
console.log(fallas === 0 ? "reglas de negocio: todo en verde" : `reglas de negocio: ${fallas} fallas`);
process.exit(fallas ? 1 : 0);
