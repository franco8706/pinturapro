"use client";

import { useState } from "react";
import { cancelarTrabajo } from "./actions";
import { useAccion } from "@/lib/use-accion";

/**
 * Cancelar un trabajo, desde cualquiera de las dos partes.
 *
 * Sin este botón no había ninguna salida: un pintor que aceptaba y desaparecía dejaba al
 * cliente sin poder reseñar, sin poder contratar a otro y sin forma de liberar el pedido.
 */
export function CancelButton({ jobId, label = "Cancelar" }: { jobId: string; label?: string }) {
  const [confirming, setConfirming] = useState(false);
  const { ejecutar, pending, error } = useAccion(cancelarTrabajo);

  return (
    <span className="inline-flex items-center gap-3">
      <button
        type="button"
        onClick={() => (confirming ? void ejecutar(jobId) : setConfirming(true))}
        onBlur={() => !pending && setConfirming(false)}
        disabled={pending}
        aria-busy={pending}
        className="font-mono text-mono-sm text-concrete hover:text-[#C41E3A] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {pending ? "Cancelando…" : confirming ? "¿Confirmar cancelación?" : label}
      </button>
      {error && (
        <span role="alert" className="font-body text-body-sm text-[#C41E3A]">
          {error}
        </span>
      )}
    </span>
  );
}
