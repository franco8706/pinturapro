"use client";

import { useState } from "react";
import { dejarResena } from "@/app/(marketplace)/actions";

/** Formulario de reseña (estrellas + comentario) para un trabajo completado. */
export function ReviewForm({ jobId, painterId, painter }: { jobId: string; painterId: string; painter: string }) {
  const [open, setOpen] = useState(false);
  const [rating, setRating] = useState(0);
  const [hover, setHover] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!rating) {
      setError("Elegí una calificación.");
      return;
    }
    setError("");
    setLoading(true);
    const fd = new FormData(e.currentTarget);
    fd.set("job_id", jobId);
    fd.set("painter_id", painterId);
    fd.set("rating", String(rating));
    const res = await dejarResena(fd);
    setLoading(false);
    if (res?.error) {
      setError(res.error);
      return;
    }
    setDone(true);
  }

  if (done) {
    return <p className="mt-3 font-body text-body-sm text-[#2D5A3D]">✓ ¡Gracias! Tu reseña ya está publicada.</p>;
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mt-3 px-4 py-2 bg-ink text-bone font-body text-body-sm hover:bg-ink/90 transition-colors"
      >
        Calificar a {painter.split(" ")[0]}
      </button>
    );
  }

  return (
    <form onSubmit={onSubmit} className="mt-3 border-t border-concrete/15 pt-4 space-y-3">
      <div className="flex items-center gap-1" onMouseLeave={() => setHover(0)}>
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => setRating(n)}
            onMouseEnter={() => setHover(n)}
            aria-label={`${n} estrellas`}
            className="text-2xl leading-none transition-colors"
            style={{ color: (hover || rating) >= n ? "#B45309" : "#D4D2CC" }}
          >
            ★
          </button>
        ))}
      </div>
      <textarea
        name="comment"
        rows={3}
        placeholder="Contá cómo fue el trabajo: prolijidad, plazos, trato…"
        className="w-full border border-concrete/30 bg-plaster px-3 py-2 font-body text-body-md text-ink focus:border-ink outline-none transition-colors resize-y"
      />
      {error && <p className="font-body text-body-sm text-[#C41E3A]">{error}</p>}
      <div className="flex gap-3">
        <button
          type="submit"
          disabled={loading}
          className="px-5 py-2.5 bg-ink text-bone font-body text-body-sm hover:bg-ink/90 transition-colors disabled:opacity-50"
        >
          {loading ? "Enviando…" : "Publicar reseña"}
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
