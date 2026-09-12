"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

const READY = !!process.env.NEXT_PUBLIC_SUPABASE_URL;
const MINIMO = 8;

/**
 * Elegir la contraseña nueva, después de entrar por el enlace del mail.
 *
 * Supabase deja la sesión de recuperación abierta cuando se abre ese enlace, así que acá sólo
 * hace falta un `updateUser`. Pero esa sesión existe únicamente si el enlace se abre en el
 * MISMO navegador que lo pidió: el flujo PKCE guarda el verificador en una cookie local. Por
 * eso la pantalla verifica primero que haya sesión, y si no la hay lo dice en castellano en
 * vez de dejar a la persona frente a un formulario que va a fallar al enviarse.
 */
export default function NuevaContrasenaPage() {
  const router = useRouter();
  const [estado, setEstado] = useState<"verificando" | "lista" | "sin-sesion">("verificando");
  const [password, setPassword] = useState("");
  const [repetir, setRepetir] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [ok, setOk] = useState(false);

  useEffect(() => {
    if (!READY) {
      setEstado("sin-sesion");
      return;
    }
    const supabase = createClient();
    // `getUser` valida contra el servidor, no confía en la cookie.
    supabase.auth
      .getUser()
      .then(({ data }) => setEstado(data.user ? "lista" : "sin-sesion"))
      .catch(() => setEstado("sin-sesion"));
  }, []);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (password.length < MINIMO) {
      setError(`La contraseña tiene que tener al menos ${MINIMO} caracteres.`);
      return;
    }
    if (password !== repetir) {
      setError("Las dos contraseñas no coinciden.");
      return;
    }
    setLoading(true);
    const supabase = createClient();
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (error) {
      if (/different from the old/i.test(error.message)) {
        setError("Elegí una contraseña distinta de la anterior.");
      } else if (/network|fetch/i.test(error.message)) {
        setError("No pudimos conectar. Probá de nuevo.");
      } else {
        setError("No pudimos cambiar la contraseña. Pedí el enlace de nuevo.");
      }
      return;
    }
    setOk(true);
    setTimeout(() => {
      router.push("/mi-panel");
      router.refresh();
    }, 1200);
  }

  if (estado === "verificando") {
    return <p className="font-body text-body-sm text-concrete">Verificando el enlace…</p>;
  }

  if (estado === "sin-sesion") {
    return (
      <div>
        <h1 className="font-display text-display-sm text-ink mb-2">El enlace no es válido</h1>
        <p className="font-body text-body-sm text-concrete mb-6">
          Puede haber vencido, o lo abriste en un dispositivo distinto del que pidió el cambio. Los
          enlaces sólo funcionan en el mismo navegador donde se pidieron.
        </p>
        <Link
          href="/recuperar"
          className="inline-block w-full text-center py-3 bg-ink text-bone font-body text-body-sm hover:bg-ink/90 transition-colors"
        >
          Pedir un enlace nuevo
        </Link>
      </div>
    );
  }

  if (ok) {
    return (
      <div>
        <h1 className="font-display text-display-sm text-ink mb-2">Listo</h1>
        <p role="status" className="font-body text-body-sm text-concrete">
          Cambiamos tu contraseña. Te llevamos a tu panel…
        </p>
      </div>
    );
  }

  return (
    <div>
      <h1 className="font-display text-display-sm text-ink mb-2">Nueva contraseña</h1>
      <p className="font-body text-body-sm text-concrete mb-8">
        Elegí una contraseña de al menos {MINIMO} caracteres.
      </p>

      <form onSubmit={onSubmit} className="space-y-5">
        <Campo
          id="pass-nueva"
          label="Contraseña nueva"
          value={password}
          onChange={setPassword}
          invalido={!!error}
        />
        <Campo id="pass-repetir" label="Repetir contraseña" value={repetir} onChange={setRepetir} invalido={!!error} />

        {error && (
          <p id="error-pass" role="alert" className="font-body text-body-sm text-[#C41E3A]">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full py-3 bg-ink text-bone font-body text-body-sm hover:bg-ink/90 transition-colors disabled:opacity-60"
        >
          {loading ? "Guardando…" : "Cambiar contraseña"}
        </button>
      </form>
    </div>
  );
}

function Campo({
  id,
  label,
  value,
  onChange,
  invalido,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  invalido: boolean;
}) {
  return (
    <label htmlFor={id} className="block">
      <span className="font-mono text-mono-sm uppercase tracking-widest text-concrete">{label}</span>
      <input
        id={id}
        type="password"
        required
        minLength={MINIMO}
        autoComplete="new-password"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-invalid={invalido || undefined}
        aria-describedby={invalido ? "error-pass" : undefined}
        className="mt-2 w-full border border-concrete/40 bg-plaster px-3 py-2.5 font-body text-body-md text-ink focus-visible:border-ink focus-visible:outline-none transition-colors"
      />
    </label>
  );
}
