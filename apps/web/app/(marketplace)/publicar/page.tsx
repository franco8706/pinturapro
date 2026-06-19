"use client";

import { useState } from "react";
import { Navbar } from "@/components/features/navbar";
import { Footer } from "@/components/features/footer";
import { MultiStepForm, type FormStep } from "@/components/features/multi-step-form";
import { cn } from "@/lib/utils";

const tipos = ["interior", "exterior", "ambos"];

export default function PublicarPage() {
  const [title, setTitle] = useState("");
  const [tipo, setTipo] = useState("");
  const [surface, setSurface] = useState("");
  const [zone, setZone] = useState("");
  const [budget, setBudget] = useState("");
  const [done, setDone] = useState(false);

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
              {/* INTEGRACIÓN: persistir trabajo en Supabase y notificar pintores de la zona */}
              <MultiStepForm steps={steps} onComplete={() => setDone(true)} submitLabel="Publicar trabajo" />
            </>
          )}
        </div>
      </section>
      <Footer />
    </main>
  );
}
