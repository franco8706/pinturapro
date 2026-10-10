/**
 * Pruebas del paquete de reglas. Se corren sin navegador y sin base:
 *   node packages/dominio/pruebas.ts
 *
 * Node 22+ ejecuta TypeScript directamente, así que no hace falta compilar nada. Las
 * importaciones llevan la extensión `.ts` porque node la exige; el `index.ts` del paquete no,
 * porque ahí resuelve el empaquetador de cada app.
 */
import { montoDesdeTexto, motivoMontoInvalido, motivoCotizacionInvalida } from "./src/montos.ts";
import { contactoEnTexto } from "./src/contacto.ts";
import { dimensionesDeImagen, motivoImagenDesmedida } from "./src/imagen.ts";
import { revisarLargos, TOPES } from "./src/topes.ts";
import { mensajeDeError } from "./src/errores.ts";
import { puedeCotizar } from "./src/roles.ts";
import { superficieDesdeTexto, aniosDesdeTexto } from "./src/medidas.ts";
import {
  precioEnPesos, evaluarCotizacion, vigenteHasta, accesoHasta, estadoDeAcceso, textoDeAcceso,
  fechaAR, sumarMes, codigoDeTransferencia, codigoEnTexto, codigosEnTexto, transferenciaAlcanza, type Movimiento,
} from "./src/suscripcion.ts";

// `src/extracto.ts` importa a `./suscripcion` sin extensión (como lo resuelve el empaquetador de
// cada app); node la exige, así que se le enseña a probar con `.ts`, como en packages/color.
import { registerHooks } from "node:module";
registerHooks({
  resolve(especificador, contexto, siguiente) {
    try {
      return siguiente(especificador, contexto);
    } catch (e) {
      if (especificador.startsWith(".") && !especificador.endsWith(".ts")) return siguiente(`${especificador}.ts`, contexto);
      throw e;
    }
  },
});

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
igual(evaluarCotizacion(15400, null, null)?.estado, "a_confirmar", "la primera de todas sin fuente de control: la confirma el dueño");
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
for (const concepto of ["PP-0037", "pago pp0037 octubre", "Transf. PP 0037", "VARIOS PP_0037", "PP\u20130037", "PP - 0037"]) {
  igual(codigoEnTexto(concepto), "PP-0037", `el código se encuentra en ${JSON.stringify(concepto)}`);
}
// Sólo la forma exacta: con un dígito de menos o de más era el código de OTRO pintor (8/10/2026).
for (const concepto of ["PP-003", "PP-00371", "PAGO PP 3 CUOTAS", "Transf. PP 37", "PP-0000"]) {
  igual(codigoEnTexto(concepto), null, `${JSON.stringify(concepto)} no es el código de nadie`);
}
igual(codigosEnTexto("PP-0001 y PP-0037"), ["PP-0001", "PP-0037"], "dos códigos en el mismo concepto: se ven los dos");
igual(codigoEnTexto("PP-12345"), "PP-12345", "los códigos de más de 4 cifras");
igual(codigoEnTexto("APP-0037"), null, "no lo confunde dentro de otra palabra");
igual(codigoEnTexto("sin código"), null, "sin código");
igual(codigoEnTexto(undefined), null, "sin concepto");
igual(transferenciaAlcanza(7700, 7700), true, "el monto exacto alcanza");
igual(transferenciaAlcanza(7547, 7700), true, "el 98 % alcanza: el dólar se movió");
igual(transferenciaAlcanza(7469, 7700), true, "el 97 % justo alcanza");
igual(transferenciaAlcanza(6930, 7700), false, "el 90 % no alcanza: queda para revisar a mano");
igual(transferenciaAlcanza(Number.NaN, 7700), false, "un monto ilegible no alcanza");

// Los mensajes de la migración 0027 llegan traducidos.
igual(mensajeDeError({ code: "P0001", message: "Necesitás una suscripción activa para cotizar" }).includes("Mi plan"), true, "sin suscripción: dice dónde activarla");
igual(mensajeDeError({ code: "P0001", message: "Una cotización enviada no se edita: retirala y mandá otra" }), "Una cotización enviada no se edita: retirala y mandá otra.", "cotización enviada");
igual(mensajeDeError({ code: "P0001", message: "No se puede cambiar quién es parte del trabajo" }).includes("quién participa"), true, "partes del trabajo");
igual(mensajeDeError({ code: "P0001", message: "Ese pedido ya no está disponible" }), "Ese pedido ya no está disponible.", "pedido borrado");

// ── Los meses seguidos no se corren con los fines de mes ──
{
  // Pagó el 31/1 y después cada mes justo el día que vencía: 12 pagos llegan al 31/1 siguiente.
  const fechas = ["2027-01-31", "2027-02-28", "2027-03-31", "2027-04-30", "2027-05-31", "2027-06-30",
    "2027-07-31", "2027-08-31", "2027-09-30", "2027-10-31", "2027-11-30", "2027-12-31"];
  igual(
    fechaAR(vigenteHasta(fechas.map((f, i) => cobro(`${f}T12:00:00-03:00`, `m${i}`)))!),
    "31/1/2028",
    "12 pagos puntuales desde el 31/1 terminan el 31/1 (encadenados, el 28/1)",
  );
  igual(
    fechaAR(vigenteHasta([cobro("2027-01-31T12:00:00-03:00", "a"), cobro("2027-02-10T12:00:00-03:00", "b")])!),
    "31/3/2027",
    "pagar antes del vencimiento suma el mes desde el día de la racha (31/3, no 28/3)",
  );
}

// ── El mes pago no arranca antes del fin del lanzamiento ──
igual(
  fechaAR(vigenteHasta([cobro("2026-11-10T12:00:00-03:00", "a")], { desde: "2026-12-01T00:00:00-03:00" })!),
  "1/1/2027",
  "pagar durante el lanzamiento no gasta el mes en días que ya eran gratis",
);
igual(
  fechaAR(vigenteHasta([cobro("2026-12-10T12:00:00-03:00", "a")], { desde: "2026-12-01T00:00:00-03:00" })!),
  "10/1/2027",
  "después del lanzamiento, el mes cuenta desde el pago",
);

// ── El extracto del banco ──
const { leerExtracto, analizarExtracto, montoDeExtracto, fechaDeExtracto } = await import("./src/extracto.ts");
igual(montoDeExtracto("(7.547,00"), null, "un paréntesis sin cerrar no es un monto (se leía +7.547)");
igual(montoDeExtracto("(7.547,00)"), -7547, "entre paréntesis es negativo");
igual(montoDeExtracto("0.500"), 0.5, "0.500 es medio peso, no quinientos");
igual(fechaDeExtracto("08/10/2026")?.toISOString(), "2026-10-08T03:00:00.000Z", "fecha argentina: el comienzo del día en Argentina");
igual(fechaDeExtracto("2026-10-08 14:33")?.toISOString(), "2026-10-08T03:00:00.000Z", "fecha ISO con hora");
igual(fechaDeExtracto("8-10-26")?.toISOString(), "2026-10-08T03:00:00.000Z", "año de dos cifras");
igual(fechaDeExtracto("31/02/2026"), null, "el 31 de febrero no existe");
igual(fechaDeExtracto("hola"), null, "no es una fecha");
igual(montoDeExtracto("7.700,00"), 7700, "monto argentino con decimales");
igual(montoDeExtracto("7700,50"), 7700.5, "coma decimal sin miles");
igual(montoDeExtracto("$ 1.234"), 1234, "signo pesos y punto de miles");
igual(montoDeExtracto("1,234.56"), 1234.56, "formato inglés de un banco que exporta así");
igual(montoDeExtracto("-500,00"), -500, "un débito negativo");
igual(montoDeExtracto("abc"), null, "no es un monto");
igual(montoDeExtracto(""), null, "vacío");

const csvPuntoYComa = [
  "Banco de Prueba - Movimientos",
  "Fecha;Concepto;Débito;Crédito;Saldo",
  "06/10/2026;TRANSF RECIBIDA PP-0037 JUAN PEREZ;;7.700,00;107.700,00",
  "06/10/2026;COMISION MANTENIMIENTO;1.500,00;;106.200,00",
  "07/10/2026;\"TRANSF RECIBIDA pp0037; octubre\";;7.547,00;113.747,00",
  "07/10/2026;TRANSF RECIBIDA SIN CODIGO;;5.000,00;118.747,00",
].join("\n");
const lineas = leerExtracto(csvPuntoYComa);
igual(lineas.length, 3, "del extracto con ; salen sólo los créditos (no la comisión del banco)");
igual(lineas.map((l) => [l.codigo, l.monto]), [["PP-0037", 7700], ["PP-0037", 7547], [null, 5000]], "códigos y montos del extracto con ;");
igual(lineas[0].fecha, "06/10/2026", "la fecha de la línea");

const csvComa = ["Fecha,Descripcion,Importe", "2026-10-06,Transferencia de PP-0102,\"7,700.00\"", "2026-10-06,Pago tarjeta,-3000"].join("\r\n");
igual(leerExtracto(csvComa).map((l) => [l.codigo, l.monto]), [["PP-0102", 7700]], "extracto con coma e importe con signo: los débitos negativos no cuentan");
igual(leerExtracto("sin,encabezados\n1,2"), [], "sin columna de monto no se inventa nada");
igual(lineas.map((l) => l.saldoCierra), [true, true, true], "con saldo, cada crédito cierra con el de al lado");
igual(leerExtracto(csvComa)[0].saldoCierra, null, "sin columna de saldo no hay cómo comprobar");

// Los ataques de abuso-marketplace y dinero-y-comisiones (8/10/2026). El concepto lo escribe el
// que transfiere y termina adentro del CSV.
const encA = "Fecha;Referencia;Importe;Saldo";
{
  // $1 reales con la referencia "PP-0037;7700,00": el banco no escapa el ; y las columnas se corren.
  const r = analizarExtracto([encA, "08/10/2026;PP-0037;7700,00;1,00;1.234.567,89"].join("\n"));
  igual([r.creditos.length, r.ilegibles], [0, 1], "una línea con otra cantidad de columnas no se lee ($1 se leía $7.700)");
}
{
  // 30 comas en una referencia de las primeras líneas daban vuelta el separador: 0 créditos.
  const r = analizarExtracto([
    "Fecha;Referencia;Débito;Crédito;Saldo",
    "08/10/2026;PP-0001;;7.700,00;100.000,00",
    `08/10/2026;PP-0002 ${",".repeat(30)};;1,00;100.001,00`,
    "08/10/2026;PP-0003;;7.700,00;107.701,00",
  ].join("\n"));
  igual(r.creditos.map((l) => [l.codigo, l.monto, l.saldoCierra]), [["PP-0001", 7700, true], ["PP-0002", 1, true], ["PP-0003", 7700, true]], "las comas en un concepto no cambian el separador");
}
igual(analizarExtracto([encA, "08/10/2026;PP-0037;99999999999999;1.234.567,89"].join("\n")).ilegibles, 1, "un importe imposible no se lee (rompía la carga entera)");
{
  // Un salto de línea en la referencia mete una línea entera inventada, con las columnas justas.
  // No cierra con el saldo: el saldo real de después es el de antes + $1.
  const r = analizarExtracto([
    encA,
    "07/10/2026;ALQUILER;-50.000,00;150.000,00",
    "08/10/2026;x;;5000",
    "08/10/2026;PP-0037;7.700,00;12.700,00",
    "z;w;1,00;150.001,00",
  ].join("\n"));
  const falsa = r.creditos.find((l) => l.codigo === "PP-0037");
  igual(falsa?.saldoCierra, false, "una línea inventada no cierra con el saldo");
}
{
  // Importe sin signo y una columna "Tipo": un débito se leería como pago. El saldo baja: no cierra.
  const r = analizarExtracto([
    "Fecha;Concepto;Tipo;Importe;Saldo",
    "08/10/2026;TRANSF PP-0037;Crédito;7.700,00;107.700,00",
    "08/10/2026;PAGO PROVEEDOR PP-0001;Débito;20.000,00;87.700,00",
  ].join("\n"));
  igual(r.creditos.map((l) => [l.codigo, l.saldoCierra]), [["PP-0037", true]], "con la columna Tipo, un débito sin signo es un débito");
  const sinTipo = analizarExtracto([
    "Fecha;Concepto;Importe;Saldo",
    "08/10/2026;TRANSF PP-0037;7.700,00;107.700,00",
    "08/10/2026;PAGO PROVEEDOR PP-0001;20.000,00;87.700,00",
  ].join("\n"));
  igual(sinTipo.creditos.map((l) => l.saldoCierra), [false, false], "sin Tipo, un débito sin signo leído como pago no cierra, y nada se confirma solo");
}
igual(analizarExtracto([encA, "08/10/2026;PP-0037;7.700,00;107.700,00"].join("\n")).creditos[0].saldoCierra, false, "un solo movimiento: no hay saldo con qué comprobarlo");
igual(analizarExtracto([encA, "08/10/2026;PP-0037;7.700,00;107.700,00", "08/10/2026;PP-0037;7.700,00;115.400,00"].join("\n")).creditos.map((l) => l.ocurrencia), [1, 1], "con saldo distinto, dos líneas distintas");
igual(analizarExtracto(["Fecha,Concepto,Importe", "08/10/2026,PP-0037,7700", "08/10/2026,PP-0037,7700"].join("\n")).creditos.map((l) => l.ocurrencia), [1, 2], "dos transferencias iguales el mismo día: dos pagos");
igual(analizarExtracto([encA, "08/10/2026;PP-0001 PP-0037;7.700,00;107.700,00", "09/10/2026;X;-1,00;107.699,00"].join("\n")).creditos[0].sospecha?.includes("más de un código"), true, "dos códigos en una línea: no se confirma sola");
igual(analizarExtracto([
  "Banco X;Total créditos: 15.000,00;Ingresos: 2",
  "Fecha;Concepto;Cr\uFFFDdito;Saldo",
  "08/10/2026;PP-0037;7.700,00;107.700,00",
].join("\n")).creditos.length, 1, "un renglón del resumen con 'créditos' no es el encabezado, y la tilde de Latin-1 se reconoce");
igual(leerExtracto(undefined), [], "sin archivo");

// El resumen va AL FINAL: estuvo en el medio y las pruebas de imágenes que se agregaron
// debajo no corrían nunca — el archivo decía "todo en verde" y salía antes de llegar.
console.log(fallas === 0 ? "reglas de negocio: todo en verde" : `reglas de negocio: ${fallas} fallas`);
process.exit(fallas ? 1 : 0);
