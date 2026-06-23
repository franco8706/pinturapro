import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/** Cierra la sesión y vuelve al inicio. Se llama con un <form method="post">. */
export async function POST(request: Request) {
  if (process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    const supabase = await createClient();
    await supabase.auth.signOut();
  }
  return NextResponse.redirect(new URL("/", request.url), { status: 303 });
}
