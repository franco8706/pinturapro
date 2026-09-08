"use client";

import { useState } from "react";
import { marcarCompletado } from "@/app/(marketplace)/actions";
import { useAccion } from "@/lib/use-accion";

/** El pintor marca un trabajo aceptado como completado (con confirmación inline). */
export function CompleteButton({ jobId }: { jobId: string }) {
  const [confirming, setConfirming] = useState(false);
  const { ejecutar, pending, error } = useAccion(marcarCompletado);

  function onClick() {
    if (!confirming) {
      setConfirming(true);
      return;
    }
    void ejecutar(jobId);
  }

  return (
    <span className="inline-flex items-center gap-3">
      <button
        type="button"
        onClick={onClick}
        onBlur={() => !pending && setConfirming(false)}
        disabled={pending}
        aria-busy={pending}
        className="px-4 py-2 border border-ink font-body text-body-sm hover:bg-ink hover:text-bone transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {pending ? "Guardando…" : confirming ? "¿Confirmar?" : "Marcar completado"}
      </button>
      {error && (
        <span role="alert" className="font-body text-body-sm text-[#C41E3A]">
          {error}
        </span>
      )}
    </span>
  );
}
