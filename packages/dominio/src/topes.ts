/**
 * Topes de largo de los textos, espejo exacto de los check constraints de la migración 0017.
 *
 * La base es la barrera de verdad; esto sirve para avisar ANTES de que la persona escriba
 * 2.000 caracteres y recién al enviar se entere. Si alguno cambia en la base, cambia acá.
 */
export const TOPES = {
  titulo: 120,
  descripcion: 2000,
  ubicacion: 120,
  bio: 1200,
  nombre: 120,
  notaCotizacion: 1200,
  comentarioResena: 1200,
  mensaje: 4000,
  email: 200,
  telefono: 40,
} as const;

export type CampoConTope = keyof typeof TOPES;

const NOMBRE_LEGIBLE: Record<CampoConTope, string> = {
  titulo: "El título",
  descripcion: "La descripción",
  ubicacion: "La ubicación",
  bio: "La descripción del perfil",
  nombre: "El nombre",
  notaCotizacion: "El mensaje de la cotización",
  comentarioResena: "El comentario",
  mensaje: "El mensaje",
  email: "El email",
  telefono: "El teléfono",
};

/** Devuelve el primer error de largo, o null si está todo bien. */
export function revisarLargos(campos: Partial<Record<CampoConTope, string | null | undefined>>): string | null {
  for (const [campo, valor] of Object.entries(campos) as [CampoConTope, string | null | undefined][]) {
    const largo = (valor ?? "").length;
    if (largo > TOPES[campo]) {
      return `${NOMBRE_LEGIBLE[campo]} no puede superar los ${TOPES[campo]} caracteres.`;
    }
  }
  return null;
}
