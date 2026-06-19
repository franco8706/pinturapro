"use client";

import { useParams, notFound } from "next/navigation";
import { Navbar } from "@/components/features/navbar";
import { Footer } from "@/components/features/footer";
import { LevelBadge } from "@/components/features/level-badge";
import { MagneticButton } from "@/components/features/magnetic-button";
import { ReviewSystem } from "@/components/features/review-system";
import { SectionLabel } from "@/components/features/states";
import { mockPainters, mockReviews } from "@/lib/data";

export default function PainterProfilePage() {
  const params = useParams();
  const id = params.id as string;
  const painter = mockPainters.find((p) => p.id === id);
  if (!painter) notFound();

  const reviews = mockReviews
    .filter((r) => r.painterId === painter.id)
    .map((r) => ({
      id: r.id,
      author: r.author,
      rating: r.rating,
      date: r.date,
      comment: r.comment,
      project: r.project,
    }));

  return (
    <main>
      <Navbar />

      <section className="pt-32 sm:pt-40 pb-section">
        <div className="container-asymmetric grid grid-cols-1 lg:grid-cols-12 gap-12">
          <div className="lg:col-span-5">
            <div className="aspect-square bg-mist flex items-center justify-center">
              <span className="font-mono text-mono-sm text-concrete">{painter.image}</span>
            </div>
          </div>
          <div className="lg:col-span-6 flex flex-col justify-center">
            <div className="mb-4">
              <LevelBadge level={painter.level} />
            </div>
            <h1 className="font-display text-display-xl mb-3">{painter.name}</h1>
            <div className="flex items-center gap-4 mb-8">
              <span className="font-mono text-body-lg text-ink">★ {painter.rating.toFixed(1)}</span>
              <span className="font-body text-body-sm text-concrete">
                {painter.reviews} reseñas · {painter.zone}
              </span>
            </div>
            <div className="flex flex-wrap gap-2 mb-10">
              {painter.specialty.map((s) => (
                <span key={s} className="px-3 py-1.5 bg-mist font-mono text-mono-sm text-concrete">
                  {s}
                </span>
              ))}
            </div>
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

      <section className="py-section bg-mist border-y border-concrete/15">
        <div className="container-asymmetric">
          <SectionLabel className="mb-8">Portfolio</SectionLabel>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            {painter.portfolio.map((img) => (
              <div key={img} className="aspect-[4/3] bg-concrete/10 flex items-center justify-center">
                <span className="font-mono text-mono-sm text-concrete">{img}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

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
