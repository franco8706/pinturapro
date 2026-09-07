"use client";

import { useState } from "react";
import { Navbar } from "@/components/features/navbar";
import { Footer } from "@/components/features/footer";
import { LevelBadge } from "@/components/features/level-badge";
import type { Painter } from "@/lib/data";
import type { LeadView } from "@/lib/queries";
import { cn } from "@/lib/utils";

const tabs = ["Consultas", "Pintores"] as const;
type Tab = (typeof tabs)[number];

export function AdminClient({ leads, painters }: { leads: LeadView[]; painters: Painter[] }) {
  const [tab, setTab] = useState<Tab>("Consultas");
  const sinLeer = leads.filter((l) => l.status === "new").length;

  return (
    <main>
      <Navbar />
      <section className="pt-32 sm:pt-40 pb-section min-h-screen">
        <div className="container-asymmetric">
          <div className="flex items-center gap-3 mb-2">
            <p className="font-mono text-mono-sm text-concrete uppercase tracking-widest">Panel admin</p>
            <span className="px-2 py-0.5 bg-[#C41E3A]/10 text-[#C41E3A] font-mono text-mono-sm">Sólo empresa</span>
            {sinLeer > 0 && (
              <span className="px-2 py-0.5 bg-ink text-bone font-mono text-mono-sm">{sinLeer} sin leer</span>
            )}
          </div>
          <h1 className="font-display text-display-xl mb-10">Consultas y pintores.</h1>

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

          {tab === "Consultas" && (
            leads.length === 0 ? (
              <p className="font-body text-body-md text-concrete py-12">
                Todavía no llegó ninguna consulta. Acá van a aparecer los pedidos de presupuesto de
                /cotizar, los mensajes de /contacto y las postulaciones de /registro.
              </p>
            ) : (
              <Table headers={["Tipo", "Nombre", "Contacto", "Detalle", "Fecha"]}>
                {leads.map((l) => (
                  <tr key={l.id} className="border-b border-concrete/10 align-top">
                    <Td>
                      <span className="font-mono text-mono-sm uppercase tracking-widest">{l.kindLabel}</span>
                    </Td>
                    <Td>{l.name}</Td>
                    <Td className="text-concrete">
                      {l.email && (
                        <a href={`mailto:${l.email}`} className="hover:text-ink transition-colors">
                          {l.email}
                        </a>
                      )}
                      {l.phone && <div className="font-mono text-mono-sm">{l.phone}</div>}
                    </Td>
                    <Td className="text-concrete max-w-sm">
                      {l.message && <p className="mb-1">{l.message}</p>}
                      {Object.entries(l.details)
                        .filter(([, v]) => v !== null && v !== undefined && String(v).trim() !== "")
                        .map(([k, v]) => (
                          <div key={k} className="font-mono text-mono-sm">
                            {k}: {String(v)}
                          </div>
                        ))}
                    </Td>
                    <Td className="text-concrete whitespace-nowrap">{l.date}</Td>
                  </tr>
                ))}
              </Table>
            )
          )}

          {tab === "Pintores" && (
            painters.length === 0 ? (
              <p className="font-body text-body-md text-concrete py-12">Todavía no hay pintores cargados.</p>
            ) : (
              <Table headers={["Pintor", "Nivel", "Rating", "Reseñas", "Zona"]}>
                {painters.map((p) => (
                  <tr key={p.id} className="border-b border-concrete/10">
                    <Td>{p.name}</Td>
                    <Td>
                      <LevelBadge level={p.level} />
                    </Td>
                    <Td>★ {p.rating.toFixed(1)}</Td>
                    <Td className="text-concrete">{p.reviews}</Td>
                    <Td className="text-concrete">{p.zone}</Td>
                  </tr>
                ))}
              </Table>
            )
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
