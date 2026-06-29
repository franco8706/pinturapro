import Link from "next/link";
import { Navbar } from "@/components/features/navbar";
import { Footer } from "@/components/features/footer";
import { SectionLabel, EmptyState } from "@/components/features/states";
import { getNews } from "@/lib/queries";

const ACCENTS = ["#C41E3A", "#1E3A8A", "#2D5A3D", "#B45309", "#0F766E"];

export default async function NovedadesPage() {
  const news = await getNews();

  return (
    <main>
      <Navbar />
      <section className="pt-32 sm:pt-40 pb-section min-h-screen">
        <div className="container-asymmetric">
          <SectionLabel className="mb-4">Novedades</SectionLabel>
          <h1 className="font-display text-display-xl max-w-3xl text-balance mb-12">
            Noticias, tendencias y novedades del mundo de la pintura.
          </h1>

          {news.length === 0 ? (
            <EmptyState title="Todavía no hay novedades" description="Pronto vas a encontrar acá nuestras últimas noticias." />
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {news.map((item, idx) => {
                const accent = ACCENTS[idx % ACCENTS.length];
                const inner = (
                  <article className="group border border-concrete/15 h-full flex flex-col hover:border-ink transition-colors">
                    <div className="aspect-[16/10] overflow-hidden" style={{ backgroundColor: accent }}>
                      {item.coverUrl?.startsWith("http") && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={item.coverUrl} alt="" className="w-full h-full object-cover" />
                      )}
                    </div>
                    <div className="p-6 flex flex-col flex-1">
                      <span className="font-mono text-mono-sm uppercase tracking-widest text-concrete">{item.date}</span>
                      <h2 className="font-display text-display-md mt-2 mb-2 leading-tight">{item.title}</h2>
                      {item.excerpt && <p className="font-body text-body-sm text-concrete">{item.excerpt}</p>}
                      {item.url && (
                        <span className="mt-4 font-body text-body-sm text-ink underline underline-offset-4">Leer más →</span>
                      )}
                    </div>
                  </article>
                );
                return item.url ? (
                  <Link key={item.id} href={item.url} className="block">
                    {inner}
                  </Link>
                ) : (
                  <div key={item.id}>{inner}</div>
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
