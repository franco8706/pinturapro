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
export { montoDesdeTexto, comisionDe, COMISION, MONTO_MAXIMO } from "./montos";
export { TOPES, revisarLargos, type CampoConTope } from "./topes";
export { mensajeDeError } from "./errores";
export { puedeCotizar, puedePublicarObra, MOTIVO_NO_PUEDE_COTIZAR, type TipoDePerfil } from "./roles";
