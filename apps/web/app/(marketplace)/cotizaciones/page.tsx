import Link from "next/link";
import { redirect } from "next/navigation";
import { Navbar } from "@/components/features/navbar";
import { Footer } from "@/components/features/footer";
import { LevelBadge } from "@/components/features/level-badge";
import { createClient } from "@/lib/supabase/server";
import { getOwnProfile, getQuotesForClient, formatARS } from "@/lib/queries";
import { AcceptButton } from "./accept-button";

export default async function CotizacionesPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/ingresar?next=/cotizaciones");

  // Las cotizaciones que recibe son las del cliente. Un pintor ve las suyas en su panel.
  const profile = await getOwnProfile(user.id);
  if (profile && profile.type !== "client") redirect("/dashboard");

  const quotes = await getQuotesForClient(user.id);
  const aceptada = quotes.some((q) => q.status === "accepted");

  return (
    <main>
      <Navbar />
      <section className="pt-32 sm:pt-40 pb-section min-h-screen">
        <div className="container-asymmetric max-w-4xl">
          <span className="font-mono text-mono-sm uppercase tracking-widest text-concrete">Marketplace</span>
          <h1 className="font-display text-display-xl mt-2 mb-3">Cotizaciones recibidas</h1>
          <p className="font-body text-body-lg text-concrete mb-12 max-w-xl">
            Compará a los pintores que cotizaron tus trabajos y elegí con quién avanzar.
          </p>

          {quotes.length === 0 ? (
            <div className="border border-concrete/15 p-8 sm:p-12 text-center">
              <p className="font-display text-body-lg text-ink mb-2">Todavía no recibiste cotizaciones</p>
              <p className="font-body text-body-md text-concrete mb-6 max-w-md mx-auto">
                Publicá un trabajo y los pintores verificados de tu zona te van a enviar sus presupuestos.
              </p>
              <Link
                href="/publicar"
                className="px-5 py-3 bg-ink text-bone font-body text-body-sm hover:bg-ink/90 transition-colors inline-block"
              >
                Publicar un trabajo
              </Link>
            </div>
          ) : (
            <div className="space-y-4">
              {quotes.map((q) => {
                const accepted = q.status === "accepted";
                return (
                  <article
                    key={q.id}
                    className={`border p-6 sm:p-8 ${accepted ? "border-ink bg-mist" : "border-concrete/15"}`}
                  >
                    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-1">
                          <Link
                            href={`/pintor/${q.painterId}`}
                            className="font-display text-display-md hover:underline underline-offset-2"
                          >
                            {q.painter}
                          </Link>
                          <LevelBadge level={q.painterLevel} />
                          <span className="font-mono text-mono-sm text-concrete">★ {q.painterRating.toFixed(1)}</span>
                        </div>
                        {q.request && (
                          <p className="font-mono text-mono-sm text-concrete uppercase tracking-widest mb-3">
                            {q.request}
                          </p>
                        )}
                        {q.note && <p className="font-body text-body-md text-concrete max-w-xl">{q.note}</p>}
                      </div>
                      <div className="text-right shrink-0">
                        <p className="font-display text-display-md tabular-nums">{formatARS(q.amount)}</p>
                      </div>
                    </div>
                    <div className="mt-5">
                      {accepted ? (
                        <span className="font-mono text-mono-sm uppercase tracking-widest text-[#2D5A3D]">
                          ✓ Cotización aceptada
                        </span>
                      ) : aceptada ? (
                        <span className="font-mono text-mono-sm uppercase tracking-widest text-concrete">
                          Ya elegiste otra cotización
                        </span>
                      ) : (
                        <AcceptButton jobId={q.id} />
                      )}
                    </div>
                  </article>
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
