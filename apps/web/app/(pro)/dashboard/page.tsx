"use client";

import { Navbar } from "@/components/features/navbar";
import { Footer } from "@/components/features/footer";
import { LevelBadge } from "@/components/features/level-badge";
import { MagneticButton } from "@/components/features/magnetic-button";
import { mockJobs } from "@/lib/data";

const metrics = [
  { label: "Trabajos activos", value: "3" },
  { label: "Cotizaciones enviadas", value: "12" },
  { label: "Tasa de adjudicación", value: "42%" },
  { label: "Ingresos del mes", value: "$1.2M" },
];

export default function PainterDashboardPage() {
  return (
    <main>
      <Navbar />
      <section className="pt-32 sm:pt-40 pb-section min-h-screen">
        <div className="container-asymmetric">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 mb-12">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-full bg-mist flex items-center justify-center font-display text-display-md">
                M
              </div>
              <div>
                <h1 className="font-display text-display-lg leading-none">Hola, Martín</h1>
                <div className="mt-2">
                  <LevelBadge level="Master" />
                </div>
              </div>
            </div>
            <MagneticButton href="/trabajos" variant="primary">
              Buscar trabajos
            </MagneticButton>
          </div>

          {/* Métricas */}
          <div className="grid grid-cols-2 lg:grid-cols-4 border border-concrete/15 mb-12">
            {metrics.map((m, i) => (
              <div
                key={m.label}
                className="p-6 lg:p-8 border-concrete/15 border-r last:border-r-0 [&:nth-child(2)]:border-r-0 lg:[&:nth-child(2)]:border-r"
                style={{ borderBottomWidth: i < 2 ? 1 : 0 }}
              >
                <p className="font-display text-display-lg leading-none">{m.value}</p>
                <p className="font-body text-body-sm text-concrete mt-2">{m.label}</p>
              </div>
            ))}
          </div>

          {/* Trabajos activos */}
          <h2 className="font-display text-display-md mb-6">Tus trabajos en curso</h2>
          <div className="space-y-3">
            {mockJobs.slice(0, 2).map((job) => (
              <div
                key={job.id}
                className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 border border-concrete/15"
              >
                <div>
                  <p className="font-display text-body-lg">{job.title}</p>
                  <p className="font-body text-body-sm text-concrete mt-1">
                    {job.zone} · {job.surface} m²
                  </p>
                </div>
                <div className="flex items-center gap-6">
                  <span className="font-mono text-mono-sm text-concrete uppercase tracking-widest">{job.status}</span>
                  <span className="font-body text-body-md text-ink">{job.budget}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
      <Footer />
    </main>
  );
}
