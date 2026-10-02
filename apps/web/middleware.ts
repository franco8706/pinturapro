import { type NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";

/**
 * Rutas donde el middleware NO valida la sesión, porque sería hacerlo dos veces o para nada.
 *
 * Validar es una llamada a Supabase Auth. Una visita CON sesión a cualquier página costaba
 * tres: el middleware en la página, el middleware en /api/sesion (que la barra pide en cada
 * página) y el propio /api/sesion, que valida por su cuenta (medido por `sesiones-y-acceso`,
 * 1/10). La del medio era pura repetición. Quien no tiene sesión no genera ninguna.
 *
 * Por qué NO se saltea también en las páginas públicas, aunque sus datos salgan de la caché:
 * la portada y el perfil del pintor leen la sesión para mostrar el autor de las reseñas
 * (`conNombresDeAutores`). Si la sesión justo venció, esa lectura la renueva — pero un Server
 * Component no puede guardar la cookie nueva. El navegador se quedaría con el permiso viejo y
 * Supabase, al verlo usado de nuevo, puede cerrar todas las sesiones de la persona. El
 * middleware es quien renueva y guarda ANTES de que la página lea.
 */
const SIN_VALIDAR = new Set(["/api/sesion", "/api/health", "/og.png", "/sitemap.xml", "/robots.txt"]);

/**
 * Refresca la sesión de Supabase (necesario con SSR: un Server Component no puede escribir
 * cookies, así que la sesión tiene que llegar renovada).
 * Si todavía no hay proyecto configurado (sin env), no hace nada → no rompe la app.
 */
export async function middleware(request: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anon) return NextResponse.next();
  if (SIN_VALIDAR.has(request.nextUrl.pathname)) return NextResponse.next();

  let response = NextResponse.next({ request });

  const supabase = createServerClient(url, anon, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });

  // Importante: no metas lógica entre crear el cliente y getUser() (refresca el token).
  await supabase.auth.getUser();
  return response;
}

export const config = {
  // Corre en todo menos assets estáticos.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
