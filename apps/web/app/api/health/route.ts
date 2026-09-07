import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/health — ¿la base responde de verdad?
 *
 * Existe porque el resto del sitio miente cuando Supabase se cae: las páginas devuelven
 * 200 y sirven los mocks. Este endpoint hace una consulta real y devuelve 503 si falla,
 * así un monitor externo (o vos) se entera. Es la única ruta que NO tiene fallback.
 *
 * No expone detalle de la infraestructura: sólo estado y latencia.
 */
export async function GET() {
  const started = Date.now();

  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    return NextResponse.json(
      { status: "unconfigured", database: "sin credenciales", servingMockData: true },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }

  try {
    const supabase = await createClient();
    // head:true = sólo cuenta, no trae filas. Barato y suficiente para saber si responde.
    const { error } = await supabase.from("profiles").select("id", { count: "exact", head: true }).limit(1);
    const ms = Date.now() - started;

    if (error) {
      console.error(`[health] la base respondió con error: ${error.message}`);
      return NextResponse.json(
        { status: "degraded", database: "error", servingMockData: true, latencyMs: ms },
        { status: 503, headers: { "Cache-Control": "no-store" } },
      );
    }

    return NextResponse.json(
      { status: "ok", database: "up", servingMockData: false, latencyMs: ms },
      { status: 200, headers: { "Cache-Control": "no-store" } },
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error(`[health] no se pudo contactar la base: ${msg}`);
    return NextResponse.json(
      { status: "down", database: "inalcanzable", servingMockData: true, latencyMs: Date.now() - started },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}
