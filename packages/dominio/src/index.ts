/**
 * Reglas de negocio de Pintura Pro, compartidas por la web y la app móvil.
 *
 * Por qué existe: las dos apps tenían copias separadas de las mismas reglas, y sólo una se
 * mantenía. La app móvil quedó con un parser de montos que convertía "150.000,50" en
 * $15.000.050 —cien veces más— nueve meses después de que la web lo arreglara. Una regla de
 * plata que vive en dos lados es una regla que tarde o temprano dice dos cosas distintas.
 *
 * Acá no hay nada de React, ni de Next, ni de la base: entra un dato, sale un dato. Se puede
 * probar sin levantar nada (`node packages/dominio/pruebas.ts`).
 */
export {
  montoDesdeTexto,
  motivoMontoInvalido,
  motivoCotizacionInvalida,
  MONTO_MAXIMO,
  COTIZACION_MINIMA,
} from "./montos";
export { contactoEnTexto } from "./contacto";
export { TOPES, revisarLargos, type CampoConTope } from "./topes";
export { mensajeDeError } from "./errores";
export { puedeCotizar, puedePublicarObra, MOTIVO_NO_PUEDE_COTIZAR, type TipoDePerfil } from "./roles";
export { esTexto, textoRecibido, esFormulario } from "./entrada";
export { dimensionesDeImagen, motivoImagenDesmedida, MAXIMO_MEGAPIXELES, MAXIMO_LADO } from "./imagen";
export { superficieDesdeTexto, aniosDesdeTexto, SUPERFICIE_MAXIMA, TOPE_POR_HORA } from "./medidas";
// La plataforma no cobra comisión por trabajo (6/10/2026): el pintor paga una suscripción.
export {
  precioEnPesos,
  evaluarCotizacion,
  vigenteHasta,
  accesoHasta,
  estadoDeAcceso,
  textoDeAcceso,
  fechaAR,
  sumarMes,
  sumarDias,
  codigoDeTransferencia,
  codigoEnTexto,
  transferenciaAlcanza,
  MOTIVO_SIN_SUSCRIPCION,
  DIAS_DE_GRACIA,
  VALIDEZ_DEL_COBRO_DIAS,
  AVISO_DIAS_ANTES,
  TOLERANCIA_TRANSFERENCIA,
  type EstadoAcceso,
  type EstadoCotizacion,
  type Modalidad,
  type Movimiento,
  type TipoMovimiento,
} from "./suscripcion";
