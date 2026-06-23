import Link from "next/link";
import { redirect } from "next/navigation";
import { Navbar } from "@/components/features/navbar";
import { Footer } from "@/components/features/footer";
import { LevelBadge } from "@/components/features/level-badge";
import { MagneticButton } from "@/components/features/magnetic-button";
import { createClient } from "@/lib/supabase/server";
import {
  getPainterById,
  getProjectsByOwner,
  getReviewsForPainter,
  getJobsForPainter,
  formatARS,
} from "@/lib/queries";

export default async function PainterDashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/ingresar?next=/dashboard");

  const painter = await getPainterById(user.id);

  // Cuenta logueada que no es pintor → no tiene dashboard de pintor.
  if (!painter) {
    return (
      <main>
        <Navbar />
        <section className="pt-40 pb-section min-h-screen">
          <div className="container-asymmetric max-w-xl">
            <h1 className="font-display text-display-lg mb-4">Tu cuenta no es de pintor</h1>
            <p className="font-body text-body-lg text-concrete mb-8">
              Este panel es para profesionales. Si querés ofrecer tus servicios, registrate como pintor.
            </p>
            <MagneticButton href="/pintores" variant="primary">
              Ver pintores
            </MagneticButton>
          </div>
        </section>
        <Footer />
      </main>
    );
  }

  const [projects, reviews, jobs] = await Promise.all([
    getProjectsByOwner(user.id),
    getReviewsForPainter(user.id),
    getJobsForPainter(user.id),
  ]);

  const completados = jobs.filter((j) => j.status === "completed").length;
  const activos = jobs.filter((j) => ["accepted", "in_progress", "quoted"].includes(j.status)).length;

  const metrics = [
    { label: "Trabajos completados", value: String(completados) },
    { label: "Trabajos activos", value: String(activos) },
    { label: "Obras en portfolio", value: String(projects.length) },
    { label: "Reseñas", value: String(reviews.length) },
  ];

  const firstName = painter.name.split(" ")[0];

  return (
    <main>
      <Navbar />
      <section className="pt-32 sm:pt-40 pb-section min-h-screen">
        <div className="container-asymmetric">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 mb-12">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-full bg-mist overflow-hidden flex items-center justify-center font-display text-display-md">
                {painter.image?.startsWith("http") ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={painter.image} alt={painter.name} className="w-full h-full object-cover" />
                ) : (
                  firstName[0]
                )}
              </div>
              <div>
                <h1 className="font-display text-display-lg leading-none">Hola, {firstName}</h1>
                <div className="mt-2 flex items-center gap-3">
                  <LevelBadge level={painter.level} />
                  <span className="font-mono text-mono-sm text-concrete">★ {painter.rating.toFixed(1)}</span>
                </div>
              </div>
            </div>
            <div className="flex gap-3">
              <MagneticButton href={`/pintor/${painter.id}`} variant="ghost">
                Ver mi perfil
              </MagneticButton>
              <MagneticButton href="/trabajos" variant="primary">
                Buscar trabajos
              </MagneticButton>
            </div>
          </div>

          {/* Métricas reales */}
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

          {/* Trabajos */}
          <h2 className="font-display text-display-md mb-6">Tus trabajos</h2>
          {jobs.length === 0 ? (
            <p className="font-body text-body-md text-concrete mb-12">
              Todavía no tenés trabajos.{" "}
              <Link href="/trabajos" className="text-ink underline underline-offset-2">
                Buscá trabajos disponibles
              </Link>
              .
            </p>
          ) : (
            <div className="space-y-3 mb-16">
              {jobs.map((job) => (
                <div
                  key={job.id}
                  className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 border border-concrete/15"
                >
                  <div>
                    <p className="font-display text-body-lg">{job.project ?? "Trabajo"}</p>
                    <p className="font-body text-body-sm text-concrete mt-1">Cliente: {job.client}</p>
                  </div>
                  <div className="flex items-center gap-6">
                    <span className="font-mono text-mono-sm text-concrete uppercase tracking-widest">
                      {job.statusLabel}
                    </span>
                    <span className="font-body text-body-md text-ink tabular-nums">{formatARS(job.amount)}</span>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Portfolio */}
          <div className="flex items-center justify-between mb-6">
            <h2 className="font-display text-display-md">Tus obras</h2>
            <span className="font-mono text-mono-sm text-concrete">{projects.length} publicadas</span>
          </div>
          {projects.length === 0 ? (
            <p className="font-body text-body-md text-concrete">Todavía no publicaste obras en tu portfolio.</p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {projects.map((proj) => {
                const cover = proj.images[0];
                return (
                  <Link key={proj.id} href={`/obras/${proj.slug}`} className="group block">
                    <div className="relative aspect-[4/3] bg-mist overflow-hidden flex items-center justify-center">
                      {cover?.startsWith("http") ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={cover}
                          alt={proj.title}
                          className="w-full h-full object-cover transition-transform duration-700 ease-expo-out group-hover:scale-105"
                        />
                      ) : (
                        <span className="font-mono text-mono-sm text-concrete">{proj.title}</span>
                      )}
                    </div>
                    <p className="font-display text-body-lg mt-3">{proj.title}</p>
                    <p className="font-body text-body-sm text-concrete">{proj.location}</p>
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      </section>
      <Footer />
    </main>
  );
}
