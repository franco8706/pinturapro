import "server-only";

import { revalidateTag, unstable_cache } from "next/cache";

/**
 * Caché de los datos públicos: lo que ve cualquiera sin cuenta se lee de Supabase como mucho
 * una vez por minuto, no una vez por visita.
 *
 * Antes, cada visita a la portada, /pintores, /obras o un perfil hacía entre una y cuatro
 * consultas a la base. A 100.000 visitas por día eso es la base del plan entero trabajando
 * para devolver siempre lo mismo, y la portada tardaba 1,6 s con 50 visitas a la vez
 * (`escala-y-volumen`, 28/9).
 *
 * Por qué caché de DATOS y no páginas estáticas: una página estática se arma al compilar, y
 * eso pediría la base en el momento del despliegue. Si ese día Supabase está pausado o lento,
 * la versión no sale — la misma fragilidad que ya dio el build con las tipografías de Google.
 * Así, la página se sigue armando en cada visita (es barato) y sólo los datos se reutilizan.
 *
 * Un error de la base NO se guarda: `unstable_cache` no guarda lo que lanza una excepción, y
 * las lecturas que fallan lanzan `ErrorDeLecturaDeDatos`.
 */
export const SEGUNDOS_PUBLICO = 60;

/** Qué se invalida cuando alguien cambia algo público. */
export const ETIQUETAS = {
  pintores: "publico:pintores",
  obras: "publico:obras",
  resenas: "publico:resenas",
  trabajos: "publico:trabajos",
  contenido: "publico:contenido",
} as const;

type Etiqueta = (typeof ETIQUETAS)[keyof typeof ETIQUETAS];

/** Envuelve una lectura pública. Los argumentos forman parte de la clave. */
export function publico<A extends unknown[], R>(
  leer: (...args: A) => Promise<R>,
  clave: string,
  etiquetas: Etiqueta[],
): (...args: A) => Promise<R> {
  return unstable_cache(leer, ["publico", clave], { revalidate: SEGUNDOS_PUBLICO, tags: etiquetas });
}

/**
 * Lo llaman las acciones que cambian algo público, para que quien lo cambió lo vea al
 * instante y no dentro de un minuto (su perfil, su obra, su reseña, su baja).
 */
export function olvidar(...etiquetas: Etiqueta[]) {
  for (const e of etiquetas) revalidateTag(e);
}
