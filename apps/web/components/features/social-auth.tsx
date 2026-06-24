"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

const READY = !!process.env.NEXT_PUBLIC_SUPABASE_URL;

// 'azure' es el id del proveedor de Microsoft en Supabase Auth.
type Provider = "google" | "azure" | "facebook";

const PROVIDERS: { id: Provider; label: string; icon: React.ReactNode }[] = [
  { id: "google", label: "Google", icon: <GoogleIcon /> },
  { id: "azure", label: "Microsoft", icon: <MicrosoftIcon /> },
  { id: "facebook", label: "Facebook", icon: <FacebookIcon /> },
];

/**
 * Botones de login social. Tras autenticar, OAuth vuelve a /auth/callback?next=/mi-panel,
 * que rutea a cada usuario a su panel (o a /bienvenida si es su primera vez).
 */
export function SocialAuth() {
  const [loading, setLoading] = useState<Provider | null>(null);
  const [error, setError] = useState("");

  async function signIn(provider: Provider) {
    if (!READY) {
      setError("El login social todavía no está configurado (faltan los proveedores en Supabase).");
      return;
    }
    setError("");
    setLoading(provider);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo: `${window.location.origin}/auth/callback?next=/mi-panel` },
    });
    if (error) {
      setError(traducir(provider, error.message));
      setLoading(null);
    }
    // En éxito, el navegador se va al proveedor; no hace falta limpiar el loading.
  }

  return (
    <div className="space-y-3">
      {PROVIDERS.map((p) => (
        <button
          key={p.id}
          type="button"
          onClick={() => signIn(p.id)}
          disabled={loading !== null}
          className="w-full flex items-center justify-center gap-3 py-3 border border-concrete/30 bg-bone font-body text-body-sm text-ink hover:border-ink transition-colors disabled:opacity-50"
        >
          {p.icon}
          <span>{loading === p.id ? "Redirigiendo…" : `Continuar con ${p.label}`}</span>
        </button>
      ))}
      {error && <p className="font-body text-body-sm text-[#C41E3A]">{error}</p>}
    </div>
  );
}

function traducir(provider: Provider, msg: string): string {
  if (/provider is not enabled/i.test(msg)) {
    const nombre = provider === "azure" ? "Microsoft" : provider === "google" ? "Google" : "Facebook";
    return `${nombre} todavía no está habilitado en Supabase. (Authentication → Providers).`;
  }
  return msg;
}

export function AuthDivider() {
  return (
    <div className="my-6 flex items-center gap-4">
      <span className="h-px flex-1 bg-concrete/20" />
      <span className="font-mono text-mono-sm uppercase tracking-widest text-concrete">o</span>
      <span className="h-px flex-1 bg-concrete/20" />
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden>
      <path
        fill="#4285F4"
        d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.7-1.57 2.68-3.88 2.68-6.62Z"
      />
      <path
        fill="#34A853"
        d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.8.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.03-3.7H.96v2.33A9 9 0 0 0 9 18Z"
      />
      <path fill="#FBBC05" d="M3.97 10.72A5.41 5.41 0 0 1 3.68 9c0-.6.1-1.18.29-1.72V4.95H.96A9 9 0 0 0 0 9c0 1.45.35 2.83.96 4.05l3.01-2.33Z" />
      <path
        fill="#EA4335"
        d="M9 3.58c1.32 0 2.5.46 3.44 1.35l2.58-2.58C13.47.9 11.43 0 9 0A9 9 0 0 0 .96 4.95l3.01 2.33C4.68 5.16 6.66 3.58 9 3.58Z"
      />
    </svg>
  );
}

function MicrosoftIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden>
      <path fill="#F25022" d="M0 0h8.5v8.5H0z" />
      <path fill="#7FBA00" d="M9.5 0H18v8.5H9.5z" />
      <path fill="#00A4EF" d="M0 9.5h8.5V18H0z" />
      <path fill="#FFB900" d="M9.5 9.5H18V18H9.5z" />
    </svg>
  );
}

function FacebookIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden>
      <path
        fill="#1877F2"
        d="M24 12c0-6.63-5.37-12-12-12S0 5.37 0 12c0 5.99 4.39 10.95 10.13 11.85v-8.38H7.08V12h3.05V9.36c0-3 1.79-4.67 4.53-4.67 1.31 0 2.68.24 2.68.24v2.95h-1.51c-1.49 0-1.96.93-1.96 1.87V12h3.33l-.53 3.47h-2.8v8.38C19.61 22.95 24 17.99 24 12Z"
      />
    </svg>
  );
}
