import Link from "next/link";
import { notFound } from "next/navigation";
import { Navbar } from "@/components/features/navbar";
import { Footer } from "@/components/features/footer";
import { LevelBadge } from "@/components/features/level-badge";
import { MagneticButton } from "@/components/features/magnetic-button";
import { ReviewSystem } from "@/components/features/review-system";
import { SectionLabel } from "@/components/features/states";
import { getPainterById, getProjectsByOwner, getReviewsForPainter, getPainterExtras } from "@/lib/queries";

export default async function PainterProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const painter = await getPainterById(id);
  if (!painter) notFound();

  const [portfolio, reviews, extras] = await Promise.all([
    getProjectsByOwner(id),
    getReviewsForPainter(id),
    getPainterExtras(id),
  ]);
  const hasPhoto = painter.image?.startsWith("http");

  return (
    <main>
      <Navbar />

      <section className="pt-32 sm:pt-40 pb-section">
        <div className="container-asymmetric grid grid-cols-1 lg:grid-cols-12 gap-12">
          <div className="lg:col-span-5">
            <div className="aspect-square bg-mist overflow-hidden flex items-center justify-center">
              {hasPhoto ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={painter.image} alt={painter.name} className="w-full h-full object-cover" />
              ) : (
                <span className="font-display text-display-xl text-concrete/50">{initials(painter.name)}</span>
              )}
            </div>
          </div>
          <div className="lg:col-span-6 flex flex-col justify-center">
            <div className="mb-4 flex items-center gap-3">
              <LevelBadge level={painter.level} />
              {painter.level === "Master" && (
                <span className="font-mono text-mono-sm text-concrete uppercase tracking-widest">Verificado</span>
              )}
            </div>
            <h1 className="font-display text-display-xl mb-3">{painter.name}</h1>
            <div className="flex items-center gap-4 mb-6">
              <span className="font-mono text-body-lg text-ink">★ {painter.rating.toFixed(1)}</span>
              <span className="font-body text-body-sm text-concrete">
                {painter.reviews} reseñas · {painter.zone}
              </span>
            </div>
            {painter.bio && <p className="font-body text-body-lg text-concrete mb-8 max-w-xl">{painter.bio}</p>}
            {painter.specialty.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-10">
                {painter.specialty.map((s) => (
                  <span key={s} className="px-3 py-1.5 bg-mist font-mono text-mono-sm text-concrete">
                    {s}
                  </span>
                ))}
              </div>
            )}
            <div className="flex flex-wrap gap-4">
              <MagneticButton href="/cotizar" variant="primary">
                Solicitar presupuesto
              </MagneticButton>
              <MagneticButton href="/pintores" variant="ghost">
                Ver otros pintores
              </MagneticButton>
            </div>
          </div>
        </div>
      </section>

      {portfolio.length > 0 && (
        <section className="py-section bg-mist border-y border-concrete/15">
          <div className="container-asymmetric">
            <SectionLabel className="mb-8">Portfolio</SectionLabel>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              {portfolio.map((proj) => {
                const cover = proj.images[0];
                return (
                  <Link key={proj.id} href={`/obras/${proj.slug}`} className="group block">
                    <div className="relative aspect-[4/3] bg-concrete/10 overflow-hidden flex items-center justify-center">
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
                    <p className="font-display text-display-md mt-3">{proj.title}</p>
                    <p className="font-body text-body-sm text-concrete">{proj.location}</p>
                  </Link>
                );
              })}
            </div>
          </div>
        </section>
      )}

      {(extras.pros.length > 0 || extras.cons.length > 0) && (
        <section className="py-section">
          <div className="container-asymmetric grid grid-cols-1 md:grid-cols-2 gap-10">
            {extras.pros.length > 0 && (
              <div>
                <SectionLabel className="mb-6">Puntos a favor</SectionLabel>
                <ul className="space-y-3">
                  {extras.pros.map((p) => (
                    <li key={p} className="flex gap-3 font-body text-body-md text-ink">
                      <span className="text-[#2D5A3D] shrink-0">✓</span>
                      <span>{p}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {extras.cons.length > 0 && (
              <div>
                <SectionLabel className="mb-6">A tener en cuenta</SectionLabel>
                <ul className="space-y-3">
                  {extras.cons.map((c) => (
                    <li key={c} className="flex gap-3 font-body text-body-md text-concrete">
                      <span className="text-[#B45309] shrink-0">−</span>
                      <span>{c}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </section>
      )}

      <section className="py-section">
        <div className="container-asymmetric">
          <SectionLabel className="mb-12">Reseñas</SectionLabel>
          <ReviewSystem reviews={reviews} average={painter.rating} total={painter.reviews} />
        </div>
      </section>

      <Footer />
    </main>
  );
}

function initials(name: string): string {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");
}
