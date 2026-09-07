import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120; // tolera cold start del modelo en Replicate

// ─────────────────────── Límites ───────────────────────
// Cada request de este endpoint crea una predicción en Replicate, que se cobra. Sin sesión
// ni cuota, cualquiera en internet puede vaciar la cuenta a fuerza de POSTs.
const MAX_IMAGE_CHARS = 8_000_000; // ~6MB de foto en base64
const MAX_MASKS = 80; // SAM-2 con points_per_side=32 puede devolver cientos
const MASK_CONCURRENCY = 6; // descargarlas todas a la vez es un pico de memoria
const RATE_LIMIT = { max: 12, windowMs: 60 * 60 * 1000 }; // 12 análisis por hora y usuario

/**
 * Cuota por usuario, en memoria del proceso.
 *
 * Limitación conocida: en serverless cada instancia tiene su propio contador, así que el
 * límite real es `max × instancias`. Alcanza para frenar el abuso trivial; si esto se
 * publica de verdad, moverlo a Upstash/Redis y contar también por IP.
 */
const hits = new Map<string, number[]>();
function overQuota(userId: string): boolean {
  const now = Date.now();
  const recent = (hits.get(userId) ?? []).filter((t) => now - t < RATE_LIMIT.windowMs);
  if (recent.length >= RATE_LIMIT.max) {
    hits.set(userId, recent);
    return true;
  }
  recent.push(now);
  hits.set(userId, recent);
  if (hits.size > 5_000) for (const [k, v] of hits) if (!v.some((t) => now - t < RATE_LIMIT.windowMs)) hits.delete(k);
  return false;
}

/** Ejecuta las tareas de a `limit` en paralelo, en vez de todas juntas. */
async function mapLimit<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let i = 0;
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (i < items.length) {
        const idx = i++;
        out[idx] = await fn(items[idx]);
      }
    }),
  );
  return out;
}

/**
 * POST /api/segment — Segmentación SAM server-side.
 *
 * El cliente envía la foto + el punto del clic; el servidor devuelve una máscara.
 * Soporta dos backends (en este orden de prioridad):
 *
 *   1) SAM_BACKEND_URL  → proxy a un backend propio (FastAPI/SAM, etc.).
 *   2) REPLICATE_API_TOKEN → llama a un modelo SAM en Replicate (sin infra propia).
 *
 * Si no hay ninguno configurado → 503 (el cliente cae al pincel manual).
 *
 * Request body (JSON):
 *   { image: "data:image/jpeg;base64,...", point:{x,y}, width, height }
 *   point.x / point.y normalizados 0..1.
 *
 * Respuesta:
 *   - Replicate (meta/sam-2): JSON { masks: dataURL[] } — TODAS las regiones de la
 *     foto. El cliente elige la que contiene el punto del clic (precisión por clic).
 *   - Backend propio: lo que devuelva (PNG de máscara o JSON).
 *
 * ENV (ver apps/web/.env.example):
 *   SAM_BACKEND_URL, SAM_BACKEND_TOKEN        → backend propio
 *   REPLICATE_API_TOKEN                       → token de Replicate
 *   REPLICATE_DEPLOYMENT ("owner/name")       → deployment tibio (instancia always-on, ~2s)
 *   REPLICATE_VERSION (hash de meta/sam-2)    → fallback sin deployment (cold start)
 *   REPLICATE_POINTS_PER_SIDE (default 16)    → densidad de muestreo (menos = más rápido)
 */
export async function POST(req: NextRequest) {
  // 0) Sesión + cuota. Va PRIMERO: nada que cueste plata corre para un anónimo.
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json(
      { error: "unauthorized", message: "Iniciá sesión para usar el simulador con IA." },
      { status: 401 },
    );
  }
  if (overQuota(user.id)) {
    return NextResponse.json(
      { error: "rate_limited", message: "Llegaste al límite de análisis por hora. Probá más tarde o usá el pincel." },
      { status: 429 },
    );
  }

  let body: { image?: string; point?: { x: number; y: number }; width?: number; height?: number };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  const { image, point, width, height } = body;
  if (!image || !point || typeof point.x !== "number" || typeof point.y !== "number") {
    return NextResponse.json({ error: "missing_fields", message: "Faltan `image` o `point`." }, { status: 400 });
  }
  if (typeof image !== "string" || !image.startsWith("data:image/")) {
    return NextResponse.json({ error: "invalid_image", message: "`image` debe ser un data URL de imagen." }, { status: 400 });
  }
  if (image.length > MAX_IMAGE_CHARS) {
    return NextResponse.json(
      { error: "image_too_large", message: "La foto es demasiado pesada. Probá con una más chica." },
      { status: 413 },
    );
  }

  // 1) Backend propio (proxy)
  if (process.env.SAM_BACKEND_URL) {
    return proxyToBackend(process.env.SAM_BACKEND_URL, body);
  }

  // 2) Replicate
  if (process.env.REPLICATE_API_TOKEN) {
    return segmentWithReplicate(image, point, width ?? 1024, height ?? 1024);
  }

  return NextResponse.json(
    {
      error: "backend_not_configured",
      message: "Configurá REPLICATE_API_TOKEN (o SAM_BACKEND_URL) para activar la segmentación.",
    },
    { status: 503 },
  );
}

// ---- Proxy a backend propio ----
async function proxyToBackend(backend: string, body: unknown) {
  try {
    const upstream = await fetch(backend, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(process.env.SAM_BACKEND_TOKEN ? { Authorization: `Bearer ${process.env.SAM_BACKEND_TOKEN}` } : {}),
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(45_000),
    });
    if (!upstream.ok) {
      const detail = await upstream.text().catch(() => "");
      return NextResponse.json({ error: "backend_error", status: upstream.status, detail: detail.slice(0, 500) }, { status: 502 });
    }
    const ct = upstream.headers.get("content-type") ?? "application/octet-stream";
    if (ct.includes("application/json")) return NextResponse.json(await upstream.json());
    return new NextResponse(await upstream.arrayBuffer(), { status: 200, headers: { "Content-Type": ct } });
  } catch (e) {
    return NextResponse.json({ error: "proxy_failed", message: msg(e) }, { status: 504 });
  }
}

// ---- Replicate (meta/sam-2) ----
// El modelo es AUTOMÁTICO: segmenta TODAS las regiones de la foto (no usa el punto).
// La precisión por clic la resuelve el CLIENTE: de la lista de máscaras que devolvemos,
// elige la que contiene el punto donde el usuario hizo clic → esa es la pared exacta.
async function segmentWithReplicate(image: string, point: { x: number; y: number }, width: number, height: number) {
  const token = process.env.REPLICATE_API_TOKEN!;
  const deployment = process.env.REPLICATE_DEPLOYMENT; // "owner/name" → instancia tibia (~2s)
  const version = process.env.REPLICATE_VERSION; // hash de meta/sam-2 (fallback, con cold start)
  if (!deployment && !version) {
    return NextResponse.json(
      { error: "replicate_model_missing", message: "Definí REPLICATE_DEPLOYMENT o REPLICATE_VERSION." },
      { status: 503 },
    );
  }

  const pps = Number(process.env.REPLICATE_POINTS_PER_SIDE) || 32; // más puntos = más cobertura (menos huecos)
  // Umbrales permisivos → más regiones, menos zonas sin segmentar (mejor para "clic en cualquier pared").
  const input = {
    image,
    points_per_side: pps,
    pred_iou_thresh: Number(process.env.REPLICATE_PRED_IOU_THRESH) || 0.7,
    stability_score_thresh: Number(process.env.REPLICATE_STABILITY_THRESH) || 0.85,
  };
  void point; // el punto se usa en el cliente para elegir la máscara
  void width;
  void height;

  // Un deployment tibio se llama por su endpoint propio (sin version: la fija el deployment).
  const endpoint = deployment
    ? `https://api.replicate.com/v1/deployments/${deployment}/predictions`
    : "https://api.replicate.com/v1/predictions";
  const createBody = deployment ? JSON.stringify({ input }) : JSON.stringify({ version, input });

  try {
    // Crea la predicción (Prefer: wait bloquea un rato; con instancia tibia resuelve en el acto).
    let res = await fetch(endpoint, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", Prefer: "wait" },
      body: createBody,
      signal: AbortSignal.timeout(65_000),
    });
    let pred = await res.json();
    if (!res.ok) {
      return NextResponse.json({ error: "replicate_error", detail: pred }, { status: 502 });
    }

    // Polling hasta resolver (presupuesto generoso por si la instancia está fría).
    let tries = 0;
    while (pred?.status && pred.status !== "succeeded" && pred.status !== "failed" && tries < 45) {
      await sleep(2000);
      res = await fetch(pred.urls.get, { headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(30_000) });
      pred = await res.json();
      tries++;
    }
    if (pred.status !== "succeeded") {
      return NextResponse.json({ error: "replicate_failed", detail: pred?.error ?? pred?.status }, { status: 502 });
    }

    // Output de meta/sam-2: { combined_mask, individual_masks: [url...] }.
    const allMasks: string[] = Array.isArray(pred.output?.individual_masks) ? pred.output.individual_masks : [];
    if (allMasks.length === 0) {
      return NextResponse.json({ error: "no_mask_in_output", detail: pred.output }, { status: 502 });
    }
    // Con points_per_side alto SAM devuelve cientos de regiones; bajarlas todas y mandarlas
    // en base64 en una sola respuesta hace explotar la memoria de la función.
    const maskUrls = allMasks.slice(0, MAX_MASKS);

    // replicate.delivery no manda CORS → el cliente no puede leer estas imágenes en canvas.
    // Las bajamos y las devolvemos como data URLs (base64) para que el cliente las lea sin taint.
    const masks = await mapLimit(maskUrls, MASK_CONCURRENCY, async (u) => {
      try {
        const r = await fetch(u, { signal: AbortSignal.timeout(20_000) });
        if (!r.ok) return null;
        const buf = Buffer.from(await r.arrayBuffer());
        const ct = r.headers.get("content-type") || "image/png";
        return `data:${ct};base64,${buf.toString("base64")}`;
      } catch {
        return null;
      }
    });
    const valid = masks.filter((m): m is string => !!m);
    if (valid.length === 0) return NextResponse.json({ error: "mask_fetch_failed" }, { status: 502 });

    return NextResponse.json({ masks: valid });
  } catch (e) {
    const message = msg(e);
    return NextResponse.json({ error: /timeout|abort/i.test(message) ? "replicate_timeout" : "replicate_call_failed", message }, { status: 504 });
  }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const msg = (e: unknown) => (e instanceof Error ? e.message : String(e));
