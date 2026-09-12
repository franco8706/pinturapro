import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/health — ¿la base responde de verdad?
 *
 * Existe porque el resto del sitio miente cuando Supabase falla: las páginas devuelven 200 y
 * sirven mocks o listas vacías. Este endpoint es el canario, y es la única ruta sin respaldo.
 *
 * Antes probaba SÓLO `profiles`, y eso lo dejaba ciego justo donde ocurrieron los dos
 * incidentes reales de este proyecto: los dos fueron permisos mal puestos sobre UNA tabla o
 * UNA función, con el resto de la base perfecta. En esa situación el endpoint decía "ok"
 * mientras un pintor con nueve trabajos leía "todavía no tenés trabajos".
 *
 * Ahora prueba una superficie de cada tipo —tablas y funciones `security definer`— y reporta
 * cuál falló. No expone detalle de infraestructura: sólo el nombre de la sonda y el estado.
 */

/** Cada sonda cubre un permiso distinto; si una sola falla, el sitio ya está mintiendo. */
const SONDAS = [
  { nombre: "profiles", tipo: "tabla" as const },
  { nombre: "projects", tipo: "tabla" as const },
  { nombre: "jobs", tipo: "tabla" as const },
  { nombre: "reviews", tipo: "tabla" as const },
  // Las funciones tienen su propio GRANT, que es exactamente lo que se rompió dos veces.
  { nombre: "pedidos_abiertos", tipo: "funcion" as const, args: { limite: 1 } },
  { nombre: "pintores_geolocalizados", tipo: "funcion" as const, args: {} },
];

const TIMEOUT_MS = 8_000;

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

    // Con timeout: sin esto, una base lenta deja al monitor colgado en vez de avisar.
    const conTimeout = <T,>(p: PromiseLike<T>): Promise<T | "timeout"> =>
      Promise.race([
        Promise.resolve(p),
        new Promise<"timeout">((r) => setTimeout(() => r("timeout"), TIMEOUT_MS)),
      ]);

    const resultados = await Promise.all(
      SONDAS.map(async (s) => {
        const r = await conTimeout(
          s.tipo === "tabla"
            ? supabase.from(s.nombre).select("id", { count: "exact", head: true }).limit(1)
            : supabase.rpc(s.nombre as never, (s.args ?? {}) as never),
        );
        if (r === "timeout") return { nombre: s.nombre, ok: false, motivo: "timeout" };
        const error = (r as { error: { message?: string } | null }).error;
        return { nombre: s.nombre, ok: !error, motivo: error?.message };
      }),
    );

    const ms = Date.now() - started;
    const fallaron = resultados.filter((r) => !r.ok);

    if (fallaron.length > 0) {
      // El motivo va al log del servidor, no a la respuesta: puede traer nombres de tablas.
      for (const f of fallaron) console.error(`[health] sonda "${f.nombre}" falló: ${f.motivo}`);
      return NextResponse.json(
        {
          status: fallaron.length === resultados.length ? "down" : "degraded",
          database: fallaron.length === resultados.length ? "inalcanzable" : "parcial",
          // Qué sondas fallaron sí se dice: es lo que hace accionable la alerta.
          failing: fallaron.map((f) => f.nombre),
          servingMockData: true,
          latencyMs: ms,
        },
        { status: 503, headers: { "Cache-Control": "no-store" } },
      );
    }

    return NextResponse.json(
      { status: "ok", database: "up", checks: resultados.length, servingMockData: false, latencyMs: ms },
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
