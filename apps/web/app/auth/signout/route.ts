import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/** Cierra la sesión y vuelve al inicio. Se llama con un <form method="post">. */
export async function POST(request: Request) {
  if (process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    const supabase = await createClient();
    // `scope: "local"` cierra ESTA sesión, no todas. El default de auth-js es "global", así
    // que apretar "Salir" en la computadora del trabajo también te deslogueaba del celular,
    // sin avisar. Cerrar sesión en todos lados es una acción distinta y debería pedirse aparte.
    await supabase.auth.signOut({ scope: "local" });
  }
  return NextResponse.redirect(new URL("/", request.url), { status: 303 });
}
