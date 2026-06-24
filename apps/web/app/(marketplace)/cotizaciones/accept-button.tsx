"use client";

import { useState, useTransition } from "react";
import { aceptarCotizacion } from "../actions";

/** Botón para que el cliente acepte una cotización (con confirmación inline). */
export function AcceptButton({ jobId }: { jobId: string }) {
  const [pending, startTransition] = useTransition();
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState("");

  function onClick() {
    if (!confirming) {
      setConfirming(true);
      return;
    }
    setError("");
    startTransition(async () => {
      const res = await aceptarCotizacion(jobId);
      if (res?.error) {
        setError(res.error);
        setConfirming(false);
      }
      // En éxito, revalidatePath refresca la página y el estado pasa a "Aceptada".
    });
  }

  return (
    <div className="flex items-center gap-3">
      <button
        type="button"
        onClick={onClick}
        onBlur={() => setConfirming(false)}
        disabled={pending}
        className="px-5 py-2.5 bg-ink text-bone font-body text-body-sm hover:bg-ink/90 transition-colors disabled:opacity-50"
      >
        {pending ? "Aceptando…" : confirming ? "¿Confirmar?" : "Aceptar cotización"}
      </button>
      {error && <span className="font-body text-body-sm text-[#C41E3A]">{error}</span>}
    </div>
  );
}
