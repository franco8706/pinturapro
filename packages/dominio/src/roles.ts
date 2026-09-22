/**
 * Quién puede hacer qué. Espejo de `public.es_pintor()` (migración 0016).
 *
 * La base es la barrera de verdad: la clave anon viaja en el navegador y en el teléfono, así
 * que cualquiera puede escribir por la API salteándose la interfaz. Esto sirve para que la
 * pantalla no ofrezca lo que el servidor va a rechazar, y para poder explicar el motivo en
 * lugar de mostrar el error genérico de permisos.
 */
export type TipoDePerfil = "client" | "painter" | "company";

/** Cotizar y publicar obras de portfolio son del lado de la oferta. */
export function puedeCotizar(tipo: TipoDePerfil | null | undefined): boolean {
  return tipo === "painter" || tipo === "company";
}

export function puedePublicarObra(tipo: TipoDePerfil | null | undefined): boolean {
  return puedeCotizar(tipo);
}

/** El texto que ve alguien que no puede cotizar. Uno solo, para web y móvil. */
export const MOTIVO_NO_PUEDE_COTIZAR =
  "Las cotizaciones las envían los pintores. Tu cuenta es de cliente.";
