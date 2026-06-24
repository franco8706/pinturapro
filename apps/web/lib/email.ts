import { createAdminClient } from "@/lib/supabase/admin";

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

/** Envoltorio HTML simple y consistente con la marca. */
export function emailLayout(title: string, body: string, cta?: { label: string; href: string }): string {
  return `
  <div style="font-family:Inter,Arial,sans-serif;max-width:480px;margin:0 auto;color:#141414">
    <h1 style="font-size:20px;margin:0 0 12px">${title}</h1>
    <div style="font-size:15px;line-height:1.5;color:#3a3a3a">${body}</div>
    ${
      cta
        ? `<a href="${cta.href}" style="display:inline-block;margin-top:20px;background:#141414;color:#fff;text-decoration:none;padding:12px 20px;font-size:14px">${cta.label}</a>`
        : ""
    }
    <p style="margin-top:28px;font-size:12px;color:#9a9a9a">Pintura Pro · Pintura profesional de obra</p>
  </div>`;
}
