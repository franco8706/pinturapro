import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { rutaInternaSegura } from "@/lib/redirect-seguro";

/**
 * Callback de Supabase Auth: intercambia el `code` del link de confirmación de email
 * (o de un proveedor OAuth) por una sesión, y redirige.
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  // `next` viene de la URL, así que lo escribe cualquiera: sin validar, `next=@sitio-malo.com`
  // armaba `https://pinturapro.com@sitio-malo.com` —host real: sitio-malo.com— y
  // `next=https://...` hacía reventar new URL() con un 500.
  const next = rutaInternaSegura(searchParams.get("next"), "/");

  if (code && process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(`${origin}${next}`);
    // El caso más común acá no es un ataque: es abrir el link del mail en OTRO dispositivo.
    // El flujo PKCE deja el `code_verifier` en una cookie del navegador donde te registraste,
    // así que el intercambio falla. `motivo` permite explicarlo en vez de mostrar el
    // formulario pelado, que era lo que pasaba.
    return NextResponse.redirect(`${origin}/ingresar?error=auth&motivo=enlace`);
  }

  return NextResponse.redirect(`${origin}/ingresar?error=auth`);
}
