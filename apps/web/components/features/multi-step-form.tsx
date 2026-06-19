"use client";

import { useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";

export interface FormStep {
  id: string;
  title: string;
  subtitle?: string;
  content: ReactNode;
  /** Validación opcional del paso antes de avanzar. */
  isValid?: boolean;
}

interface MultiStepFormProps {
  steps: FormStep[];
  onComplete?: () => void;
  submitLabel?: string;
}

/**
 * Formulario multi-paso con barra de progreso y navegación.
 * El estado de cada campo vive en el componente padre (los inputs se pasan
 * como `content`); este componente solo orquesta pasos, validación y envío.
 */
export function MultiStepForm({ steps, onComplete, submitLabel = "Enviar" }: MultiStepFormProps) {
  const [current, setCurrent] = useState(0);
  const isLast = current === steps.length - 1;
  const step = steps[current];
  const canAdvance = step.isValid !== false;

  const next = () => {
    if (!canAdvance) return;
    if (isLast) {
      onComplete?.();
    } else {
      setCurrent((c) => Math.min(steps.length - 1, c + 1));
    }
  };

  const back = () => setCurrent((c) => Math.max(0, c - 1));

  return (
    <div>
      {/* Progreso */}
      <div className="flex items-center gap-2 mb-12">
        {steps.map((s, i) => (
          <div key={s.id} className="flex-1">
            <div
              className={cn(
                "h-1 transition-colors duration-500 ease-expo-out",
                i <= current ? "bg-ink" : "bg-concrete/20",
              )}
            />
            <span
              className={cn(
                "font-mono text-mono-sm mt-2 block transition-colors",
                i === current ? "text-ink" : "text-concrete/60",
              )}
            >
              {String(i + 1).padStart(2, "0")}
            </span>
          </div>
        ))}
      </div>

      {/* Paso actual */}
      <div key={step.id} className="animate-[fadeIn_0.4s_ease-out]">
        <p className="font-mono text-mono-sm text-concrete uppercase tracking-widest mb-3">
          Paso {current + 1} de {steps.length}
        </p>
        <h2 className="font-display text-display-lg mb-2">{step.title}</h2>
        {step.subtitle && <p className="font-body text-body-lg text-concrete mb-8">{step.subtitle}</p>}
        <div className="mt-8">{step.content}</div>
      </div>

      {/* Navegación */}
      <div className="flex items-center justify-between mt-12 pt-8 border-t border-concrete/15">
        <button
          type="button"
          onClick={back}
          disabled={current === 0}
          className="font-body text-body-sm text-concrete hover:text-ink transition-colors disabled:opacity-0"
        >
          ← Atrás
        </button>
        <button
          type="button"
          onClick={next}
          disabled={!canAdvance}
          className={cn(
            "px-7 py-4 font-body text-body-sm bg-ink text-bone transition-all duration-300",
            "hover:bg-ink/90 disabled:opacity-40 disabled:cursor-not-allowed",
          )}
        >
          {isLast ? submitLabel : "Continuar →"}
        </button>
      </div>
    </div>
  );
}
