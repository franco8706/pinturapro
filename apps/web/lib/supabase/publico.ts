import "server-only";

import { createClient } from "@supabase/supabase-js";
import type { Database } from "./types";

/**
 * Cliente de Supabase SIN cookies, para leer lo que es igual para todos: el directorio de
 * pintores, las obras, las reseñas, el contenido.
 *
 * Por qué existe: el cliente de `server.ts` lee las cookies, y en Next leer cookies vuelve
 * privada la respuesta entera. Las nueve páginas públicas salían con `Cache-Control: private,
 * no-store` y consultaban la base en CADA visita, aunque le mostraran lo mismo a todos
 * (medido por `escala-y-volumen`, 28/9). Con este cliente sus datos se pueden guardar en
 * caché (ver `lib/cache-publico.ts`).
 *
 * Lee como `anon`, y eso es a propósito: lo que devuelve es exactamente lo que ve un visitante
 * sin cuenta. Nunca usarlo para algo que dependa de quién mira.
 */
export function createPublicClient() {
  return createClient<Database>(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}
