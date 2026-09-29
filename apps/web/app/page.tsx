import { Navbar } from "@/components/features/navbar";
import { unstable_rethrow } from "next/navigation";
import { Footer } from "@/components/features/footer";
import { HeroFluid } from "@/components/features/hero-fluid";
import { MagneticButton } from "@/components/features/magnetic-button";
import { ProjectCard } from "@/components/features/project-card";
import { ProcessStep } from "@/components/features/process-step";
import { Reveal, SectionLabel } from "@/components/features/states";
import { NewsCarousel } from "@/components/features/news-carousel";
import { TestimonialsCarousel } from "@/components/features/testimonials-carousel";
import { Marquee } from "@/components/features/marquee";
import { CountUp } from "@/components/features/count-up";
import { HeroSpotlight } from "@/components/features/hero-spotlight";
import { brands } from "@/lib/brands";
import { getNews, getRecentReviews, getProjects, getNumerosReales, conNombresDeAutores } from "@/lib/queries";
import { DATOS_EMPRESA, type DatoEmpresa } from "@/lib/empresa";

// Se arma en cada visita, pero sus datos salen de la caché pública (lib/cache-publico.ts): la
// base se consulta como mucho una vez por minuto. Dinámica a propósito, para que el despliegue
// no necesite la base al compilar.
export const dynamic = "force-dynamic";

const services = [
  "Interior",
  "Exterior",
  "Impermeabilización",
  "Esmaltes al agua",
  "Texturas",
  "Frentes y medianeras",
  "Obra nueva",
  "Empapelado",
  "Cielorrasos",
  "Antihumedad",
];

/**
 * Los cuatro pasos, como los hace el código.
 *
 * Estaban escritos en primera persona del plural —"Visitamos la obra", "Definimos colores",
 * "Equipo propio", "Trabajamos prolijo"— y el último prometía "Garantía escrita sobre la mano
 * de obra y los materiales". Es texto de cuando el sitio era la vidriera de una empresa de
 * pintura, y sobrevivió intacto a que el producto pasara a ser un lugar donde se encuentran
 * clientes y pintores.
 *
 * Dos problemas, y el segundo es el grave:
 *
 *  · **Contradice los términos.** `/terminos` dice, con todas las letras: "El trabajo se
 *    contrata entre vos y el pintor. Pintura Pro no es parte de ese acuerdo: no ejecuta la
 *    obra, no fija el precio, no supervisa la calidad y no responde por el resultado." Las
 *    dos cosas no pueden ser ciertas.
 *  · **Promete una garantía que no existe.** No hay tabla, columna ni función de garantía en
 *    ninguna migración. Una promesa en la portada es una oferta, y quien la lee puede
 *    reclamarla. Ya se sacó una gemela de las estadísticas por exactamente esto: ver la nota
 *    de `lib/empresa.ts`, "un compromiso legal sin nada detrás". Quedó ésta, dos secciones
 *    más abajo en la misma página.
 *
 * Lo que dicen ahora es lo que el código hace: publicar, recibir cotizaciones, elegir,
 * coordinar directo y calificar. Ni una palabra de más.
 */
const steps = [
  { title: "Contás qué necesitás", description: "Publicás el trabajo en un par de minutos: qué hay que pintar, dónde y qué presupuesto manejás. Gratis y sin compromiso." },
  { title: "Recibís cotizaciones", description: "Los pintores ven tu pedido y te pasan su precio. Comparás con las reseñas que dejaron otros clientes y con los trabajos que ya hicieron." },
  { title: "Elegís y coordinan", description: "Aceptás la cotización que más te cierra y arreglás el resto directo con el pintor: él hace el trabajo y vos le pagás a él." },
  { title: "Calificás", description: "Cuando termina, dejás tu reseña. Es lo que le sirve al próximo que esté buscando, y lo que hace que a un buen pintor lo vuelvan a llamar." },
];


export default async function HomePage() {
  // Las obras salían de `mockProjects`, así que las tres tarjetas de la home linkeaban a
  // slugs que no existen (`demo-casa-barracas` → 404), mostraban el título con el prefijo
  // "Demo ·" y, donde va la foto, el nombre del archivo. La home es lo primero que ve
  // cualquiera: eran tres 404 en la portada.
  // `getProjects()` ahora AVISA cuando la base falla, en vez de devolver obras inventadas.
  // En /obras eso corresponde —la página entera es el portfolio— pero acá las obras son una
  // sección entre varias: si la base tiene un hipo, no tiene sentido tirar abajo la portada.
  // Se muestra el resto y la sección de obras queda vacía.
  const [news, testimonials, obras, numeros] = await Promise.all([
    getNews(),
    getRecentReviews().then(conNombresDeAutores),
    getProjects().catch((e) => {
      // Primero dejar pasar las señales internas de Next. Al compilar, Next intenta armar la
      // portada como página estática; `cookies()` lanza una excepción A PROPÓSITO para avisar
      // "esta página es dinámica", y este catch se la tragaba: cada compilación de producción
      // imprimía "no se pudieron cargar las obras" con la base perfecta, y quien leyera los
      // registros de Cloud Build iba a creer que la base estaba caída. Peor: tragarse esa
      // señal puede hacer que Next arme la portada estática con la sección de obras vacía.
      // `lib/queries.ts` ya hacía esto en sus propios catch; éste había quedado afuera.
      unstable_rethrow(e);
      console.error("[home] no se pudieron cargar las obras:", e);
      return [] as Awaited<ReturnType<typeof getProjects>>;
    }),
    getNumerosReales(),
  ]);
  const obrasDestacadas = obras.slice(0, 3);

  // Las cifras eran constantes escritas a mano: "+340 obras entregadas" con 3 obras en la
  // base, "4,9★" sin mirar una sola reseña, y "100% garantía escrita" — un compromiso
  // legal sin nada detrás. Ahora sale de la base lo que se puede contar, y lo que sólo
  // sabe el dueño espera en lib/empresa.ts. Lo que no tiene dato real, no se muestra.
  const stats: DatoEmpresa[] = [
    ...(numeros.obras > 0
      ? [{ value: numeros.obras, prefix: "", suffix: "", decimals: 0, label: "Obras en portfolio" }]
      : []),
    ...(numeros.trabajosCompletados > 0
      ? [{ value: numeros.trabajosCompletados, prefix: "", suffix: "", decimals: 0, label: "Trabajos completados" }]
      : []),
    ...(numeros.promedio !== null
      ? [{ value: numeros.promedio, prefix: "", suffix: "★", decimals: 1, label: `Promedio de ${numeros.resenias} reseñas` }]
      : []),
    ...DATOS_EMPRESA.filter((d) => d.value !== null),
  ];
  return (
    <main>
      <Navbar />

      {/* HERO */}
      <section className="relative min-h-screen flex items-center overflow-hidden">
        <div className="absolute inset-0 -z-10 opacity-70">
          <HeroFluid />
        </div>
        <HeroSpotlight />
        <div className="container-asymmetric w-full pt-32 pb-20">
          {/* Era la portada de una empresa de pintura: "Pintura profesional de obra",
              "Transformamos espacios con color", "materiales premium y un resultado que se
              siente". Pintura Pro no pinta: es un marketplace puro (decisión del dueño,
              27/9/2026). Lo que prometa esta sección tiene que ser algo que la PLATAFORMA hace. */}
          <p className="font-mono text-mono-sm text-concrete uppercase tracking-widest mb-6">
            Pintores independientes · Buenos Aires
          </p>
          <h1 className="font-display text-display-xl max-w-4xl text-balance mb-8">
            Tu obra, cotizada por quienes la van a pintar.
          </h1>
          <p className="font-body text-body-lg text-concrete max-w-xl mb-10">
            Publicá lo que necesitás, recibí cotizaciones de pintores independientes y elegí con
            precios, trabajos anteriores y reseñas de clientes reales. Publicar es gratis.
          </p>
          <div className="flex flex-wrap gap-4">
            <MagneticButton href="/publicar" variant="primary">
              Pedir cotizaciones
            </MagneticButton>
            <MagneticButton href="/obras" variant="ghost">
              Ver obras
            </MagneticButton>
          </div>
        </div>

        {/* Indicador de scroll */}
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 hidden sm:flex flex-col items-center gap-2 text-concrete">
          <span className="font-mono text-mono-sm uppercase tracking-widest">Scroll</span>
          <span aria-hidden className="animate-bounce text-body-lg">↓</span>
        </div>
      </section>

      {/* CINTA DE SERVICIOS */}
      <div className="bg-ink text-bone py-4 overflow-hidden">
        <Marquee speed={36}>
          {services.map((s) => (
            <span key={s} className="flex items-center">
              <span className="font-display text-display-md px-8 whitespace-nowrap">{s}</span>
              <span className="text-bone/40" aria-hidden="true">◆</span>
            </span>
          ))}
        </Marquee>
      </div>

      {/* STATS — se omite entera si no hay ni un número real que mostrar. */}
      {stats.length > 0 && (
      <section className="border-y border-concrete/15 bg-mist">
        <div className="container-asymmetric grid grid-cols-2 lg:grid-cols-4">
          {stats.map((stat, i) => (
            <Reveal
              key={stat.label}
              delay={i * 0.06}
              className="py-10 lg:py-14 px-2 border-r border-concrete/10 last:border-0"
            >
              <p className="font-display text-display-lg leading-none">
                <CountUp value={stat.value ?? 0} prefix={stat.prefix} suffix={stat.suffix} decimals={stat.decimals} />
              </p>
              <p className="font-body text-body-sm text-concrete mt-2">{stat.label}</p>
            </Reveal>
          ))}
        </div>
      </section>
      )}

      {/* MARCAS Y COLORES */}
      <section className="py-section">
        <div className="container-asymmetric">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-6 mb-12">
            <div>
              {/* Antes decía "Trabajamos con las mejores marcas": afirmaba una relación comercial
                  con Alba, Sherwin, Sinteplast y Plavicon que no existe. La paleta es propia. */}
              <SectionLabel className="mb-4">Paletas por marca</SectionLabel>
              <h2 className="font-display text-display-lg max-w-2xl text-balance">
                Probá el color antes de pintar.
              </h2>
            </div>
            <MagneticButton href="/colores" variant="ghost">
              Ver todas las cartas
            </MagneticButton>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {brands.map((brand, i) => (
              <Reveal key={brand.id} delay={i * 0.06}>
                <a href="/colores" className="group block border border-concrete/15 hover:border-ink transition-colors duration-300">
                  <div className="flex h-3">
                    {brand.colors.slice(0, 8).map((c) => (
                      <span key={c.name} className="flex-1" style={{ backgroundColor: c.hex }} />
                    ))}
                  </div>
                  <div className="p-5">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: brand.accent }} />
                      <h3 className="font-display text-display-md leading-none">{brand.name}</h3>
                    </div>
                    <p className="font-body text-body-sm text-concrete">{brand.colors.length} colores disponibles</p>
                  </div>
                </a>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* OBRAS DESTACADAS */}
      <section className="py-section">
        <div className="container-asymmetric">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-6 mb-12 sm:mb-16">
            <div>
              <SectionLabel className="mb-4">Obras seleccionadas</SectionLabel>
              <h2 className="font-display text-display-lg max-w-2xl text-balance">
                Cada proyecto, su propia paleta.
              </h2>
            </div>
            <MagneticButton href="/obras" variant="ghost">
              Ver portfolio completo
            </MagneticButton>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 lg:gap-12">
            {obrasDestacadas.map((project, index) => (
              <Reveal key={project.id} delay={index * 0.06}>
                <ProjectCard
                  title={project.title}
                  location={project.location}
                  category={project.category}
                  accentColor={project.accentColor}
                  imageSrc={project.images[0]}
                  slug={project.slug}
                  index={index}
                />
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* PROCESO */}
      <section className="py-section bg-ink text-bone">
        <div className="container-asymmetric grid grid-cols-1 lg:grid-cols-12 gap-12">
          <div className="lg:col-span-4">
            <SectionLabel className="text-bone/50 mb-4">Cómo funciona</SectionLabel>
            <h2 className="font-display text-display-lg text-balance">
              De una pared sin pintar a un pintor trabajando.
            </h2>
          </div>
          <div className="lg:col-span-7 lg:col-start-6">
            {steps.map((step, i) => (
              <div key={step.title} className="flex gap-6 group">
                <div className="shrink-0 flex flex-col items-center">
                  <span className="font-mono text-mono-sm text-bone/50 tabular-nums">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  {i < steps.length - 1 && <div className="w-px flex-1 mt-3 bg-bone/15" />}
                </div>
                <div className="pb-12 group-last:pb-0">
                  <h3 className="font-display text-display-md mb-3">{step.title}</h3>
                  <p className="font-body text-body-md text-bone/60 max-w-md leading-relaxed">{step.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* TESTIMONIOS */}
      {testimonials.length > 0 && (
        <section className="py-section bg-mist border-y border-concrete/15">
          <div className="container-asymmetric">
            <SectionLabel className="mb-10">Lo que dicen los clientes</SectionLabel>
            <TestimonialsCarousel items={testimonials} />
          </div>
        </section>
      )}

      {/* NOVEDADES */}
      {news.length > 0 && (
        <section className="py-section bg-mist border-y border-concrete/15">
          <div className="container-asymmetric">
            <div className="flex items-end justify-between mb-8">
              <SectionLabel>Novedades</SectionLabel>
              <a href="/novedades" className="font-body text-body-sm text-concrete hover:text-ink transition-colors">
                Ver todas →
              </a>
            </div>
            <NewsCarousel items={news} />
          </div>
        </section>
      )}

      {/* CTA */}
      <section className="py-section">
        <div className="container-asymmetric text-center">
          <h2 className="font-display text-display-xl max-w-3xl mx-auto text-balance mb-8">
            ¿Listos para empezar tu obra?
          </h2>
          <p className="font-body text-body-lg text-concrete max-w-xl mx-auto mb-10">
            Pedí tu cotización online en minutos. Sin compromiso, con presupuesto cerrado.
          </p>
          <div className="flex justify-center">
            <MagneticButton href="/publicar" variant="primary">
              Pedir cotizaciones
            </MagneticButton>
          </div>
        </div>
      </section>

      <Footer />
    </main>
  );
}
