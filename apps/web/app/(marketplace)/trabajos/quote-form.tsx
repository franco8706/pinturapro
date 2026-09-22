"use client";

import { useRef, useState } from "react";
import { cotizar } from "../actions";

/** Formulario inline para que un pintor cotice un pedido de trabajo. */
export function QuoteForm({ projectId, clientId }: { projectId: string; clientId: string }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);

  /**
   * Cerrojo sincrónico contra el doble envío. `disabled={loading}` no alcanza: el estado de
   * React recién se ve después de repintar, así que varios clics dentro del mismo instante
   * entran todos. Medido en /contacto: tres clics seguidos crearon TRES consultas.
   */
  const enviando = useRef(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (enviando.current) return;
    enviando.current = true;
    setError("");
    setLoading(true);
    const fd = new FormData(e.currentTarget);
    fd.set("project_id", projectId);
    fd.set("client_id", clientId);
    try {
      const res = await cotizar(fd);
      if (res?.error) {
        setError(res.error);
        return;
      }
      setSent(true);
    } catch (err) {
      // Sin este catch, un rechazo de la promesa dejaba el botón clavado en "Enviando…".
      console.error("[cotizar] falló:", err);
      setError("No pudimos enviar la cotización. Revisá tu conexión y probá de nuevo.");
    } finally {
      setLoading(false);
      enviando.current = false;
    }
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
            aria-describedby="aviso-comision"
            className="mt-1 w-full sm:w-44 border border-concrete/30 bg-plaster px-3 py-2 font-body text-body-md text-ink focus:border-ink outline-none transition-colors"
          />
        </label>
      </div>
      {/* La plataforma calcula y guarda un 10% de comisión sobre este monto
          (`commissionFor`, y la policy de la base lo exige), y la web no lo decía en NINGÚN
          lado: ni acá, ni en el alta de pintor, ni en los términos. El único lugar donde
          aparecía era el panel del administrador, que el pintor no ve. La app móvil sí lo
          avisa en esta misma pantalla. Cobrarle a alguien un porcentaje que nunca se le dijo
          no se arregla después. */}
      <p id="aviso-comision" className="font-body text-body-sm text-concrete">
        Poné el precio final para el cliente, con materiales y mano de obra. Pintura Pro cobra
        una comisión del <strong className="text-ink">10%</strong> sobre el trabajo adjudicado.
      </p>
      <label className="block">
        <span className="font-mono text-mono-sm uppercase tracking-widest text-concrete">Mensaje</span>
        <textarea
          name="note"
          rows={3}
          placeholder="Qué incluye, materiales, plazos…"
          className="mt-1 w-full border border-concrete/30 bg-plaster px-3 py-2 font-body text-body-md text-ink focus:border-ink outline-none transition-colors resize-y"
        />
      </label>
      {error && <p role="alert" className="font-body text-body-sm text-[#C41E3A]">{error}</p>}
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
