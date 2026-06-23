"use client";

import { useState } from "react";
import { Navbar } from "@/components/features/navbar";
import { Footer } from "@/components/features/footer";
import { MultiStepForm, type FormStep } from "@/components/features/multi-step-form";
import { cn } from "@/lib/utils";

const tipos = [
  { id: "interior", label: "Interior", desc: "Paredes, cielorrasos y aberturas internas" },
  { id: "exterior", label: "Exterior", desc: "Frentes, medianeras e impermeabilización" },
  { id: "ambos", label: "Ambos", desc: "Obra completa interior y exterior" },
];

const ambientesInterior = ["Living", "Comedor", "Cocina", "Dormitorios", "Baños", "Pasillos"];
const ambientesExterior = ["Frente", "Medianera", "Balcón / Terraza", "Rejas", "Galería", "Cochera"];

export default function CotizarPage() {
  const [tipo, setTipo] = useState("");
  const [superficie, setSuperficie] = useState("");
  const [rooms, setRooms] = useState<string[]>([]);
  const [contact, setContact] = useState({ name: "", email: "", phone: "" });
  const [done, setDone] = useState(false);

  // Ambientes según el tipo: exterior no muestra baño/dormitorio/etc. y viceversa.
  const ambientes =
    tipo === "exterior"
      ? ambientesExterior
      : tipo === "interior"
        ? ambientesInterior
        : [...ambientesInterior, ...ambientesExterior];

  const toggleRoom = (room: string) =>
    setRooms((prev) => (prev.includes(room) ? prev.filter((r) => r !== room) : [...prev, room]));

  // Al cambiar el tipo, descartar ambientes que ya no aplican.
  const selectTipo = (next: string) => {
    setTipo(next);
    const valid =
      next === "exterior" ? ambientesExterior : next === "interior" ? ambientesInterior : [...ambientesInterior, ...ambientesExterior];
    setRooms((prev) => prev.filter((r) => valid.includes(r)));
  };

  const steps: FormStep[] = [
    {
      id: "tipo",
      title: "¿Qué querés pintar?",
      subtitle: "Empecemos por el tipo de trabajo.",
      isValid: tipo !== "",
      content: (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {tipos.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => selectTipo(t.id)}
              className={cn(
                "text-left p-6 border transition-colors duration-300",
                tipo === t.id ? "border-ink bg-ink text-bone" : "border-concrete/30 hover:border-ink",
              )}
            >
              <span className="font-display text-display-md block mb-2">{t.label}</span>
              <span className={cn("font-body text-body-sm", tipo === t.id ? "text-bone/70" : "text-concrete")}>
                {t.desc}
              </span>
            </button>
          ))}
        </div>
      ),
    },
    {
      id: "superficie",
      title: "Aproximadamente, ¿cuántos m²?",
      subtitle: "No hace falta que sea exacto, lo ajustamos en la visita.",
      isValid: Number(superficie) > 0,
      content: (
        <div className="max-w-sm">
          <div className="flex items-baseline gap-3">
            <input
              type="number"
              min={0}
              value={superficie}
              onChange={(e) => setSuperficie(e.target.value)}
              placeholder="0"
              className="w-40 bg-transparent border-b-2 border-ink font-display text-display-lg focus:outline-none"
            />
            <span className="font-display text-display-md text-concrete">m²</span>
          </div>
          <div className="flex gap-2 mt-6">
            {[40, 70, 100, 150].map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => setSuperficie(String(v))}
                className="px-4 py-2 border border-concrete/30 font-mono text-mono-sm hover:border-ink transition-colors"
              >
                {v} m²
              </button>
            ))}
          </div>
        </div>
      ),
    },
    {
      id: "ambientes",
      title: "¿Qué ambientes incluye?",
      subtitle: "Seleccioná todos los que apliquen.",
      isValid: rooms.length > 0,
      content: (
        <div className="flex flex-wrap gap-3">
          {ambientes.map((room) => (
            <button
              key={room}
              type="button"
              onClick={() => toggleRoom(room)}
              className={cn(
                "px-5 py-3 border font-body text-body-sm transition-colors duration-300",
                rooms.includes(room) ? "border-ink bg-ink text-bone" : "border-concrete/30 hover:border-ink",
              )}
            >
              {room}
            </button>
          ))}
        </div>
      ),
    },
    {
      id: "contacto",
      title: "¿Cómo te contactamos?",
      subtitle: "Te enviamos el presupuesto cerrado en menos de 24hs.",
      isValid: contact.name !== "" && /\S+@\S+\.\S+/.test(contact.email),
      content: (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 max-w-2xl">
          <Field label="Nombre" value={contact.name} onChange={(v) => setContact((c) => ({ ...c, name: v }))} />
          <Field label="Teléfono" value={contact.phone} onChange={(v) => setContact((c) => ({ ...c, phone: v }))} />
          <div className="sm:col-span-2">
            <Field
              label="Email"
              type="email"
              value={contact.email}
              onChange={(v) => setContact((c) => ({ ...c, email: v }))}
            />
          </div>
        </div>
      ),
    },
  ];

  return (
    <main>
      <Navbar />
      <section className="pt-32 sm:pt-40 pb-section bg-plaster min-h-screen">
        <div className="container-asymmetric max-w-3xl">
          {done ? (
            <div className="text-center py-section-sm">
              <div className="w-16 h-16 rounded-full bg-ink text-bone mx-auto mb-8 flex items-center justify-center text-display-md">
                ✓
              </div>
              <h1 className="font-display text-display-lg mb-4">¡Recibimos tu pedido!</h1>
              <p className="font-body text-body-lg text-concrete max-w-md mx-auto">
                Te vamos a contactar a <strong className="text-ink">{contact.email}</strong> con el presupuesto en
                menos de 24 horas. Gracias por confiar en Pintura Pro.
              </p>
            </div>
          ) : (
            <>
              <p className="font-mono text-mono-sm text-concrete uppercase tracking-widest mb-4">Cotización online</p>
              <h1 className="font-display text-display-xl mb-12">Tu presupuesto en 4 pasos.</h1>
              {/* INTEGRACIÓN: enviar { tipo, superficie, rooms, contact } a Supabase + notificación */}
              <MultiStepForm steps={steps} onComplete={() => setDone(true)} submitLabel="Pedir presupuesto" />
            </>
          )}
        </div>
      </section>
      <Footer />
    </main>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
}) {
  return (
    <label className="block">
      <span className="font-mono text-mono-sm text-concrete uppercase tracking-widest block mb-2">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full bg-transparent border-b-2 border-concrete/30 py-2 font-body text-body-lg focus:outline-none focus:border-ink transition-colors"
      />
    </label>
  );
}
