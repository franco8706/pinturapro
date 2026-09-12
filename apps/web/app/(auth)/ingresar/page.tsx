"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { rutaInternaSegura } from "@/lib/redirect-seguro";
import { SocialAuth, AuthDivider } from "@/components/features/social-auth";

const READY = !!process.env.NEXT_PUBLIC_SUPABASE_URL;

export default function IngresarPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // El callback de auth redirige acá con ?error=auth cuando el intercambio del enlace falla,
  // pero nadie leía ese parámetro: la persona aterrizaba en el formulario pelado, sin saber
  // por qué. El caso más común no es un ataque sino abrir el mail en otro dispositivo.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("error") !== "auth") return;
    setError(
      params.get("motivo") === "enlace"
        ? "El enlace no se pudo validar. Suele pasar al abrirlo en otro dispositivo: abrilo en el mismo navegador donde te registraste, o pedí uno nuevo."
        : "No pudimos completar el ingreso. Probá de nuevo.",
    );
  }, []);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!READY) {
      setError("La autenticación todavía no está configurada (falta conectar Supabase).");
      return;
    }
    setLoading(true);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setError(traducir(error.message));
      setLoading(false);
      return;
    }
    // `startsWith("/")` dejaba pasar "//sitio-malo.com", que el navegador resuelve como
    // externo. El helper cubre ese caso y algunos más.
    const next = rutaInternaSegura(new URLSearchParams(window.location.search).get("next"), "/mi-panel");
    router.push(next);
    router.refresh();
  }

  return (
    <div>
      <h1 className="font-display text-display-sm text-ink mb-2">Ingresar</h1>
      <p className="font-body text-body-sm text-concrete mb-8">Entrá a tu cuenta de Pintura Pro.</p>

      <SocialAuth />
      <AuthDivider />

      <form onSubmit={onSubmit} className="space-y-5">
        <Field label="Email" type="email" value={email} onChange={setEmail} autoComplete="email" />
        <Field label="Contraseña" type="password" value={password} onChange={setPassword} autoComplete="current-password" />

        {error && <p role="alert" className="font-body text-body-sm text-[#C41E3A]">{error}</p>}

        <button
          type="submit"
          disabled={loading}
          className="w-full py-3 bg-ink text-bone font-body text-body-sm hover:bg-ink/90 transition-colors disabled:opacity-50"
        >
          {loading ? "Entrando…" : "Ingresar"}
        </button>
      </form>

      <p className="mt-6 font-body text-body-sm text-concrete">
        <Link href="/recuperar" className="text-ink underline underline-offset-2">
          Olvidé mi contraseña
        </Link>
      </p>
      <p className="mt-2 font-body text-body-sm text-concrete">
        ¿No tenés cuenta?{" "}
        <Link href="/crear-cuenta" className="text-ink underline underline-offset-2">
          Creá una
        </Link>
      </p>
    </div>
  );
}

function Field({
  label,
  type,
  value,
  onChange,
  autoComplete,
}: {
  label: string;
  type: string;
  value: string;
  onChange: (v: string) => void;
  autoComplete?: string;
}) {
  return (
    <label className="block">
      <span className="font-mono text-mono-sm uppercase tracking-widest text-concrete">{label}</span>
      <input
        type={type}
        required
        value={value}
        autoComplete={autoComplete}
        onChange={(e) => onChange(e.target.value)}
        className="mt-2 w-full border border-concrete/30 bg-plaster px-3 py-2.5 font-body text-body-md text-ink focus:border-ink outline-none transition-colors"
      />
    </label>
  );
}

// Traduce los errores más comunes de Supabase Auth al español.
function traducir(msg: string): string {
  if (/invalid login credentials/i.test(msg)) return "Email o contraseña incorrectos.";
  if (/email not confirmed/i.test(msg)) return "Confirmá tu email antes de ingresar (revisá tu casilla).";
  if (/rate limit/i.test(msg)) return "Demasiados intentos. Esperá un momento.";
  return msg;
}
