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
    await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${RESEND_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: FROM, to, subject, html }),
    });
  } catch {
    // Un email que falla no debe romper el flujo (cotizar/aceptar igual se completan).
  }
}

/** Notifica a un usuario por email. No-op si Resend no está configurado. */
export async function notifyUser(userId: string, subject: string, html: string): Promise<void> {
  if (!RESEND_KEY) return;
  const to = await getUserEmail(userId);
  if (to) await send(to, subject, html);
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
