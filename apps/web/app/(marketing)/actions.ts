"use server";

import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { notifyUser, emailLayout, html } from "@/lib/email";
import { SITE_URL } from "@/lib/site";

/**
 * Formularios públicos: presupuesto, contacto y postulación de pintores.
 *
 * Antes estos tres formularios mostraban "¡Recibimos tu pedido!" y DESCARTABAN los datos.
 * El visitante quedaba esperando una respuesta que nadie iba a mandar. Ahora se persisten
 * en `public.leads` (migración 0007) y se le avisa por email a la empresa.
 */

export interface LeadResult {
  ok?: boolean;
  error?: string;
}

// ── Anti-abuso ────────────────────────────────────────────────────────
// Estos endpoints son públicos y sin login: sin límite, cualquiera llena la tabla.
// Contador en memoria del proceso; en serverless el límite real es por instancia.
// Suficiente para frenar el abuso trivial. Para algo serio: Upstash/Redis o un captcha.
const RATE = { max: 5, windowMs: 60 * 60 * 1000 };
const hits = new Map<string, number[]>();

function rateLimited(key: string): boolean {
  const now = Date.now();
  const recientes = (hits.get(key) ?? []).filter((t) => now - t < RATE.windowMs);
  if (recientes.length >= RATE.max) {
    hits.set(key, recientes);
    return true;
  }
  recientes.push(now);
  hits.set(key, recientes);
  if (hits.size > 5000) {
    for (const [k, v] of hits) if (!v.some((t) => now - t < RATE.windowMs)) hits.delete(k);
  }
  return false;
}

async function clientKey(): Promise<string> {
  try {
    const h = await headers();
    const fwd = h.get("x-forwarded-for") ?? "";
    return fwd.split(",")[0].trim() || h.get("x-real-ip") || "desconocido";
  } catch {
    return "desconocido";
  }
}

// ── Validación ────────────────────────────────────────────────────────
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

function limpiar(v: FormDataEntryValue | null | undefined, max: number): string {
  return String(v ?? "").trim().slice(0, max);
}

/** Campo trampa: los bots completan todo, las personas no ven este input. */
function esBot(formData: FormData): boolean {
  return limpiar(formData.get("website"), 200).length > 0;
}

async function guardarLead(input: {
  kind: "quote" | "contact" | "painter_application";
  name: string;
  email: string | null;
  phone: string | null;
  message: string | null;
  details: Record<string, unknown>;
  sourcePath: string;
}): Promise<LeadResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { error } = await supabase.from("leads").insert({
    kind: input.kind,
    status: "new",
    name: input.name,
    email: input.email,
    phone: input.phone,
    message: input.message,
    details: input.details,
    user_id: user?.id ?? null,
    source_path: input.sourcePath,
  } as never);

  if (error) {
    console.error(`[leads] no se pudo guardar (${input.kind}): ${error.message}`);
    // La tabla puede no existir todavía (migración 0007 sin aplicar). Es un fallo real:
    // hay que decírselo a la persona en vez de fingir que se envió.
    return { error: "No pudimos registrar tu pedido. Escribinos a hola@pinturapro.ar y lo resolvemos." };
  }

  await avisarAEmpresa(input);
  return { ok: true };
}

/** Aviso por email a la empresa. Best-effort: si falla, el lead ya quedó guardado. */
async function avisarAEmpresa(input: {
  kind: "quote" | "contact" | "painter_application";
  name: string;
  email: string | null;
  phone: string | null;
  message: string | null;
  details: Record<string, unknown>;
}): Promise<void> {
  try {
    const admin = createAdminClient();
    const { data } = await admin.from("profiles").select("id").eq("type", "company").limit(1);
    const empresa = (data as unknown as { id: string }[] | null)?.[0];
    if (!empresa) return;

    const titulos = {
      quote: "Nuevo pedido de presupuesto",
      contact: "Nuevo mensaje de contacto",
      painter_application: "Nueva postulación de pintor",
    };

    const detalles = Object.entries(input.details)
      .filter(([, v]) => v !== null && v !== undefined && String(v).trim() !== "")
      .map(([k, v]) => html`<br/><strong>${k}:</strong> ${String(v)}`);

    await notifyUser(
      empresa.id,
      `${titulos[input.kind]} — ${input.name}`,
      emailLayout(
        titulos[input.kind],
        html`<strong>${input.name}</strong>${input.email ? html` · ${input.email}` : html``}${input.phone
          ? html` · ${input.phone}`
          : html``}${input.message ? html`<br/><br/>${input.message}` : html``}${detalles.reduce(
          (acc, d) => html`${acc}${d}`,
          html``,
        )}`,
        { label: "Ver en el panel", href: `${SITE_URL}/admin` },
      ),
    );
  } catch (e) {
    console.error("[leads] no se pudo avisar a la empresa:", e instanceof Error ? e.message : String(e));
  }
}

// ── Acciones ──────────────────────────────────────────────────────────

/** /cotizar — pedido de presupuesto (el embudo principal del negocio). */
export async function pedirPresupuesto(formData: FormData): Promise<LeadResult> {
  if (esBot(formData)) return { ok: true }; // al bot se le responde ok y no se guarda nada
  if (rateLimited(await clientKey())) {
    return { error: "Recibimos varios pedidos desde acá. Probá de nuevo en un rato." };
  }

  const name = limpiar(formData.get("name"), 120);
  const email = limpiar(formData.get("email"), 200);
  const phone = limpiar(formData.get("phone"), 40);

  if (name.length < 2) return { error: "Ingresá tu nombre." };
  if (!EMAIL_RE.test(email)) return { error: "Ingresá un email válido para poder mandarte el presupuesto." };

  return guardarLead({
    kind: "quote",
    name,
    email,
    phone: phone || null,
    message: limpiar(formData.get("message"), 4000) || null,
    details: {
      tipo: limpiar(formData.get("tipo"), 60),
      superficie: limpiar(formData.get("surface"), 60),
      ambientes: limpiar(formData.get("rooms"), 300),
      estado: limpiar(formData.get("estado"), 200),
      plazo: limpiar(formData.get("plazo"), 100),
    },
    sourcePath: "/cotizar",
  });
}

/** /contacto — mensaje libre. */
export async function enviarConsulta(formData: FormData): Promise<LeadResult> {
  if (esBot(formData)) return { ok: true };
  if (rateLimited(await clientKey())) {
    return { error: "Recibimos varios mensajes desde acá. Probá de nuevo en un rato." };
  }

  const name = limpiar(formData.get("name"), 120);
  const email = limpiar(formData.get("email"), 200);
  const message = limpiar(formData.get("message"), 4000);

  if (name.length < 2) return { error: "Ingresá tu nombre." };
  if (!EMAIL_RE.test(email)) return { error: "Ingresá un email válido para poder responderte." };
  if (message.length < 10) return { error: "Contanos un poco más en el mensaje." };

  return guardarLead({
    kind: "contact",
    name,
    email,
    phone: limpiar(formData.get("phone"), 40) || null,
    message,
    details: { asunto: limpiar(formData.get("subject"), 160) },
    sourcePath: "/contacto",
  });
}

/** /registro — postulación de un pintor que quiere sumarse como Pro. */
export async function postularmeComoPintor(formData: FormData): Promise<LeadResult> {
  if (esBot(formData)) return { ok: true };
  if (rateLimited(await clientKey())) {
    return { error: "Recibimos varias postulaciones desde acá. Probá de nuevo en un rato." };
  }

  const name = limpiar(formData.get("name"), 120);
  const email = limpiar(formData.get("email"), 200);
  const phone = limpiar(formData.get("phone"), 40);

  if (name.length < 2) return { error: "Ingresá tu nombre." };
  if (!EMAIL_RE.test(email)) return { error: "Ingresá un email válido: es por donde te vamos a contactar." };
  if (phone.length < 6) return { error: "Ingresá un teléfono de contacto." };

  return guardarLead({
    kind: "painter_application",
    name,
    email,
    phone,
    message: limpiar(formData.get("message"), 4000) || null,
    details: {
      zona: limpiar(formData.get("zone"), 120),
      experiencia: limpiar(formData.get("experience"), 120),
      especialidades: limpiar(formData.get("specialties"), 300),
    },
    sourcePath: "/registro",
  });
}
