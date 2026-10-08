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
import {
  precioEnPesos, evaluarCotizacion, vigenteHasta, accesoHasta, estadoDeAcceso, textoDeAcceso,
  fechaAR, sumarMes, codigoDeTransferencia, codigoEnTexto, transferenciaAlcanza, type Movimiento,
} from "./src/suscripcion.ts";

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

// ── Los mensajes de la migración 0026 llegan traducidos, no como "no pudimos completar la acción" ──
igual(mensajeDeError({ code: "P0001", message: "Publicaste muchos pedidos en poco tiempo" }).includes("muchos pedidos"), true, "tope de pedidos de la base");
igual(mensajeDeError({ code: "P0001", message: "Enviaste muchas cotizaciones en poco tiempo" }).includes("muchas cotizaciones"), true, "tope de cotizaciones de la base");
igual(mensajeDeError({ code: "P0001", message: "El monto mínimo de una cotización es $1.000" }).includes("$1.000"), true, "piso de la cotización de la base");

// ── La suscripción: el precio al dólar del día ──
igual(precioEnPesos(5, 1540), 7700, "US$5 al 1540 son $7.700 justos, sin subir a $7.800 por un decimal");
igual(precioEnPesos(5, 1540.5), 7800, "si sobra un peso, se redondea hacia arriba a la centena");
igual(precioEnPesos(5, 1520.2), 7700, "7.601 → 7.700");
igual(precioEnPesos(5, 1500), 7500, "múltiplo exacto");

// Qué hacer con una lectura del dólar: ante la duda, no se usa.
igual(evaluarCotizacion(1540, 1520, 1535)?.estado, "vigente", "una lectura normal queda vigente");
igual(evaluarCotizacion(1540, null, 1535)?.estado, "vigente", "sin fuente de control, igual vale si no salta");
igual(evaluarCotizacion(1540, 1300, 1535)?.estado, "descartada", "las fuentes difieren más del 5 %: no se usa");
igual(evaluarCotizacion(1725, 1720, 1540)?.estado, "a_confirmar", "salta 12 %: lo confirma el dueño");
igual(evaluarCotizacion(1540, 1520, null)?.estado, "vigente", "la primera lectura, sin anterior");
igual(evaluarCotizacion(null, 1520, 1540), null, "fuente principal caída: no hay nada que guardar");
igual(evaluarCotizacion(0, 1520, 1540), null, "un cero no es una cotización");
igual(evaluarCotizacion(Number.NaN, 1520, 1540), null, "NaN tampoco");

// Fechas en hora argentina (UTC−3), aunque el servidor esté en UTC.
igual(fechaAR("2026-11-01T02:30:00Z"), "31/10/2026", "las 23:30 del 31 en Argentina no se muestran como el 1");
igual(fechaAR("2026-11-01T03:00:00Z"), "1/11/2026", "medianoche argentina ya es el 1");
igual(fechaAR(sumarMes("2027-01-31T15:00:00-03:00")), "28/2/2027", "31 de enero + 1 mes = 28 de febrero, no 3 de marzo");
igual(fechaAR(sumarMes("2028-01-31T15:00:00-03:00")), "29/2/2028", "en bisiesto, 29");
igual(fechaAR(sumarMes("2026-10-31T23:30:00-03:00")), "30/11/2026", "el 31 a la noche (ya 1 en UTC) sigue siendo fin de mes");

// Hasta cuándo está pago: un mes por cobro, sin perder días.
const cobro = (fecha: string, id: string): Movimiento => ({ tipo: "cobro", fecha, eventoId: id });
igual(vigenteHasta([]), null, "sin cobros, no está pago");
igual(fechaAR(vigenteHasta([cobro("2026-10-06T12:00:00-03:00", "a")])!), "6/11/2026", "un cobro da un mes");
igual(
  fechaAR(vigenteHasta([cobro("2026-10-06T12:00:00-03:00", "a"), cobro("2026-10-20T12:00:00-03:00", "b")])!),
  "6/12/2026",
  "pagar antes de vencer suma desde el vencimiento: no se pierden días",
);
igual(
  fechaAR(vigenteHasta([cobro("2026-10-06T12:00:00-03:00", "a"), cobro("2027-01-10T12:00:00-03:00", "b")])!),
  "10/2/2027",
  "pagar después de vencido cuenta desde el pago: no se regalan los días sin pagar",
);
igual(
  fechaAR(vigenteHasta([cobro("2026-10-20T12:00:00-03:00", "b"), cobro("2026-10-06T12:00:00-03:00", "a")])!),
  "6/12/2026",
  "el orden en que llegan los avisos no cambia el resultado",
);
igual(
  vigenteHasta([cobro("2026-10-06T12:00:00-03:00", "a"), { tipo: "devolucion", fecha: "2026-10-08", eventoId: "r1", anula: "a" }]),
  null,
  "un cobro devuelto no da acceso",
);
igual(
  fechaAR(vigenteHasta([
    cobro("2026-10-06T12:00:00-03:00", "a"),
    cobro("2026-11-06T12:00:00-03:00", "b"),
    { tipo: "contracargo", fecha: "2026-11-20", eventoId: "c1", anula: "b" },
  ])!),
  "6/11/2026",
  "un contracargo saca el mes de ese cobro",
);
igual(vigenteHasta([{ tipo: "rechazo", fecha: "2026-10-06", eventoId: "x" }]), null, "un rechazo no da acceso");

// La gracia: sólo el débito automático vivo.
const v = new Date("2026-11-06T12:00:00-03:00");
igual(fechaAR(accesoHasta(v, "debito", false)!), "16/11/2026", "débito vivo: 10 días de gracia");
igual(fechaAR(accesoHasta(v, "debito", true)!), "6/11/2026", "débito cancelado: hasta lo pagado");
igual(fechaAR(accesoHasta(v, "pago_mensual", false)!), "6/11/2026", "QR o transferencia: sin gracia (se avisa 7 días antes)");
igual(accesoHasta(null, "debito", false), null, "sin pagos no hay gracia");

const ahora = new Date("2026-11-10T12:00:00-03:00");
igual(estadoDeAcceso({ ahora, vigente: new Date("2026-12-01"), acceso: new Date("2026-12-11"), lanzamientoHasta: null }), "activa", "al día");
igual(estadoDeAcceso({ ahora, vigente: new Date("2026-11-06"), acceso: new Date("2026-11-16"), lanzamientoHasta: null }), "en_gracia", "venció el pago pero corre la gracia");
igual(estadoDeAcceso({ ahora, vigente: new Date("2026-11-06"), acceso: new Date("2026-11-06"), lanzamientoHasta: null }), "vencida", "vencida");
igual(estadoDeAcceso({ ahora, vigente: null, acceso: null, lanzamientoHasta: new Date("2026-12-31") }), "lanzamiento", "nunca pagó, pero corre el lanzamiento");
igual(estadoDeAcceso({ ahora, vigente: null, acceso: null, lanzamientoHasta: new Date("2026-10-31") }), "sin_suscripcion", "terminó el lanzamiento y nunca pagó");
igual(
  textoDeAcceso("lanzamiento", { lanzamientoHasta: new Date("2026-12-31T12:00:00-03:00") }),
  "Cotizar es gratis durante el lanzamiento, hasta el 31/12/2026.",
  "el texto del lanzamiento dice hasta cuándo",
);
igual(textoDeAcceso("sin_suscripcion").includes("suscripción activa"), true, "sin suscripción: el motivo, sin precio ni enlace");

// Transferencias: el código del concepto y la tolerancia del dólar.
igual(codigoDeTransferencia(37), "PP-0037", "el código tiene 4 cifras como mínimo");
for (const concepto of ["PP-0037", "pago pp0037 octubre", "Transf. PP 37", "VARIOS PP_0037", "pp-37"]) {
  igual(codigoEnTexto(concepto), "PP-0037", `el código se encuentra en ${JSON.stringify(concepto)}`);
}
igual(codigoEnTexto("APP-0037"), null, "no lo confunde dentro de otra palabra");
igual(codigoEnTexto("sin código"), null, "sin código");
igual(codigoEnTexto(undefined), null, "sin concepto");
igual(transferenciaAlcanza(7700, 7700), true, "el monto exacto alcanza");
igual(transferenciaAlcanza(7547, 7700), true, "el 98 % alcanza: el dólar se movió");
igual(transferenciaAlcanza(7469, 7700), true, "el 97 % justo alcanza");
igual(transferenciaAlcanza(6930, 7700), false, "el 90 % no alcanza: queda para revisar a mano");
igual(transferenciaAlcanza(Number.NaN, 7700), false, "un monto ilegible no alcanza");

// El resumen va AL FINAL: estuvo en el medio y las pruebas de imágenes que se agregaron
// debajo no corrían nunca — el archivo decía "todo en verde" y salía antes de llegar.
console.log(fallas === 0 ? "reglas de negocio: todo en verde" : `reglas de negocio: ${fallas} fallas`);
process.exit(fallas ? 1 : 0);
