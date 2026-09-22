/**
 * La traducción de errores de la base vive ahora en `@pinturapro/dominio`, compartida con la
 * app móvil: tener dos copias fue exactamente el problema —la del móvil se quedó sin las
 * ramas del tope de largo, del pedido ya adjudicado y del deadlock—.
 *
 * Este archivo queda como puerta de entrada para no tocar los diez lugares que ya lo
 * importaban.
 */
export { mensajeDeError } from "@pinturapro/dominio";
