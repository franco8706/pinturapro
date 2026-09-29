"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useBorrador } from "@/hooks/use-borrador";
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

/**
 * `avisaPorMail` viene del servidor (lib/email.ts es sólo de servidor): sin clave de Resend no
 * sale ningún mail, y la confirmación decía igual "Te avisamos cuando llegue la primera".
 */
export function PublicarForm({ avisaPorMail }: { avisaPorMail: boolean }) {
  const [title, setTitle] = useState("");
  const [tipo, setTipo] = useState("");
  const [surface, setSurface] = useState("");
  const [zone, setZone] = useState("");
  const [budget, setBudget] = useState("");
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");
  // Al publicar, el formulario desaparece y con él el elemento que tenía el foco: quedaba en
  // <body> y un lector de pantalla no se enteraba de que había funcionado (accesibilidad, 29/9).
  const listoRef = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    if (done) listoRef.current?.focus();
  }, [done]);

  // Recargar a mitad del formulario borraba todo sin avisar (medido). Ver use-borrador.ts.
  const borrador = useMemo(() => ({ title, tipo, surface, zone, budget }), [title, tipo, surface, zone, budget]);
  const limpiarBorrador = useBorrador(
    "pinturapro:publicar",
    borrador,
    (v) => {
      if (typeof v.title === "string") setTitle(v.title);
      if (typeof v.tipo === "string") setTipo(v.tipo);
      if (typeof v.surface === "string") setSurface(v.surface);
      if (typeof v.zone === "string") setZone(v.zone);
      if (typeof v.budget === "string") setBudget(v.budget);
    },
    { activo: !done },
  );

  async function onComplete() {
    setError("");
    const [bMin, bMax] = BUDGETS[budget] ?? [null, null];
    const fd = new FormData();
    fd.set("title", title);
    fd.set("description", `Tipo: ${tipo}${surface ? ` · Superficie: ${surface} m²` : ""}`);
    fd.set("location", zone);
    if (bMin) fd.set("budget_min", String(bMin));
    if (bMax) fd.set("budget_max", String(bMax));
    try {
      const res = await publicarTrabajo(fd);
      if (res?.error) setError(res.error);
      else {
        setDone(true);
        limpiarBorrador();
      }
    } catch (err) {
      console.error("[publicar] falló:", err);
      setError("No pudimos publicar el trabajo. Revisá tu conexión y probá de nuevo.");
    }
  }

  const steps: FormStep[] = [
    {
      id: "detalle",
      title: "¿Qué trabajo necesitás?",
      subtitle: "Un título claro atrae mejores cotizaciones.",
      faltan: [title.trim() === "" && "el título", tipo === "" && "el tipo de trabajo"].filter((x): x is string => !!x),
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
      faltan: [!(Number(surface) > 0) && "la superficie", zone.trim() === "" && "la zona"].filter((x): x is string => !!x),
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
              aria-describedby="zona-publica"
              className="w-full bg-transparent border-b-2 border-concrete/30 py-2 font-body text-body-lg focus:outline-none focus:border-ink transition-colors"
            />
            <span id="zona-publica" className="block mt-2 font-body text-body-sm text-concrete">
              Poné el barrio, no la dirección: la zona se ve en el tablero de trabajos.
            </span>
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
              <h1 ref={listoRef} tabIndex={-1} className="font-display text-display-lg mb-4 outline-none">
                Tu trabajo está publicado
              </h1>
              <p className="font-body text-body-lg text-concrete max-w-md mx-auto mb-8">
                Ya está en el tablero de trabajos: los pintores pueden verlo y enviarte cotizaciones.
                {avisaPorMail
                  ? " Te avisamos por mail cuando llegue la primera."
                  : " Las vas a ver en tus cotizaciones apenas lleguen."}
              </p>
              <a href="/cotizaciones" className="font-body text-body-md text-ink underline underline-offset-4">
                Ver mis cotizaciones →
              </a>
            </div>
          ) : (
            <>
              <p className="font-mono text-mono-sm text-concrete uppercase tracking-widest mb-4">Publicar trabajo</p>
              <h1 className="font-display text-display-xl mb-6">Recibí cotizaciones de pintores independientes.</h1>
              {/* Nada le decía al cliente que el pedido es público. El tablero no filtra por zona
                  (decía "pintores de tu zona"), y el título y la zona los escribe la persona: ahí
                  puede terminar una dirección. Encontrado en la ronda de escala, 29/9. */}
              <p className="font-body text-body-md text-concrete max-w-xl mb-12">
                Tu pedido —título, tipo, superficie, zona y presupuesto— se publica en el tablero de
                trabajos, a la vista de cualquiera. Tu contacto no: se comparte recién cuando aceptás
                una cotización, y tu nombre sólo lo ven los pintores con cuenta.
              </p>
              <MultiStepForm steps={steps} onComplete={onComplete} submitLabel="Publicar trabajo" />
              {error && <p role="alert" className="mt-6 font-body text-body-sm text-[#C41E3A]">{error}</p>}
            </>
          )}
        </div>
      </section>
      <Footer />
    </main>
  );
}
