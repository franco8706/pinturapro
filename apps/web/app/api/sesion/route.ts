import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * ¿Hay sesión? Sí o no, y nada más.
 *
 * Existe para que la barra de navegación no tenga que traer el cliente de Supabase al
 * navegador. Lo traía en TODAS las páginas —incluidas /terminos y /privacidad— sólo para
 * elegir entre "Ingresar" y "Mi panel": 52 KB comprimidos (185 KB sin comprimir), medido por
 * el agente `rendimiento` en producción. Acá lo resuelve el servidor, que ya tiene la cookie.
 *
 * No devuelve el email ni ningún dato: la barra no lo muestra, y lo que no se manda no se
 * puede filtrar.
 */
export const dynamic = "force-dynamic";

export async function GET() {
  let sesion = false;
  if (process.env.NEXT_PUBLIC_SUPABASE_URL) {
    try {
      const supabase = await createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      sesion = !!user;
    } catch {
      sesion = false;
    }
  }
  return NextResponse.json({ sesion }, { headers: { "Cache-Control": "no-store" } });
}
