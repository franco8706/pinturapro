/**
 * ¿Este texto trae una forma de contacto?
 *
 * En Pintura Pro el teléfono del pintor se le comparte al cliente cuando ACEPTA una
 * cotización, y el del cliente al pintor en ese mismo momento (migración 0011). La nota de
 * la cotización se ve antes: un pintor puso ahí su WhatsApp y su mail, y el cliente los vio
 * sin haber aceptado nada (abuso-marketplace, 2/10/2026). Es la forma de saltearse la
 * plataforma entera, y del lado del cliente ya había un aviso equivalente ("poné el barrio,
 * no la dirección"); del lado del pintor, nada.
 *
 * Detecta lo evidente y prefiere dejar pasar a rechazar de más: una nota habla de montos,
 * metros y fechas, que también son números.
 */
export function contactoEnTexto(texto: unknown): "un teléfono" | "un email" | "un enlace" | "un contacto de WhatsApp" | null {
  if (typeof texto !== "string" || !texto) return null;
  if (/[\w.+-]+@[\w-]+\.[\w.-]+/.test(texto)) return "un email";
  if (/https?:\/\/|www\.|\bwa\.me\b/i.test(texto)) return "un enlace";
  if (/\b(whats?app|wh?atsap|wsp|wpp|guasap)\b/i.test(texto)) return "un contacto de WhatsApp";
  // Ocho o más dígitos, separados a lo sumo por espacios, guiones o paréntesis. Los PUNTOS no
  // cuentan como separador: así "1.500.000" (un monto) no se confunde con un teléfono, y
  // "11 4444-5555" o "+54 9 11 4444 5555" sí. Las fechas ("15-08-2026") también suman ocho
  // dígitos con guiones, así que se sacan antes.
  const sinFechas = texto.replace(/\b\d{1,2}[-/]\d{1,2}[-/]\d{2,4}\b/g, " ");
  for (const tramo of sinFechas.match(/\+?\d[\d\s\-()]{6,}\d/g) ?? []) {
    if (tramo.replace(/\D/g, "").length >= 8) return "un teléfono";
  }
  return null;
}
