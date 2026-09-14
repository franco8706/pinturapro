import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { escapeHtml } from "@/lib/utils";

/**
 * Envío de emails transaccionales vía Resend.
 * Integración protegida: sin `RESEND_API_KEY` no hace nada (la app funciona igual).
 * Cuando cargues la key, las notificaciones se activan solas.
 */
const RESEND_KEY = process.env.RESEND_API_KEY;
const FROM = process.env.RESEND_FROM ?? "Pintura Pro <onboarding@resend.dev>";

/**
 * A dónde van los avisos de leads (presupuestos, contacto, postulaciones).
 *
 * Antes el destinatario salía de buscar el primer perfil con `is_admin`, y el único que
 * existe es el sembrado `empresa@pinturapro.demo`. `.demo` no es un TLD real: cada aviso
 * rebotaba duro, sin que nadie se enterara de que llegó un cliente.
 */
const LEADS_TO = process.env.LEADS_NOTIFY_EMAIL?.trim() || null;

export const EMAIL_READY = !!RESEND_KEY;

/** Email del usuario (vive en auth.users → solo accesible con service-role). */
async function getUserEmail(userId: string): Promise<string | null> {
  try {
    const admin = createAdminClient();
    const { data } = await admin.auth.admin.getUserById(userId);
    return data.user?.email ?? null;
  } catch {
    return null;
  }
}

async function send(to: string, subject: string, html: string): Promise<void> {
  try {
    // Con timeout: sin esto, un Resend lento dejaba colgada la Server Action que lo espera,
    // y con ella la pantalla del usuario.
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${RESEND_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: FROM, to, subject, html }),
      signal: AbortSignal.timeout(8_000),
    });
    // El status se miraba: antes un 403 por dominio no verificado, o un 422, se descartaban
    // en silencio y nadie se enteraba de que los emails no estaban saliendo.
    if (!res.ok) {
      const detalle = await res.text().catch(() => "");
      console.error(`[email] Resend respondió ${res.status}: ${detalle.slice(0, 200)}`);
    }
  } catch (e) {
    // Un email que falla no debe romper el flujo (cotizar/aceptar igual se completan),
    // pero sí tiene que quedar registrado.
    console.error("[email] no se pudo enviar:", e instanceof Error ? e.message : String(e));
  }
}

/** Notifica a un usuario por email. No-op si Resend no está configurado. */
export async function notifyUser(userId: string, subject: string, html: string): Promise<void> {
  if (!RESEND_KEY) {
    console.warn("[email] RESEND_API_KEY sin configurar: no se envió el aviso —", subject);
    return;
  }
  const to = await getUserEmail(userId);
  if (to) await send(to, subject, html);
}

/**
 * Avisa a la casilla de la empresa. Devuelve true si había a dónde mandarlo.
 *
 * Prefiere `LEADS_NOTIFY_EMAIL` sobre el perfil admin justamente para no depender de un dato
 * sembrado: el llamador usa el perfil como respaldo sólo si la variable no está.
 */
export async function notifyLeadsInbox(subject: string, html: string): Promise<boolean> {
  if (!LEADS_TO) return false;
  if (!RESEND_KEY) {
    console.warn("[email] RESEND_API_KEY sin configurar: no se envió el lead —", subject);
    return true; // había destinatario; lo que falta es la key
  }
  await send(LEADS_TO, subject, html);
  return true;
}

/**
 * Marca un fragmento como HTML ya seguro (armado por nosotros, no por un usuario).
 * `emailLayout` escapa todo lo que NO esté envuelto en esto, así que el default es seguro:
 * si te olvidás de marcar algo, se muestra como texto — nunca se ejecuta como markup.
 */
export type SafeHtml = { readonly __html: string };
export function html(strings: TemplateStringsArray, ...values: (string | number | SafeHtml)[]): SafeHtml {
  const out = strings.reduce((acc, chunk, i) => {
    if (i === 0) return chunk;
    const v = values[i - 1];
    const rendered = typeof v === "object" && v !== null && "__html" in v ? v.__html : escapeHtml(String(v));
    return acc + rendered + chunk;
  }, "");
  return { __html: out };
}

/** Sólo aceptamos links a nuestro propio sitio: un href de usuario sería phishing con nuestra marca. */
function safeHref(href: string): string | null {
  const site = process.env.NEXT_PUBLIC_SITE_URL;
  if (!site) return null;
  try {
    const u = new URL(href, site);
    if (u.origin !== new URL(site).origin) return null;
    if (u.protocol !== "https:" && u.protocol !== "http:") return null;
    return u.toString();
  } catch {
    return null;
  }
}

/** Envoltorio HTML simple y consistente con la marca. Escapa todo dato de usuario. */
export function emailLayout(title: string, body: string | SafeHtml, cta?: { label: string; href: string }): string {
  const safeTitle = escapeHtml(title);
  const safeBody = typeof body === "string" ? escapeHtml(body) : body.__html;
  const href = cta ? safeHref(cta.href) : null;
  return `
  <div style="font-family:Inter,Arial,sans-serif;max-width:480px;margin:0 auto;color:#141414">
    <h1 style="font-size:20px;margin:0 0 12px">${safeTitle}</h1>
    <div style="font-size:15px;line-height:1.5;color:#3a3a3a">${safeBody}</div>
    ${
      href && cta
        ? `<a href="${escapeHtml(href)}" style="display:inline-block;margin-top:20px;background:#141414;color:#fff;text-decoration:none;padding:12px 20px;font-size:14px">${escapeHtml(cta.label)}</a>`
        : ""
    }
    <p style="margin-top:28px;font-size:12px;color:#9a9a9a">Pintura Pro · Pintura profesional de obra</p>
  </div>`;
}
