"use client";

import { useState, useTransition } from "react";
import { marcarCompletado } from "@/app/(marketplace)/actions";

/** El pintor marca un trabajo aceptado como completado (con confirmación inline). */
export function CompleteButton({ jobId }: { jobId: string }) {
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
      const res = await marcarCompletado(jobId);
      if (res?.error) {
        setError(res.error);
        setConfirming(false);
      }
    });
  }

  return (
    <span className="inline-flex items-center gap-3">
      <button
        type="button"
        onClick={onClick}
        onBlur={() => setConfirming(false)}
        disabled={pending}
        className="px-4 py-2 border border-ink font-body text-body-sm hover:bg-ink hover:text-bone transition-colors disabled:opacity-50"
      >
        {pending ? "Guardando…" : confirming ? "¿Confirmar?" : "Marcar completado"}
      </button>
      {error && <span className="font-body text-body-sm text-[#C41E3A]">{error}</span>}
    </span>
  );
}
