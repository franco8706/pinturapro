"use client";

import { useState } from "react";
import { Navbar } from "@/components/features/navbar";
import { Footer } from "@/components/features/footer";
import { MultiStepForm, type FormStep } from "@/components/features/multi-step-form";
import { cn } from "@/lib/utils";
import { publicarTrabajo } from "../actions";

const tipos = ["interior", "exterior", "ambos"];

// Mapea el chip de presupuesto a un rango numérico (ARS).
const BUDGETS: Record<string, [number | null, number | null]> = {
  "Hasta $300k": [null, 300000],
  "$300k – $500k": [300000, 500000],
  "$500k – $800k": [500000, 800000],
  "+$800k": [800000, null],
  "A definir": [null, null],
};

export default function PublicarPage() {
  const [title, setTitle] = useState("");
  const [tipo, setTipo] = useState("");
  const [surface, setSurface] = useState("");
  const [zone, setZone] = useState("");
  const [budget, setBudget] = useState("");
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");

  async function onComplete() {
    setError("");
    const [bMin, bMax] = BUDGETS[budget] ?? [null, null];
    const fd = new FormData();
    fd.set("title", title);
    fd.set("description", `Tipo: ${tipo}${surface ? ` · Superficie: ${surface} m²` : ""}`);
    fd.set("location", zone);
    if (bMin) fd.set("budget_min", String(bMin));
    if (bMax) fd.set("budget_max", String(bMax));
    const res = await publicarTrabajo(fd);
    if (res?.error) setError(res.error);
    else setDone(true);
  }

  const steps: FormStep[] = [
    {
      id: "detalle",
      title: "¿Qué trabajo necesitás?",
      subtitle: "Un título claro atrae mejores cotizaciones.",
      isValid: title.trim() !== "" && tipo !== "",
      content: (
        <div className="space-y-8 max-w-xl">
          <label className="block">
            <span className="font-mono text-mono-sm text-concrete uppercase tracking-widest block mb-2">Título</span>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ej: Pintura interior depto 2 ambientes"
              className="w-full bg-transparent border-b-2 border-concrete/30 py-2 font-body text-body-lg focus:outline-none focus:border-ink transition-colors"
            />
          </label>
          <div className="flex flex-wrap gap-3">
            {tipos.map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setTipo(t)}
                className={cn(
                  "px-5 py-3 border font-body text-body-sm capitalize transition-colors duration-300",
                  tipo === t ? "border-ink bg-ink text-bone" : "border-concrete/30 hover:border-ink",
                )}
              >
                {t}
              </button>
            ))}
          </div>
        </div>
      ),
    },
    {
      id: "medidas",
      title: "Superficie y ubicación",
      isValid: Number(surface) > 0 && zone.trim() !== "",
      content: (
        <div className="space-y-8 max-w-md">
          <label className="block">
            <span className="font-mono text-mono-sm text-concrete uppercase tracking-widest block mb-2">
              Superficie (m²)
            </span>
            <input
              type="number"
              min={0}
              value={surface}
              onChange={(e) => setSurface(e.target.value)}
              className="w-32 bg-transparent border-b-2 border-concrete/30 py-2 font-body text-body-lg focus:outline-none focus:border-ink transition-colors"
            />
          </label>
          <label className="block">
            <span className="font-mono text-mono-sm text-concrete uppercase tracking-widest block mb-2">Zona</span>
            <input
              value={zone}
              onChange={(e) => setZone(e.target.value)}
              placeholder="Ej: Palermo, CABA"
              className="w-full bg-transparent border-b-2 border-concrete/30 py-2 font-body text-body-lg focus:outline-none focus:border-ink transition-colors"
            />
          </label>
        </div>
      ),
    },
    {
      id: "presupuesto",
      title: "¿Tenés un presupuesto estimado?",
      subtitle: "Opcional, pero ayuda a los pintores a cotizar mejor.",
      isValid: true,
      content: (
        <div className="flex flex-wrap gap-3">
          {["Hasta $300k", "$300k – $500k", "$500k – $800k", "+$800k", "A definir"].map((b) => (
            <button
              key={b}
              type="button"
              onClick={() => setBudget(b)}
              className={cn(
                "px-5 py-3 border font-body text-body-sm transition-colors duration-300",
                budget === b ? "border-ink bg-ink text-bone" : "border-concrete/30 hover:border-ink",
              )}
            >
              {b}
            </button>
          ))}
        </div>
      ),
    },
  ];

  return (
    <main>
      <Navbar />
      <section className="pt-32 sm:pt-40 pb-section min-h-screen">
        <div className="container-asymmetric max-w-3xl">
          {done ? (
            <div className="text-center py-section-sm">
              <div className="w-16 h-16 rounded-full bg-ink text-bone mx-auto mb-8 flex items-center justify-center text-display-md">
                ✓
              </div>
              <h1 className="font-display text-display-lg mb-4">Tu trabajo está publicado</h1>
              <p className="font-body text-body-lg text-concrete max-w-md mx-auto mb-8">
                Los pintores de tu zona ya pueden verlo y enviarte cotizaciones. Te avisamos cuando llegue la primera.
              </p>
              <a href="/cotizaciones" className="font-body text-body-md text-ink underline underline-offset-4">
                Ver mis cotizaciones →
              </a>
            </div>
          ) : (
            <>
              <p className="font-mono text-mono-sm text-concrete uppercase tracking-widest mb-4">Publicar trabajo</p>
              <h1 className="font-display text-display-xl mb-12">Recibí cotizaciones de pintores verificados.</h1>
              <MultiStepForm steps={steps} onComplete={onComplete} submitLabel="Publicar trabajo" />
              {error && <p className="mt-6 font-body text-body-sm text-[#C41E3A]">{error}</p>}
            </>
          )}
        </div>
      </section>
      <Footer />
    </main>
  );
}
