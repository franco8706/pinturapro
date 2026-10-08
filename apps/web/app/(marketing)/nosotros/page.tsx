import { Navbar } from "@/components/features/navbar";
import { Footer } from "@/components/features/footer";
import { MagneticButton } from "@/components/features/magnetic-button";
import { Reveal, SectionLabel } from "@/components/features/states";

import type { Metadata } from "next";
import { tarjeta } from "@/lib/tarjeta";

export const metadata: Metadata = {
  title: "Nosotros",
  description: "Pintura Pro conecta a quien tiene algo para pintar con pintores independientes. Cómo funciona y qué no hacemos.",
  alternates: { canonical: "/nosotros" },
  ...tarjeta({
    titulo: "Nosotros",
    descripcion: "Pintura Pro conecta a quien tiene algo para pintar con pintores independientes. Cómo funciona y qué no hacemos.",
    ruta: "/nosotros",
  }),
};

/**
 * Esta página hablaba como una empresa de pintura: "pintamos como nos gustaría que pintaran
 * nuestra propia casa", "doce años pintando obra", "lo hacemos realidad", y un equipo de tres
 * —Martín Rojas "Fundador · Maestro pintor", Lucía Fernández, Diego Sosa— que son los tres
 * pintores DEMO de la plataforma, presentados como empleados.
 *
 * Pintura Pro es un marketplace puro (decisión del dueño, 27/9/2026): conecta, no pinta. La
 * página anterior contradecía los términos ("Pintura Pro no es parte de ese acuerdo") y era
 * publicidad que obliga. La marcó el sub-agente visitante de `recorrido-web`.
 *
 * Cada principio de abajo tiene algo en el código que lo sostiene; si alguno deja de ser
 * cierto, esta página tiene que cambiar con él:
 *  · "Vos elegís": el cliente acepta una cotización; nadie le asigna un pintor.
 *  · "Reseñas de verdad": `dejarResena` exige un trabajo completado de quien la escribe.
 *  · "Lo que cobramos": una suscripción mensual al pintor, sin comisión (desde el 6/10/2026;
 *    antes decía 10 % sobre el trabajo, que nunca se cobró).
 *  · "Tus datos": /mi-cuenta descarga y elimina sin intervención de nadie.
 *
 * No hay sección de equipo: no hay datos reales para mostrar, y la regla del proyecto (ver
 * `lib/empresa.ts`) es que lo que no existe no se inventa.
 */
const principios = [
  {
    title: "Vos elegís",
    description:
      "Publicás lo que necesitás y los pintores te cotizan. Comparás precio, reseñas y trabajos anteriores, y aceptás el que más te cierra. Nadie te asigna a nadie.",
  },
  {
    title: "Reseñas de verdad",
    description:
      "Sólo puede calificar a un pintor quien lo contrató y terminó un trabajo con él. No se compran, no se editan y no se borran cuando alguien cierra su cuenta.",
  },
  {
    title: "Lo que cobramos, dicho antes",
    description:
      "Publicar un pedido es gratis. La plataforma se sostiene con una suscripción mensual fija que pagan los pintores para cotizar: no hay comisión, y el pago del trabajo va directo del cliente al pintor. Durante el lanzamiento, cotizar también es gratis.",
  },
  {
    title: "Tus datos son tuyos",
    description:
      "Desde tu cuenta podés descargar todo lo que tenemos sobre vos o eliminarla, en el momento y sin pedirle permiso a nadie.",
  },
];

export default function NosotrosPage() {
  return (
    <main>
      <Navbar />

      <section className="pt-32 sm:pt-40 pb-section">
        <div className="container-asymmetric">
          <SectionLabel className="mb-6">Nosotros</SectionLabel>
          <h1 className="font-display text-display-xl max-w-4xl text-balance mb-10">
            Conectamos a quien tiene algo para pintar con quien sabe pintarlo.
          </h1>
          <p className="font-body text-body-lg text-concrete max-w-2xl">
            Pintura Pro es un lugar de encuentro. Los clientes publican lo que necesitan, los
            pintores independientes cotizan, y cada cliente elige con quién trabajar. El trabajo lo
            hace el pintor, y se arregla y se paga directamente entre ustedes.
          </p>
        </div>
      </section>

      <section className="py-section bg-mist border-y border-concrete/15">
        <div className="container-asymmetric grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-16">
          {principios.map((v, i) => (
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
        <div className="container-asymmetric max-w-3xl">
          <SectionLabel className="mb-6">Lo que no hacemos</SectionLabel>
          {/* Dicho acá también, y no sólo en los términos: es lo primero que alguien
              necesita saber antes de contratar por una plataforma. */}
          <p className="font-body text-body-lg text-concrete leading-relaxed">
            No pintamos ni tenemos pintores propios. No fijamos los precios, no supervisamos las
            obras y no damos garantía sobre los trabajos: el acuerdo es entre vos y el pintor que
            elegiste, y cualquier reclamo por el trabajo se dirige a él. Lo que sí hacemos es que
            puedas elegir con información —precios, reseñas reales, trabajos anteriores— y que, si
            algo se cae, cualquiera de las dos partes pueda cancelar.
          </p>
        </div>
      </section>

      <section className="py-section bg-ink text-bone">
        <div className="container-asymmetric text-center">
          <h2 className="font-display text-display-lg max-w-2xl mx-auto text-balance mb-8">
            ¿Tenés algo para pintar, o sabés pintar?
          </h2>
          <div className="flex flex-wrap justify-center gap-4">
            <MagneticButton href="/publicar" variant="secondary">
              Publicar mi pedido
            </MagneticButton>
            <MagneticButton href="/registro" variant="secondary">
              Sumarme como pintor
            </MagneticButton>
          </div>
        </div>
      </section>

      <Footer />
    </main>
  );
}
