"use client";

import { useState } from "react";
import { Navbar } from "@/components/features/navbar";
import { Footer } from "@/components/features/footer";
import { MultiStepForm, type FormStep } from "@/components/features/multi-step-form";
import { cn } from "@/lib/utils";

const specialties = ["Residencial", "Comercial", "Industrial", "Esmaltes", "Texturas", "Exteriores", "Impermeabilización"];
const zones = ["CABA", "Zona Norte", "Zona Oeste", "Zona Sur"];

export default function RegistroPage() {
  const [name, setName] = useState("");
  const [years, setYears] = useState("");
  const [zone, setZone] = useState("");
  const [specs, setSpecs] = useState<string[]>([]);
  const [done, setDone] = useState(false);

  const toggleSpec = (s: string) =>
    setSpecs((prev) => (prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]));

  const steps: FormStep[] = [
    {
      id: "datos",
      title: "Empecemos por vos",
      subtitle: "Tu nombre como aparecerá en tu perfil público.",
      isValid: name.trim() !== "" && Number(years) > 0,
      content: (
        <div className="space-y-8 max-w-md">
          <label className="block">
            <span className="font-mono text-mono-sm text-concrete uppercase tracking-widest block mb-2">
              Nombre y apellido
            </span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full bg-transparent border-b-2 border-concrete/30 py-2 font-body text-body-lg focus:outline-none focus:border-ink transition-colors"
            />
          </label>
          <label className="block">
            <span className="font-mono text-mono-sm text-concrete uppercase tracking-widest block mb-2">
              Años de experiencia
            </span>
            <input
              type="number"
              min={0}
              value={years}
              onChange={(e) => setYears(e.target.value)}
              className="w-32 bg-transparent border-b-2 border-concrete/30 py-2 font-body text-body-lg focus:outline-none focus:border-ink transition-colors"
            />
          </label>
        </div>
      ),
    },
    {
      id: "zona",
      title: "¿En qué zona trabajás?",
      isValid: zone !== "",
      content: (
        <div className="flex flex-wrap gap-3">
          {zones.map((z) => (
            <button
              key={z}
              type="button"
              onClick={() => setZone(z)}
              className={cn(
                "px-5 py-3 border font-body text-body-sm transition-colors duration-300",
                zone === z ? "border-ink bg-ink text-bone" : "border-concrete/30 hover:border-ink",
              )}
            >
              {z}
            </button>
          ))}
        </div>
      ),
    },
    {
      id: "especialidades",
      title: "¿Cuáles son tus especialidades?",
      subtitle: "Elegí hasta 4. Aparecerán en tu perfil.",
      isValid: specs.length > 0,
      content: (
        <div className="flex flex-wrap gap-3">
          {specialties.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => toggleSpec(s)}
              className={cn(
                "px-5 py-3 border font-body text-body-sm transition-colors duration-300",
                specs.includes(s) ? "border-ink bg-ink text-bone" : "border-concrete/30 hover:border-ink",
              )}
            >
              {s}
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
              <h1 className="font-display text-display-lg mb-4">¡Bienvenido, {name.split(" ")[0]}!</h1>
              <p className="font-body text-body-lg text-concrete max-w-md mx-auto">
                Recibimos tu solicitud. Vamos a verificar tus datos y te avisamos cuando tu perfil esté activo.
              </p>
            </div>
          ) : (
            <>
              <p className="font-mono text-mono-sm text-concrete uppercase tracking-widest mb-4">Sumate como Pro</p>
              <h1 className="font-display text-display-xl mb-12">Tu perfil profesional en 3 pasos.</h1>
              {/* INTEGRACIÓN: crear cuenta de pintor en Supabase Auth + perfil */}
              <MultiStepForm steps={steps} onComplete={() => setDone(true)} submitLabel="Crear perfil" />
            </>
          )}
        </div>
      </section>
      <Footer />
    </main>
  );
}
