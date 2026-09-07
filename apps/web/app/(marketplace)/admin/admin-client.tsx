"use client";

import { useState } from "react";
import { Navbar } from "@/components/features/navbar";
import { Footer } from "@/components/features/footer";
import { LevelBadge } from "@/components/features/level-badge";
import { mockPainters, mockJobs } from "@/lib/data";
import { cn } from "@/lib/utils";

const tabs = ["Pintores", "Trabajos", "Verificaciones"] as const;
type Tab = (typeof tabs)[number];

export default function AdminPage() {
  const [tab, setTab] = useState<Tab>("Pintores");

  return (
    <main>
      <Navbar />
      <section className="pt-32 sm:pt-40 pb-section min-h-screen">
        <div className="container-asymmetric">
          <div className="flex items-center gap-3 mb-2">
            <p className="font-mono text-mono-sm text-concrete uppercase tracking-widest">Panel admin</p>
            <span className="px-2 py-0.5 bg-[#C41E3A]/10 text-[#C41E3A] font-mono text-mono-sm">Acceso restringido</span>
          </div>
          <h1 className="font-display text-display-xl mb-10">Moderación y gestión.</h1>

          {/* Tabs */}
          <div className="flex gap-1 border-b border-concrete/15 mb-8">
            {tabs.map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={cn(
                  "px-5 py-3 font-body text-body-sm border-b-2 -mb-px transition-colors duration-300",
                  tab === t ? "border-ink text-ink" : "border-transparent text-concrete hover:text-ink",
                )}
              >
                {t}
              </button>
            ))}
          </div>

          {tab === "Pintores" && (
            <Table headers={["Pintor", "Nivel", "Rating", "Zona", "Acción"]}>
              {mockPainters.map((p) => (
                <tr key={p.id} className="border-b border-concrete/10">
                  <Td>{p.name}</Td>
                  <Td>
                    <LevelBadge level={p.level} />
                  </Td>
                  <Td>★ {p.rating.toFixed(1)}</Td>
                  <Td className="text-concrete">{p.zone}</Td>
                  <Td>
                    <button className="font-mono text-mono-sm text-concrete hover:text-ink transition-colors">
                      Suspender
                    </button>
                  </Td>
                </tr>
              ))}
            </Table>
          )}

          {tab === "Trabajos" && (
            <Table headers={["Trabajo", "Zona", "Estado", "Cotizaciones", "Acción"]}>
              {mockJobs.map((j) => (
                <tr key={j.id} className="border-b border-concrete/10">
                  <Td>{j.title}</Td>
                  <Td className="text-concrete">{j.zone}</Td>
                  <Td>
                    <span className="font-mono text-mono-sm uppercase tracking-widest">{j.status}</span>
                  </Td>
                  <Td>{j.quotes}</Td>
                  <Td>
                    <button className="font-mono text-mono-sm text-concrete hover:text-ink transition-colors">
                      Revisar
                    </button>
                  </Td>
                </tr>
              ))}
            </Table>
          )}

          {tab === "Verificaciones" && (
            <Table headers={["Solicitante", "Documento", "Antigüedad", "Estado", "Acción"]}>
              {mockPainters.map((p, i) => (
                <tr key={p.id} className="border-b border-concrete/10">
                  <Td>{p.name}</Td>
                  <Td className="text-concrete">DNI + matrícula</Td>
                  <Td className="text-concrete">{2 + i} años</Td>
                  <Td>
                    <span className="font-mono text-mono-sm text-[#DAA520]">Pendiente</span>
                  </Td>
                  <Td>
                    <div className="flex gap-3">
                      <button className="font-mono text-mono-sm text-[#2D5A3D] hover:underline">Aprobar</button>
                      <button className="font-mono text-mono-sm text-[#C41E3A] hover:underline">Rechazar</button>
                    </div>
                  </Td>
                </tr>
              ))}
            </Table>
          )}
        </div>
      </section>
      <Footer />
    </main>
  );
}

function Table({ headers, children }: { headers: string[]; children: React.ReactNode }) {
  return (
    <div className="overflow-x-auto border border-concrete/15">
      <table className="w-full text-left">
        <thead>
          <tr className="border-b border-concrete/20 bg-mist">
            {headers.map((h) => (
              <th key={h} className="px-5 py-3 font-mono text-mono-sm text-concrete uppercase tracking-widest font-normal">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}

function Td({ children, className }: { children: React.ReactNode; className?: string }) {
  return <td className={cn("px-5 py-4 font-body text-body-sm align-middle", className)}>{children}</td>;
}
