/**
 * Lo que llega de afuera, antes de tocarlo.
 *
 * Las Server Actions de Next se ven como funciones normales —`eliminarMiCuenta(texto)`— y por
 * eso es fácil olvidarse de que en realidad son un endpoint HTTP: cualquiera con una sesión
 * puede llamarlas con el cuerpo que se le ocurra, y TypeScript no está ahí para impedirlo.
 * El tipo del parámetro dice `string`; lo que llega puede ser `null`, un número o un objeto.
 *
 * Medido en este proyecto: mandarle `[null]` a la acción de dar de baja la cuenta rompía con
 * `Cannot read properties of null (reading 'trim')` y devolvía 500. En desarrollo la
 * respuesta traía además el nombre del error, el mensaje y la ruta interna del archivo; en
 * producción Next los reemplaza por un identificador, así que ahí la fuga no existe, pero el
 * 500 sí. Un error que la persona no causó y no puede entender.
 *
 * La regla: antes de llamar a un método sobre un argumento que vino de la red, se comprueba
 * que sea lo que se dice que es.
 */

/** ¿Esto que llegó es realmente texto? */
export function esTexto(valor: unknown): valor is string {
  return typeof valor === "string";
}

/**
 * Texto recortado, o `null` si lo que llegó no era texto.
 *
 * Devuelve `null` y no `""` a propósito: quien llama tiene que decidir qué contestar, y "no
 * mandaste nada" y "mandaste cualquier cosa" suelen merecer el mismo mensaje pero nunca un
 * crash.
 */
export function textoRecibido(valor: unknown, largoMaximo = 4000): string | null {
  if (!esTexto(valor)) return null;
  return valor.trim().slice(0, largoMaximo);
}

/**
 * ¿Esto que llegó es realmente un formulario?
 *
 * Las acciones que reciben `FormData` tienen el mismo agujero que las que reciben texto, y es
 * peor porque son casi todas: llamarlas con `null` o con un objeto cualquiera rompe en el
 * primer `formData.get(...)`. Medido en `/contacto`: los siete cuerpos imposibles que prueba
 * la auditoría devolvían 500, uno por uno.
 */
export function esFormulario(valor: unknown): valor is FormData {
  return typeof FormData !== "undefined" && valor instanceof FormData;
}
