"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { deleteObra } from "./actions";

/** Acciones de una obra del portfolio: editar (link) y borrar (con confirmación). */
export function PortfolioActions({ id, slug }: { id: string; slug: string }) {
  const [pending, startTransition] = useTransition();
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState("");

  function onDelete() {
    if (!confirming) {
      setConfirming(true);
      return;
    }
    setError("");
    startTransition(async () => {
      const res = await deleteObra(id);
      if (res?.error) {
        setError(res.error);
        setConfirming(false);
      }
      // En éxito, revalidatePath refresca el panel y la card desaparece.
    });
  }

  return (
    <div className="mt-2 flex items-center gap-4 font-mono text-mono-sm">
      <Link
        href={`/dashboard/editar/${slug}`}
        className="text-concrete hover:text-ink underline underline-offset-2 transition-colors"
      >
        Editar
      </Link>
      <button
        type="button"
        onClick={onDelete}
        onBlur={() => setConfirming(false)}
        disabled={pending}
        className="text-concrete hover:text-[#C41E3A] transition-colors disabled:opacity-50"
      >
        {pending ? "Borrando…" : confirming ? "¿Confirmar?" : "Borrar"}
      </button>
      {error && <span className="text-[#C41E3A]">{error}</span>}
    </div>
  );
}
