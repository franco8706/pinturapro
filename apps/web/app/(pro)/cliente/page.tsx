import Link from "next/link";
import { redirect } from "next/navigation";
import { Navbar } from "@/components/features/navbar";
import { Footer } from "@/components/features/footer";
import { MagneticButton } from "@/components/features/magnetic-button";
import { createClient } from "@/lib/supabase/server";
import { getOwnProfile, getJobsForClient, getPedidosDelCliente, formatARS } from "@/lib/queries";
import { ReviewForm } from "./review-form";
import { CancelButton } from "@/app/(marketplace)/cancel-button";

const ACTIVE = ["published", "quoted", "accepted", "in_progress"];

export default async function ClientePanelPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/ingresar?next=/cliente");

  const profile = await getOwnProfile(user.id);
  if (!profile || !profile.onboarded) redirect("/bienvenida");
  // Pintores y empresas tienen su propio panel profesional.
  if (profile.type !== "client") redirect("/dashboard");

  // Los pedidos PUBLICADOS y los trabajos son dos cosas distintas: `jobs` sólo existe
  // cuando un pintor cotiza. Sin la primera lista, un cliente que acababa de publicar
  // veía "Todavía ningún pintor te cotizó" y muchos publicaban de nuevo, duplicando.
  const [jobs, pedidos] = await Promise.all([getJobsForClient(user.id), getPedidosDelCliente(user.id)]);
  const activos = pedidos.filter((p) => p.published).length;
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

          {/* Pedidos publicados por el cliente */}
          <h2 className="font-display text-display-md mb-6">Tus pedidos publicados</h2>
          {pedidos.length === 0 ? (
            <p className="font-body text-body-md text-concrete mb-12">
              Todavía no publicaste ningún pedido.{" "}
              <Link href="/publicar" className="text-ink underline underline-offset-2">
                Publicar uno
              </Link>
              .
            </p>
          ) : (
            <div className="border border-concrete/15 divide-y divide-concrete/15 mb-12">
              {pedidos.map((p) => (
                <div key={p.id} className="p-5 sm:p-6 flex flex-wrap items-center justify-between gap-4">
                  <div>
                    <p className="font-body text-body-md text-ink">{p.title}</p>
                    <p className="font-mono text-mono-sm text-concrete mt-1">
                      {p.location || "Sin zona"} · {p.date}
                      {p.budgetMin || p.budgetMax ? ` · ${formatARS(p.budgetMin)}–${formatARS(p.budgetMax)}` : ""}
                    </p>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="font-mono text-mono-sm uppercase tracking-widest text-concrete">
                      {
                        {
                          abierto: "Publicado",
                          adjudicado: "Adjudicado",
                          terminado: "Terminado",
                          cerrado: "Cerrado",
                        }[p.estado]
                      }
                    </span>
                    {/* Sólo se ofrece ir a comparar si hay algo para aceptar. Un pedido ya
                        adjudicado no tiene cotizaciones vivas, y decir "sin cotizaciones aún"
                        ahí era mentirle al cliente sobre su propio trabajo terminado. */}
                    {p.cotizaciones > 0 ? (
                      <Link
                        href="/cotizaciones"
                        className="font-body text-body-sm text-ink underline underline-offset-2"
                      >
                        {p.cotizaciones} cotización{p.cotizaciones === 1 ? "" : "es"} →
                      </Link>
                    ) : p.estado === "abierto" ? (
                      <span className="font-body text-body-sm text-concrete">Sin cotizaciones aún</span>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Solicitudes / trabajos del cliente */}
          <h2 className="font-display text-display-md mb-6">Trabajos con pintores</h2>
          {jobs.length === 0 ? (
            <div className="border border-concrete/15 p-8 sm:p-12 text-center">
              <p className="font-display text-body-lg text-ink mb-2">Todavía no pediste ningún trabajo</p>
              <p className="font-body text-body-md text-concrete mb-6 max-w-md mx-auto">
                Cuando un pintor cotice alguno de tus pedidos, el trabajo va a aparecer acá.
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
                  {/* Salida para el cliente: si el pintor abandona, sin esto el trabajo
                      quedaba trabado y el pedido no volvía nunca al tablero. */}
                  {["quoted", "accepted", "in_progress"].includes(job.status) && (
                    <div className="mt-4">
                      <CancelButton jobId={job.id} label="Cancelar este trabajo" />
                    </div>
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
