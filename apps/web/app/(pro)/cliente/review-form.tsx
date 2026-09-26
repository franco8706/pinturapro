"use client";

import { useRef, useState } from "react";
import { dejarResena } from "@/app/(marketplace)/actions";

/** Formulario de reseña (estrellas + comentario) para un trabajo completado. */
export function ReviewForm({ jobId, painterId, painter }: { jobId: string; painterId: string; painter: string }) {
  const [open, setOpen] = useState(false);
  const [rating, setRating] = useState(0);
  const [hover, setHover] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  /**
   * Cerrojo sincrónico contra el doble envío. `disabled={loading}` no alcanza: el estado de
   * React recién se ve después de repintar, así que varios clics dentro del mismo instante
   * entran todos. Medido en /contacto: tres clics seguidos crearon TRES consultas.
   */
  const enviando = useRef(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (enviando.current) return;
    // La validación va ANTES de trabar: si no, salir por acá dejaría el cerrojo puesto para
    // siempre y el formulario no volvería a enviarse nunca.
    if (!rating) {
      setError("Elegí una calificación.");
      return;
    }
    enviando.current = true;
    setError("");
    setLoading(true);
    const fd = new FormData(e.currentTarget);
    fd.set("job_id", jobId);
    fd.set("painter_id", painterId);
    fd.set("rating", String(rating));
    try {
      const res = await dejarResena(fd);
      if (res?.error) {
        setError(res.error);
        return;
      }
      setDone(true);
    } catch (err) {
      console.error("[resena] falló:", err);
      setError("No pudimos guardar la reseña. Revisá tu conexión y probá de nuevo.");
    } finally {
      setLoading(false);
      enviando.current = false;
    }
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
      {/* Las estrellas decían cuál era cada una ("3 estrellas") pero no cuál estaba ELEGIDA:
          la única señal era el color, ámbar contra gris. Quien usa un lector de pantalla podía
          recorrerlas enteras sin saber qué calificación estaba por mandarle a una persona.
          `aria-pressed` lo dice en cada una, y el texto de abajo lo confirma en voz alta. */}
      <div
        role="group"
        aria-label="Tu calificación, de 1 a 5 estrellas"
        className="flex items-center gap-1"
        onMouseLeave={() => setHover(0)}
      >
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => setRating(n)}
            onMouseEnter={() => setHover(n)}
            aria-label={n === 1 ? "1 estrella" : `${n} estrellas`}
            aria-pressed={rating === n}
            className="text-2xl leading-none transition-colors"
            style={{ color: (hover || rating) >= n ? "#B45309" : "#D4D2CC" }}
          >
            ★
          </button>
        ))}
        <span role="status" aria-live="polite" className="ml-2 font-body text-body-sm text-concrete">
          {rating > 0 ? `${rating} de 5` : "Elegí una calificación"}
        </span>
      </div>
      {/* El nombre del campo no puede vivir sólo en el `placeholder`: desaparece apenas se
          escribe la primera letra, y no todos los lectores de pantalla lo usan como nombre. */}
      <label htmlFor={`resena-${jobId}`} className="sr-only">
        Tu comentario sobre el trabajo
      </label>
      <textarea
        id={`resena-${jobId}`}
        name="comment"
        maxLength={1000}
        rows={3}
        placeholder="Contá cómo fue el trabajo: prolijidad, plazos, trato…"
        className="w-full border border-concrete/30 bg-plaster px-3 py-2 font-body text-body-md text-ink focus:border-ink outline-none transition-colors resize-y"
      />
      {/* Lo que va a pasar con esto, dicho ANTES de escribirlo.
          Estaba en /terminos, que nadie lee con la lapicera en la mano. Son tres cosas que
          cambian lo que alguien escribe: queda público, queda pegado al nombre de una persona
          real, y no se va si después cerrás tu cuenta (es a propósito —si las reseñas se
          fueran con la cuenta, cualquiera podría bajarle el promedio a un pintor dándose de
          baja—, pero justamente por eso hay que avisarlo antes). */}
      <p className="font-body text-body-sm text-concrete">
        Tu reseña es pública y queda en el perfil de {painter}, con tu nombre.{" "}
        <strong className="text-ink">No se borra si después cerrás tu cuenta:</strong> es parte
        de la reputación que esa persona construyó con su trabajo.
      </p>
      {error && <p role="alert" className="font-body text-body-sm text-[#C41E3A]">{error}</p>}
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
