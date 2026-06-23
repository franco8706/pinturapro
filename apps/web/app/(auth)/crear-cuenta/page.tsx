"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import type { ProfileType } from "@/lib/supabase/types";

const READY = !!process.env.NEXT_PUBLIC_SUPABASE_URL;

const ROLES: { value: ProfileType; label: string; hint: string }[] = [
  { value: "client", label: "Cliente", hint: "Quiero pintar mi casa / obra" },
  { value: "painter", label: "Pintor", hint: "Ofrezco mis servicios" },
  { value: "company", label: "Empresa", hint: "Constructora / estudio" },
];

export default function CrearCuentaPage() {
  const router = useRouter();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<ProfileType>("client");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!READY) {
      setError("La autenticación todavía no está configurada (falta conectar Supabase).");
      return;
    }
    if (password.length < 6) {
      setError("La contraseña debe tener al menos 6 caracteres.");
      return;
    }
    setLoading(true);
    const supabase = createClient();
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: fullName, type: role }, // el trigger handle_new_user crea el profile
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    });
    if (error) {
      setError(traducir(error.message));
      setLoading(false);
      return;
    }
    // Si el proyecto exige confirmar email, no hay sesión todavía → avisamos.
    if (!data.session) {
      setSent(true);
      setLoading(false);
      return;
    }
    router.push("/");
    router.refresh();
  }

  if (sent) {
    return (
      <div>
        <h1 className="font-display text-display-sm text-ink mb-3">Revisá tu email</h1>
        <p className="font-body text-body-md text-concrete">
          Te enviamos un link a <strong className="text-ink">{email}</strong> para confirmar tu cuenta. Abrilo y
          después ingresá.
        </p>
        <Link href="/ingresar" className="mt-6 inline-block font-body text-body-sm text-ink underline underline-offset-2">
          Ir a ingresar
        </Link>
      </div>
    );
  }

  return (
    <div>
      <h1 className="font-display text-display-sm text-ink mb-2">Crear cuenta</h1>
      <p className="font-body text-body-sm text-concrete mb-8">Sumate a Pintura Pro.</p>

      <form onSubmit={onSubmit} className="space-y-5">
        <div>
          <span className="font-mono text-mono-sm uppercase tracking-widest text-concrete">Soy</span>
          <div className="mt-2 grid grid-cols-3 gap-2">
            {ROLES.map((r) => (
              <button
                type="button"
                key={r.value}
                onClick={() => setRole(r.value)}
                className={cn(
                  "px-2 py-3 border text-center transition-colors",
                  role === r.value ? "border-ink bg-ink text-bone" : "border-concrete/30 hover:border-ink",
                )}
              >
                <span className="block font-body text-body-sm">{r.label}</span>
                <span className={cn("block font-body text-[11px] mt-0.5", role === r.value ? "text-bone/70" : "text-concrete")}>
                  {r.hint}
                </span>
              </button>
            ))}
          </div>
        </div>

        <Field label="Nombre y apellido" type="text" value={fullName} onChange={setFullName} autoComplete="name" />
        <Field label="Email" type="email" value={email} onChange={setEmail} autoComplete="email" />
        <Field label="Contraseña" type="password" value={password} onChange={setPassword} autoComplete="new-password" />

        {error && <p className="font-body text-body-sm text-[#C41E3A]">{error}</p>}

        <button
          type="submit"
          disabled={loading}
          className="w-full py-3 bg-ink text-bone font-body text-body-sm hover:bg-ink/90 transition-colors disabled:opacity-50"
        >
          {loading ? "Creando…" : "Crear cuenta"}
        </button>
      </form>

      <p className="mt-6 font-body text-body-sm text-concrete">
        ¿Ya tenés cuenta?{" "}
        <Link href="/ingresar" className="text-ink underline underline-offset-2">
          Ingresá
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

function traducir(msg: string): string {
  if (/already registered|already exists/i.test(msg)) return "Ese email ya tiene una cuenta. Probá ingresar.";
  if (/password/i.test(msg) && /weak|short|least/i.test(msg)) return "La contraseña es muy débil (mínimo 6 caracteres).";
  if (/rate limit/i.test(msg)) return "Demasiados intentos. Esperá un momento.";
  return msg;
}
