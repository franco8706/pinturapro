import { Navbar } from "@/components/features/navbar";
import { Footer } from "@/components/features/footer";
import { MagneticButton } from "@/components/features/magnetic-button";
import { Reveal, SectionLabel } from "@/components/features/states";

const valores = [
  { title: "Oficio", description: "Doce años pintando obra en Buenos Aires. La mano se nota en cada terminación." },
  { title: "Honestidad", description: "Presupuesto cerrado. Lo que cotizamos es lo que pagás, sin letra chica ni adicionales sorpresa." },
  { title: "Materiales", description: "Trabajamos solo con líneas premium. Un buen trabajo con mala pintura no existe." },
  { title: "Prolijidad", description: "Protegemos pisos, muebles y aberturas. Dejamos la obra tan limpia como la encontramos." },
];

const team = [
  { name: "Martín Rojas", role: "Fundador · Maestro pintor", since: "2014" },
  { name: "Lucía Fernández", role: "Dirección de obra", since: "2017" },
  { name: "Diego Sosa", role: "Especialista en exteriores", since: "2019" },
];

export default function NosotrosPage() {
  return (
    <main>
      <Navbar />

      <section className="pt-32 sm:pt-40 pb-section">
        <div className="container-asymmetric">
          <SectionLabel className="mb-6">Nosotros</SectionLabel>
          <h1 className="font-display text-display-xl max-w-4xl text-balance mb-10">
            Pintamos como nos gustaría que pintaran nuestra propia casa.
          </h1>
          <p className="font-body text-body-lg text-concrete max-w-2xl">
            Empezamos como un equipo de tres en un taller de Barracas. Hoy somos referentes en pintura de obra para
            arquitectos y constructoras, pero seguimos midiendo cada trabajo con la misma vara: que el resultado se
            sienta.
          </p>
        </div>
      </section>

      <section className="py-section bg-mist border-y border-concrete/15">
        <div className="container-asymmetric grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-16">
          {valores.map((v, i) => (
            <Reveal key={v.title} delay={i * 0.06} className="flex gap-6">
              <span className="font-mono text-mono-sm text-concrete tabular-nums pt-2">
                {String(i + 1).padStart(2, "0")}
              </span>
              <div>
                <h3 className="font-display text-display-md mb-3">{v.title}</h3>
                <p className="font-body text-body-md text-concrete leading-relaxed max-w-md">{v.description}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      <section className="py-section">
        <div className="container-asymmetric">
          <SectionLabel className="mb-12">El equipo</SectionLabel>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {team.map((member, i) => (
              <Reveal key={member.name} delay={i * 0.06}>
                <div className="aspect-[4/5] bg-mist mb-5 flex items-center justify-center">
                  <span className="font-display text-display-xl text-concrete/30">{member.name.charAt(0)}</span>
                </div>
                <h3 className="font-display text-display-md">{member.name}</h3>
                <p className="font-body text-body-sm text-concrete mt-1">{member.role}</p>
                <p className="font-mono text-mono-sm text-concrete/60 mt-1">Desde {member.since}</p>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      <section className="py-section bg-ink text-bone">
        <div className="container-asymmetric text-center">
          <h2 className="font-display text-display-lg max-w-2xl mx-auto text-balance mb-8">
            Contanos tu proyecto. Lo hacemos realidad.
          </h2>
          <div className="flex justify-center">
            <MagneticButton href="/cotizar" variant="secondary">
              Cotizar mi obra
            </MagneticButton>
          </div>
        </div>
      </section>

      <Footer />
    </main>
  );
}
