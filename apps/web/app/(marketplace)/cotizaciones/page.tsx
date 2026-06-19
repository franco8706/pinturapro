"use client";

import { useState } from "react";
import { Navbar } from "@/components/features/navbar";
import { Footer } from "@/components/features/footer";
import { LevelBadge } from "@/components/features/level-badge";
import { MagneticButton } from "@/components/features/magnetic-button";
import { cn } from "@/lib/utils";

interface Quote {
  id: string;
  painter: string;
  level: "Silver" | "Gold" | "Master";
  rating: number;
  amount: string;
  days: number;
  message: string;
}

const quotes: Quote[] = [
  {
    id: "q1",
    painter: "Martín Rojas",
    level: "Master",
    rating: 4.9,
    amount: "$320.000",
    days: 4,
    message: "Incluye materiales premium, dos manos y protección de pisos. Puedo arrancar la semana que viene.",
  },
  {
    id: "q2",
    painter: "Lucía Fernández",
    level: "Gold",
    rating: 4.7,
    amount: "$298.000",
    days: 5,
    message: "Presupuesto cerrado con mano de obra y materiales. Garantía de 1 año sobre la terminación.",
  },
  {
    id: "q3",
    painter: "Diego Sosa",
    level: "Silver",
    rating: 4.5,
    amount: "$275.000",
    days: 6,
    message: "Trabajo prolijo, referencias en la zona. Materiales a cargo del cliente o los coordino yo.",
  },
];

export default function CotizacionesPage() {
  const [accepted, setAccepted] = useState<string | null>(null);

  return (
    <main>
      <Navbar />
      <section className="pt-32 sm:pt-40 pb-section min-h-screen">
        <div className="container-asymmetric max-w-4xl">
          <p className="font-mono text-mono-sm text-concrete uppercase tracking-widest mb-4">Tus cotizaciones</p>
          <h1 className="font-display text-display-xl mb-3">Pintura interior · 2 ambientes</h1>
          <p className="font-body text-body-lg text-concrete mb-12">
            Palermo, CABA · 55 m² · {quotes.length} cotizaciones recibidas
          </p>

          <div className="space-y-4">
            {quotes.map((q) => {
              const isAccepted = accepted === q.id;
              return (
                <div
                  key={q.id}
                  className={cn(
                    "p-6 border transition-colors duration-300",
                    isAccepted ? "border-ink bg-mist" : "border-concrete/15",
                  )}
                >
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                    <div className="flex items-start gap-4">
                      <div className="w-12 h-12 rounded-full bg-mist flex items-center justify-center font-display text-body-lg shrink-0">
                        {q.painter.charAt(0)}
                      </div>
                      <div>
                        <div className="flex items-center gap-3">
                          <h3 className="font-display text-display-md leading-none">{q.painter}</h3>
                          <LevelBadge level={q.level} />
                        </div>
                        <p className="font-body text-body-sm text-concrete mt-1.5">
                          ★ {q.rating.toFixed(1)} · Entrega en {q.days} días
                        </p>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="font-display text-display-md leading-none">{q.amount}</p>
                    </div>
                  </div>

                  <p className="font-body text-body-md text-concrete leading-relaxed mt-4 sm:pl-16">{q.message}</p>

                  <div className="flex items-center gap-4 mt-6 sm:pl-16">
                    {isAccepted ? (
                      <MagneticButton href="/checkout" variant="primary">
                        Ir al pago
                      </MagneticButton>
                    ) : (
                      <>
                        <button
                          onClick={() => setAccepted(q.id)}
                          className="px-6 py-3 bg-ink text-bone font-body text-body-sm hover:bg-ink/90 transition-colors"
                        >
                          Aceptar cotización
                        </button>
                        <button className="font-body text-body-sm text-concrete hover:text-ink transition-colors">
                          Mensaje
                        </button>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>
      <Footer />
    </main>
  );
}
