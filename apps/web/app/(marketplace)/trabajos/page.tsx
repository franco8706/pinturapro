"use client";

import { useState } from "react";
import Link from "next/link";
import { Navbar } from "@/components/features/navbar";
import { Footer } from "@/components/features/footer";
import { Reveal, SectionLabel, EmptyState } from "@/components/features/states";
import { mockJobs } from "@/lib/data";
import { cn } from "@/lib/utils";

const filters = ["Todos", "interior", "exterior", "ambos"];

export default function TrabajosPage() {
  const [filter, setFilter] = useState("Todos");
  const jobs = mockJobs.filter((j) => filter === "Todos" || j.type === filter);

  return (
    <main>
      <Navbar />
      <section className="pt-32 sm:pt-40 pb-section">
        <div className="container-asymmetric">
          <div className="mb-12">
            <SectionLabel className="mb-4">Marketplace</SectionLabel>
            <h1 className="font-display text-display-xl max-w-3xl text-balance mb-6">
              Trabajos disponibles para cotizar.
            </h1>
            <p className="font-body text-body-lg text-concrete max-w-xl">
              Clientes reales buscando pintores. Enviá tu cotización y ganá el trabajo.
            </p>
          </div>

          <div className="flex flex-wrap gap-2 mb-10">
            {filters.map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={cn(
                  "px-4 py-2 font-body text-body-sm border capitalize transition-colors duration-300",
                  filter === f ? "border-ink bg-ink text-bone" : "border-concrete/30 hover:border-ink",
                )}
              >
                {f}
              </button>
            ))}
          </div>

          {jobs.length === 0 ? (
            <EmptyState title="Sin trabajos" description="No hay trabajos con ese filtro por ahora." />
          ) : (
            <div className="space-y-4">
              {jobs.map((job, i) => (
                <Reveal key={job.id} delay={i * 0.05}>
                  <Link
                    href="/cotizaciones"
                    className="group flex flex-col lg:flex-row lg:items-center justify-between gap-6 p-6 border border-concrete/15 hover:border-ink transition-colors duration-300"
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <span className="font-mono text-mono-sm text-concrete uppercase tracking-widest capitalize">
                          {job.type}
                        </span>
                        <span className="w-1 h-1 rounded-full bg-concrete/40" />
                        <span className="font-mono text-mono-sm text-concrete">{job.postedAt}</span>
                      </div>
                      <h3 className="font-display text-display-md leading-tight">{job.title}</h3>
                      <p className="font-body text-body-sm text-concrete mt-1">
                        {job.zone} · {job.surface} m²
                      </p>
                    </div>
                    <div className="flex items-center gap-8">
                      <div className="text-right">
                        <p className="font-body text-body-md text-ink">{job.budget}</p>
                        <p className="font-mono text-mono-sm text-concrete mt-1">{job.quotes} cotizaciones</p>
                      </div>
                      <span
                        aria-hidden
                        className="font-mono text-body-lg text-concrete group-hover:translate-x-1 group-hover:text-ink transition-all"
                      >
                        →
                      </span>
                    </div>
                  </Link>
                </Reveal>
              ))}
            </div>
          )}
        </div>
      </section>
      <Footer />
    </main>
  );
}
