import { NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { actualizarCotizacion } from "@/lib/pagos/cotizacion";
import { olvidar, ETIQUETAS } from "@/lib/cache-publico";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * La tarea que sigue el dólar (ver `lib/pagos/cotizacion.ts`). La dispara Cloud Scheduler
 * 3 veces por día hábil con `Authorization: Bearer <COTIZACION_TOKEN>`; nadie más.
 *
 * Sin el token configurado responde 503 (no 200): una tarea que "anda" sin hacer nada es la
 * que nadie revisa. Con un token equivocado, 401, comparado en tiempo constante.
 */
function autorizado(request: Request): boolean {
  const esperado = process.env.COTIZACION_TOKEN ?? "";
  const recibido = (request.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
  if (!esperado || !recibido) return false;
  const a = Buffer.from(recibido);
  const b = Buffer.from(esperado);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function POST(request: Request) {
  if (!process.env.COTIZACION_TOKEN || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json({ error: "sin configurar" }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
  if (!autorizado(request)) {
    return NextResponse.json({ error: "no autorizado" }, { status: 401, headers: { "Cache-Control": "no-store" } });
  }
  const resultado = await actualizarCotizacion();
  // El precio en pesos de "Mi plan" y del aviso de /trabajos sale de la cotización vigente.
  if (resultado.guardada) olvidar(ETIQUETAS.cobro);
  return NextResponse.json(resultado, { status: 200, headers: { "Cache-Control": "no-store" } });
}
