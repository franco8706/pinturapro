// Barrera de build: si alguien importa este módulo desde un componente cliente, el build
// falla acá en vez de meter la service-role key en el bundle del navegador.
import "server-only";

import { createClient } from "@supabase/supabase-js";
import type { Database } from "./types";

/**
 * Cliente con SERVICE ROLE (bypassa RLS). SOLO servidor — nunca importar en código cliente.
 * Lo usamos para subir archivos a Storage desde Server Actions, después de validar la sesión.
 */
export function createAdminClient() {
  return createClient<Database>(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
