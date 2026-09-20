/**
 * Motor de color del simulador de Pintura Pro.
 *
 * Está fuera de `apps/web` a propósito: son dos cosas que no dependen del navegador ni de
 * React —elegir qué superficie se pinta y cómo se ve la pintura encima— y las va a necesitar
 * también la app móvil. Mientras vivían dentro de la web, la única forma de reusarlas era
 * copiarlas, que es como se empiezan a desincronizar dos versiones del mismo algoritmo.
 *
 * La única entrada que pide es una `ImageData`; no toca el DOM, no hace red y no sabe nada
 * de la interfaz.
 */
export { prepareWandImage, magicWand } from "./magic-wand";
export type { WandImage, WandOptions } from "./magic-wand";
export { rgbAOklab, rgbAOkL, rgbAOklch, oklchASrgb, oklabASrgb } from "./oklab";
