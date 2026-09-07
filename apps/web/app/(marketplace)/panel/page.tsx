import { redirect } from "next/navigation";
import { Navbar } from "@/components/features/navbar";
import { Footer } from "@/components/features/footer";
import { SectionLabel } from "@/components/features/states";
import { mockJobs } from "@/lib/data";
import { createClient } from "@/lib/supabase/server";
import { getOwnProfile } from "@/lib/queries";

const kpis = [
  { label: "Trabajos publicados", value: "1.284", delta: "+12%" },
  { label: "Cotizaciones enviadas", value: "5.910", delta: "+8%" },
  { label: "Volumen transado", value: "$48.2M", delta: "+21%" },
  { label: "Comisión generada", value: "$3.85M", delta: "+21%" },
];

// Serie sintética para el gráfico de barras (volumen mensual).
const monthly = [32, 41, 38, 52, 60, 58, 71, 80, 76, 88, 95, 100];
const months = ["E", "F", "M", "A", "M", "J", "J", "A", "S", "O", "N", "D"];

/**
 * Panel analítico del marketplace: es información de negocio de la plataforma
 * (volumen transado, comisión generada), así que sólo lo ve la empresa.
 * Antes compilaba como página estática sin ningún control de sesión.
 */
export default async function MarketplacePanelPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/ingresar?next=/panel");

  const profile = await getOwnProfile(user.id);
  if (!profile || profile.type !== "company") redirect("/mi-panel");

  const max = Math.max(...monthly);

  return (
    <main>
      <Navbar />
      <section className="pt-32 sm:pt-40 pb-section min-h-screen">
        <div className="container-asymmetric">
          <SectionLabel className="mb-4">Panel analítico</SectionLabel>
          <h1 className="font-display text-display-xl mb-12">Marketplace en números.</h1>

          {/* KPIs */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-px bg-concrete/15 border border-concrete/15 mb-12">
            {kpis.map((kpi) => (
              <div key={kpi.label} className="bg-plaster p-6 lg:p-8">
                <p className="font-display text-display-lg leading-none">{kpi.value}</p>
                <div className="flex items-center gap-2 mt-2">
                  <p className="font-body text-body-sm text-concrete">{kpi.label}</p>
                  <span className="font-mono text-mono-sm text-[#2D5A3D]">{kpi.delta}</span>
                </div>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
            {/* Gráfico */}
            <div className="lg:col-span-8">
              <h2 className="font-display text-display-md mb-8">Volumen transado por mes</h2>
              <div className="flex items-end gap-2 h-64 border-b border-concrete/20">
                {monthly.map((v, i) => (
                  <div key={i} className="flex-1 flex flex-col items-center gap-2 group">
                    <div
                      className="w-full bg-ink/80 group-hover:bg-ink transition-colors duration-300"
                      style={{ height: `${(v / max) * 100}%` }}
                    />
                  </div>
                ))}
              </div>
              <div className="flex gap-2 mt-3">
                {months.map((m, i) => (
                  <span key={i} className="flex-1 text-center font-mono text-mono-sm text-concrete">
                    {m}
                  </span>
                ))}
              </div>
            </div>

            {/* Últimos trabajos */}
            <div className="lg:col-span-4">
              <h2 className="font-display text-display-md mb-8">Actividad reciente</h2>
              <div className="space-y-4">
                {mockJobs.map((job) => (
                  <div key={job.id} className="pb-4 border-b border-concrete/15 last:border-0">
                    <p className="font-body text-body-md text-ink leading-snug">{job.title}</p>
                    <div className="flex items-center justify-between mt-1">
                      <span className="font-mono text-mono-sm text-concrete">{job.postedAt}</span>
                      <span className="font-mono text-mono-sm text-concrete">{job.quotes} cot.</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>
      <Footer />
    </main>
  );
}
