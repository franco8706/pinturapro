"use client";

import Link from "next/link";
import { useState } from "react";
import { deleteObra } from "./actions";
import { useAccion } from "@/lib/use-accion";

/** Acciones de una obra del portfolio: editar (link) y borrar (con confirmación). */
export function PortfolioActions({ id, slug }: { id: string; slug: string }) {
  const [confirming, setConfirming] = useState(false);
  const { ejecutar, pending, error } = useAccion(deleteObra);

  function onDelete() {
    if (!confirming) {
      setConfirming(true);
      return;
    }
    void ejecutar(id);
    // En éxito, revalidatePath refresca el panel y la card desaparece.
  }

  return (
    <div className="mt-2 flex items-center gap-4 font-mono text-mono-sm">
      {/* `py-2`: estos dos median 17 px de alto, medido. Son las acciones de editar y
          BORRAR una obra, o sea lo último que conviene errar con el dedo. */}
      <Link
        href={`/dashboard/editar/${slug}`}
        className="inline-flex items-center py-2 text-concrete hover:text-ink underline underline-offset-2 transition-colors"
      >
        Editar
      </Link>
      <button
        type="button"
        onClick={onDelete}
        onBlur={() => !pending && setConfirming(false)}
        disabled={pending}
        aria-busy={pending}
        className="inline-flex items-center py-2 text-concrete hover:text-[#C41E3A] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {pending ? "Borrando…" : confirming ? "¿Confirmar?" : "Borrar"}
      </button>
      {error && (
        <span role="alert" className="text-[#C41E3A]">
          {error}
        </span>
      )}
    </div>
  );
}
