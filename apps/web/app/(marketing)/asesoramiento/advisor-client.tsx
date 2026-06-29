"use client";

import { useState } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";

type Step = { id: string; question: string; options: { value: string; label: string }[] };

const STEPS: Step[] = [
  {
    id: "tipo",
    question: "¿Qué querés pintar?",
    options: [
      { value: "interior", label: "Interior" },
      { value: "exterior", label: "Exterior" },
      { value: "ambos", label: "Ambos" },
    ],
  },
  {
    id: "estado",
    question: "¿En qué estado está la superficie?",
    options: [
      { value: "bien", label: "Bien, solo cambiar el color" },
      { value: "detalles", label: "Con detalles para reparar" },
      { value: "humedad", label: "Con humedad o descascarado" },
    ],
  },
  {
    id: "prioridad",
    question: "¿Cuál es tu prioridad?",
    options: [
      { value: "economico", label: "Cuidar el presupuesto" },
      { value: "durabilidad", label: "Que dure muchos años" },
      { value: "premium", label: "Una terminación premium" },
    ],
  },
];

function recomendar(a: Record<string, string>): { titulo: string; puntos: string[] } {
  const puntos: string[] = [];

  if (a.tipo === "exterior" || a.tipo === "ambos")
    puntos.push("Para exteriores conviene una pintura impermeabilizante o membrana, resistente a sol y lluvia.");
  if (a.tipo === "interior" || a.tipo === "ambos")
    puntos.push("Para interiores, un látex lavable mate da buen acabado; en cocina y baño, antihongos.");

  if (a.estado === "humedad")
    puntos.push("Primero hay que resolver la humedad (causa + secado + fijador antihumedad). Pintar encima sin tratar no dura.");
  else if (a.estado === "detalles")
    puntos.push("Sumá una etapa de preparación: enduido, lijado y sellador antes de pintar para una terminación pareja.");
  else puntos.push("Como la superficie está sana, con buena preparación liviana y 2 manos alcanza.");

  if (a.prioridad === "economico")
    puntos.push("Pedí presupuesto a varios pintores del marketplace y compará: vas a encontrar buenas opciones por zona.");
  else if (a.prioridad === "durabilidad")
    puntos.push("Invertí en primera marca y en la preparación: es lo que define cuántos años aguanta sin repintar.");
  else puntos.push("Buscá un pintor con nivel Gold/Master y mirá su portfolio: la terminación premium se ve en los detalles.");

  return { titulo: "Tu recomendación", puntos };
}

export function AdvisorClient() {
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});

  const done = step >= STEPS.length;

  function pick(id: string, value: string) {
    setAnswers((p) => ({ ...p, [id]: value }));
    setStep((s) => s + 1);
  }

  function reset() {
    setAnswers({});
    setStep(0);
  }

  if (done) {
    const rec = recomendar(answers);
    return (
      <div className="border border-ink p-6 sm:p-10 bg-bone">
        <span className="font-mono text-mono-sm uppercase tracking-widest text-concrete">{rec.titulo}</span>
        <ul className="mt-5 space-y-3">
          {rec.puntos.map((p, i) => (
            <li key={i} className="flex gap-3 font-body text-body-md text-ink">
              <span className="text-[#2D5A3D] shrink-0">✓</span>
              <span>{p}</span>
            </li>
          ))}
        </ul>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link href="/publicar" className="px-5 py-3 bg-ink text-bone font-body text-body-sm hover:bg-ink/90 transition-colors">
            Publicar mi trabajo y recibir cotizaciones
          </Link>
          <Link href="/pintores" className="px-5 py-3 border border-concrete/30 font-body text-body-sm hover:border-ink transition-colors">
            Ver pintores
          </Link>
          <button type="button" onClick={reset} className="px-5 py-3 font-body text-body-sm text-concrete hover:text-ink transition-colors">
            Volver a empezar
          </button>
        </div>
      </div>
    );
  }

  const s = STEPS[step];
  return (
    <div className="border border-concrete/15 p-6 sm:p-10">
      <div className="flex items-center gap-2 mb-6">
        {STEPS.map((_, i) => (
          <span key={i} className="h-1 flex-1" style={{ backgroundColor: i <= step ? "#141414" : "#D4D2CC" }} />
        ))}
      </div>
      <span className="font-mono text-mono-sm uppercase tracking-widest text-concrete">
        Paso {step + 1} de {STEPS.length}
      </span>
      <h2 className="font-display text-display-md mt-2 mb-6">{s.question}</h2>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {s.options.map((o) => (
          <button
            key={o.value}
            type="button"
            onClick={() => pick(s.id, o.value)}
            className={cn(
              "p-5 border text-left font-body text-body-md transition-colors",
              answers[s.id] === o.value ? "border-ink bg-ink text-bone" : "border-concrete/30 hover:border-ink",
            )}
          >
            {o.label}
          </button>
        ))}
      </div>
      {step > 0 && (
        <button type="button" onClick={() => setStep((s) => s - 1)} className="mt-6 font-body text-body-sm text-concrete hover:text-ink transition-colors">
          ← Volver
        </button>
      )}
    </div>
  );
}
