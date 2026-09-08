"use client";

import { useState } from "react";
import { aceptarCotizacion } from "../actions";
import { useAccion } from "@/lib/use-accion";

/** Botón para que el cliente acepte una cotización (con confirmación inline). */
export function AcceptButton({ jobId }: { jobId: string }) {
  const [confirming, setConfirming] = useState(false);
  const { ejecutar, pending, error } = useAccion(aceptarCotizacion);

  function onClick() {
    if (!confirming) {
      setConfirming(true);
      return;
    }
    void ejecutar(jobId);
    // En éxito, revalidatePath refresca la página y el estado pasa a "Aceptada".
  }

  return (
    <div className="flex items-center gap-3">
      <button
        type="button"
        onClick={onClick}
        onBlur={() => !pending && setConfirming(false)}
        disabled={pending}
        aria-busy={pending}
        className="px-5 py-2.5 bg-ink text-bone font-body text-body-sm hover:bg-ink/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {pending ? "Aceptando…" : confirming ? "¿Confirmar?" : "Aceptar cotización"}
      </button>
      {error && (
        <span role="alert" className="font-body text-body-sm text-[#C41E3A]">
          {error}
        </span>
      )}
    </div>
  );
}
