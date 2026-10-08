"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { yaTransferi } from "./actions";

/** El botón "Ya transferí", con cerrojo contra el doble clic como el resto de los formularios. */
export function YaTransferi() {
  const router = useRouter();
  const [mensaje, setMensaje] = useState("");
  const [error, setError] = useState("");
  const [enviando, setEnviando] = useState(false);
  const cerrojo = useRef(false);

  async function avisar() {
    if (cerrojo.current) return;
    cerrojo.current = true;
    setEnviando(true);
    setError("");
    try {
      const r = await yaTransferi();
      if (r.error) setError(r.error);
      else {
        setMensaje(r.mensaje ?? "Listo.");
        router.refresh();
      }
    } catch {
      setError("No pudimos registrar el aviso. Revisá tu conexión y probá de nuevo.");
    } finally {
      setEnviando(false);
      cerrojo.current = false;
    }
  }

  return (
    <div className="mt-4">
      <button
        type="button"
        onClick={avisar}
        disabled={enviando}
        className="px-5 py-2.5 bg-ink text-bone font-body text-body-sm hover:bg-ink/90 transition-colors disabled:opacity-50"
      >
        {enviando ? "Avisando…" : "Ya transferí"}
      </button>
      <p role="status" aria-live="polite" className="mt-3 font-body text-body-sm text-[#2D5A3D]">
        {mensaje}
      </p>
      {error && (
        <p role="alert" className="font-body text-body-sm text-[#C41E3A]">
          {error}
        </p>
      )}
    </div>
  );
}
