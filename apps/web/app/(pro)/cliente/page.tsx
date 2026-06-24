import Link from "next/link";
import { redirect } from "next/navigation";
import { Navbar } from "@/components/features/navbar";
import { Footer } from "@/components/features/footer";
import { MagneticButton } from "@/components/features/magnetic-button";
import { createClient } from "@/lib/supabase/server";
import { getOwnProfile, isOnboarded, getJobsForClient, formatARS } from "@/lib/queries";
import { ReviewForm } from "./review-form";

const ACTIVE = ["published", "quoted", "accepted", "in_progress"];

export default async function ClientePanelPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/ingresar?next=/cliente");

  if (!(await isOnboarded(user.id))) redirect("/bienvenida");

  const profile = await getOwnProfile(user.id);
  if (!profile) redirect("/bienvenida");
  // Pintores y empresas tienen su propio panel profesional.
  if (profile.type !== "client") redirect("/dashboard");

  const jobs = await getJobsForClient(user.id);
  const activos = jobs.filter((j) => ACTIVE.includes(j.status)).length;
  const completados = jobs.filter((j) => j.status === "completed").length;
  const pintores = new Set(jobs.map((j) => j.painter).filter(Boolean)).size;

  const firstName = profile.name.split(" ")[0] || "👋";

  const metrics = [
    { label: "Solicitudes activas", value: String(activos) },
    { label: "Trabajos completados", value: String(completados) },
    { label: "Pintores contratados", value: String(pintores) },
  ];

  return (
    <main>
      <Navbar />
      <section className="pt-32 sm:pt-40 pb-section min-h-screen">
        <div className="container-asymmetric">
          {/* Encabezado: claramente "panel de cliente" */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 mb-12">
            <div>
              <span className="font-mono text-mono-sm uppercase tracking-widest text-concrete">Panel de cliente</span>
              <h1 className="font-display text-display-lg leading-none mt-2">Hola, {firstName}</h1>
            </div>
            <div className="flex gap-3">
              <MagneticButton href="/cotizaciones" variant="ghost">
                Ver cotizaciones
              </MagneticButton>
              <MagneticButton href="/publicar" variant="primary">
                Publicar trabajo
              </MagneticButton>
            </div>
          </div>

          {/* Métricas */}
          <div className="grid grid-cols-3 border border-concrete/15 mb-12">
            {metrics.map((m) => (
              <div key={m.label} className="p-6 lg:p-8 border-r border-concrete/15 last:border-r-0">
                <p className="font-display text-display-lg leading-none">{m.value}</p>
                <p className="font-body text-body-sm text-concrete mt-2">{m.label}</p>
              </div>
            ))}
          </div>

          {/* Solicitudes / trabajos del cliente */}
          <h2 className="font-display text-display-md mb-6">Tus solicitudes</h2>
          {jobs.length === 0 ? (
            <div className="border border-concrete/15 p-8 sm:p-12 text-center">
              <p className="font-display text-body-lg text-ink mb-2">Todavía no pediste ningún trabajo</p>
              <p className="font-body text-body-md text-concrete mb-6 max-w-md mx-auto">
                Contá qué necesitás pintar y recibí presupuestos de pintores verificados de tu zona.
              </p>
              <div className="flex justify-center gap-3">
                <Link
                  href="/publicar"
                  className="px-5 py-3 bg-ink text-bone font-body text-body-sm hover:bg-ink/90 transition-colors"
                >
                  Publicar trabajo
                </Link>
                <Link
                  href="/pintores"
                  className="px-5 py-3 border border-concrete/30 font-body text-body-sm hover:border-ink transition-colors"
                >
                  Ver pintores
                </Link>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {jobs.map((job) => (
                <div key={job.id} className="p-5 border border-concrete/15">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                      <p className="font-display text-body-lg">{job.project ?? "Solicitud de trabajo"}</p>
                      <p className="font-body text-body-sm text-concrete mt-1">
                        {job.painter ? `Pintor: ${job.painter}` : "Esperando pintor"}
                      </p>
                    </div>
                    <div className="flex items-center gap-6">
                      <span className="font-mono text-mono-sm text-concrete uppercase tracking-widest">
                        {job.statusLabel}
                      </span>
                      <span className="font-body text-body-md text-ink tabular-nums">{formatARS(job.amount)}</span>
                    </div>
                  </div>
                  {job.status === "completed" && job.painterId && (
                    job.reviewed ? (
                      <p className="mt-3 font-body text-body-sm text-concrete">✓ Ya dejaste tu reseña.</p>
                    ) : (
                      <ReviewForm jobId={job.id} painterId={job.painterId} painter={job.painter ?? "el pintor"} />
                    )
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </section>
      <Footer />
    </main>
  );
}
