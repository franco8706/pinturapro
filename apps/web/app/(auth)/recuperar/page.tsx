"use client";
import { useRef, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

const READY = !!process.env.NEXT_PUBLIC_SUPABASE_URL;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/**
 * Pedir el mail para restablecer la contraseña.
 *
 * No existía: quien olvidaba la clave quedaba afuera de su cuenta para siempre, sin ninguna
 * salida dentro del producto. Para un marketplace donde el pintor tiene su reputación y su
 * historial adentro, eso es perder la cuenta.
 *
 * Siempre responde lo mismo, haya o no una cuenta con ese mail: si dijera "ese email no está
 * registrado", cualquiera podría usar este formulario para averiguar quién tiene cuenta.
 */
export default function RecuperarPage() {
  const [email, setEmail] = useState("");
  const [enviado, setEnviado] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  /**
   * Cerrojo sincrónico: tres clics seguidos mandaban TRES mails de recuperación (medido por el
   * agente `formularios-hostiles`: 3 pedidos a /auth/v1/recover, 3 × 200). `disabled={loading}`
   * no alcanza, igual que en los demás formularios: el estado de React se ve recién al
   * repintar y los clics del mismo instante entran todos.
   */
  const enviando = useRef(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (enviando.current) return;
    setError("");
    if (!READY) {
      setError("La autenticación todavía no está configurada (falta conectar Supabase).");
      return;
    }
    // Revisar el FORMATO no delata a nadie: sólo dice que lo escrito no es un email. Antes un
    // email de puros espacios recibía "Revisá tu correo" y la persona esperaba un mail que
    // nunca se mandó (Supabase contestaba 400 y acá se ignoraba).
    if (!EMAIL_RE.test(email.trim())) {
      setError("Revisá el email: no parece una dirección válida.");
      return;
    }
    enviando.current = true;
    setLoading(true);
    const supabase = createClient();
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/nueva-contrasena`,
    });
    setLoading(false);
    enviando.current = false;
    // Supabase contesta IGUAL exista o no la cuenta, así que sus errores no delatan a nadie y
    // se pueden mostrar. Lo que no se hace es fingir que el mail salió cuando no salió.
    if (error) {
      if (/network|fetch/i.test(error.message)) setError("No pudimos conectar. Revisá tu conexión y probá de nuevo.");
      else if (/rate limit/i.test(error.message)) setError("Pediste el enlace varias veces seguidas. Esperá unos minutos.");
      else setError("No pudimos mandar el enlace. Revisá el email y probá de nuevo.");
      return;
    }
    setEnviado(true);
  }

  if (enviado) {
    return (
      <div>
        <h1 className="font-display text-display-sm text-ink mb-2">Revisá tu correo</h1>
        <p className="font-body text-body-sm text-concrete mb-6">
          Si <strong className="text-ink">{email.trim()}</strong> tiene una cuenta en Pintura Pro, le
          mandamos un enlace para elegir una contraseña nueva. El enlace vence en una hora.
        </p>
        <p className="font-body text-body-sm text-concrete mb-8">
          Si no te llega en unos minutos, mirá en spam o probá de nuevo.
        </p>
        <Link
          href="/ingresar"
          className="inline-block w-full text-center py-3 bg-ink text-bone font-body text-body-sm hover:bg-ink/90 transition-colors"
        >
          Volver a ingresar
        </Link>
      </div>
    );
  }

  return (
    <div>
      <h1 className="font-display text-display-sm text-ink mb-2">Recuperar contraseña</h1>
      <p className="font-body text-body-sm text-concrete mb-8">
        Poné tu email y te mandamos un enlace para elegir una nueva.
      </p>

      <form onSubmit={onSubmit} className="space-y-5">
        <label className="block">
          <span className="font-mono text-mono-sm uppercase tracking-widest text-concrete">Email</span>
          <input
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? "error-recuperar" : undefined}
            className="mt-2 w-full border border-concrete/40 bg-plaster px-3 py-2.5 font-body text-body-md text-ink focus-visible:border-ink focus-visible:outline-none transition-colors"
          />
        </label>

        {error && (
          <p id="error-recuperar" role="alert" className="font-body text-body-sm text-[#C41E3A]">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full py-3 bg-ink text-bone font-body text-body-sm hover:bg-ink/90 transition-colors disabled:opacity-60"
        >
          {loading ? "Enviando…" : "Enviarme el enlace"}
        </button>
      </form>

      <p className="mt-6 font-body text-body-sm text-concrete">
        <Link href="/ingresar" className="text-ink underline underline-offset-2">
          Volver a ingresar
        </Link>
      </p>
    </div>
  );
}
