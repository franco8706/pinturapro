"use client";

import { useState } from "react";
import { cotizar } from "../actions";

/** Formulario inline para que un pintor cotice un pedido de trabajo. */
export function QuoteForm({ projectId, clientId }: { projectId: string; clientId: string }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setLoading(true);
    const fd = new FormData(e.currentTarget);
    fd.set("project_id", projectId);
    fd.set("client_id", clientId);
    const res = await cotizar(fd);
    setLoading(false);
    if (res?.error) {
      setError(res.error);
      return;
    }
    setSent(true);
  }

  if (sent) {
    return <p className="mt-4 font-body text-body-sm text-[#2D5A3D]">✓ Cotización enviada. El cliente la verá en su panel.</p>;
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mt-4 px-5 py-2.5 bg-ink text-bone font-body text-body-sm hover:bg-ink/90 transition-colors"
      >
        Cotizar este trabajo
      </button>
    );
  }

  return (
    <form onSubmit={onSubmit} className="mt-4 space-y-3 border-t border-concrete/15 pt-4">
      <div className="flex flex-col sm:flex-row gap-3">
        <label className="block">
          <span className="font-mono text-mono-sm uppercase tracking-widest text-concrete">Monto (ARS)</span>
          <input
            name="amount"
            inputMode="numeric"
            required
            placeholder="320000"
            className="mt-1 w-full sm:w-44 border border-concrete/30 bg-plaster px-3 py-2 font-body text-body-md text-ink focus:border-ink outline-none transition-colors"
          />
        </label>
      </div>
      <label className="block">
        <span className="font-mono text-mono-sm uppercase tracking-widest text-concrete">Mensaje</span>
        <textarea
          name="note"
          rows={3}
          placeholder="Qué incluye, materiales, plazos…"
          className="mt-1 w-full border border-concrete/30 bg-plaster px-3 py-2 font-body text-body-md text-ink focus:border-ink outline-none transition-colors resize-y"
        />
      </label>
      {error && <p className="font-body text-body-sm text-[#C41E3A]">{error}</p>}
      <div className="flex gap-3">
        <button
          type="submit"
          disabled={loading}
          className="px-5 py-2.5 bg-ink text-bone font-body text-body-sm hover:bg-ink/90 transition-colors disabled:opacity-50"
        >
          {loading ? "Enviando…" : "Enviar cotización"}
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="px-5 py-2.5 border border-concrete/30 font-body text-body-sm hover:border-ink transition-colors"
        >
          Cancelar
        </button>
      </div>
    </form>
  );
}
