import { Navbar } from "@/components/features/navbar";
import { Footer } from "@/components/features/footer";
import { SectionLabel } from "@/components/features/states";

import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Términos y condiciones",
  description: "Las reglas de uso de Pintura Pro: qué hace la plataforma, qué no, y qué se espera de cada parte.",
  alternates: { canonical: "/terminos" },
  openGraph: { title: "Términos y condiciones", description: "Las reglas de uso de Pintura Pro." },
};

/**
 * Términos y condiciones.
 *
 * Lo más importante de este texto es delimitar QUÉ ES la plataforma: un lugar donde clientes
 * y pintores se encuentran. No es la parte contratante del trabajo de pintura, no cobra el
 * trabajo ni lo garantiza. Sin esa aclaración, un cliente insatisfecho puede razonablemente
 * entender que le reclama a Pintura Pro, no al pintor.
 *
 * PENDIENTE DEL DUEÑO: definir cómo se cobra la comisión (hoy se calcula y se guarda en
 * `jobs.commission_amount` pero NO se cobra: no hay pasarela de pago), completar los datos
 * de la razón social y hacerlo revisar por un abogado antes de publicar.
 */

const ULTIMA_ACTUALIZACION = "10 de septiembre de 2026";
const CONTACTO = "hola@pinturapro.ar";

function Seccion({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <section className="mb-10">
      <h2 className="font-display text-display-md mb-4">{titulo}</h2>
      <div className="font-body text-body-md text-concrete space-y-3 max-w-2xl [&_strong]:text-ink">{children}</div>
    </section>
  );
}

export default function TerminosPage() {
  return (
    <main>
      <Navbar />
      <section className="pt-32 sm:pt-40 pb-section">
        <div className="container-asymmetric">
          <SectionLabel className="mb-4">Legales</SectionLabel>
          <h1 className="font-display text-display-xl mb-4 max-w-3xl text-balance">Términos y condiciones.</h1>
          <p className="font-mono text-mono-sm text-concrete mb-12">
            Última actualización: {ULTIMA_ACTUALIZACION}
          </p>

          <Seccion titulo="Qué es Pintura Pro">
            <p>
              Pintura Pro es una <strong>plataforma de contacto</strong> entre personas que
              necesitan un trabajo de pintura y pintores profesionales que lo ofrecen. Publicás tu
              pedido, recibís cotizaciones, elegís una y coordinás directamente con el pintor.
            </p>
            <p>
              <strong>El trabajo se contrata entre vos y el pintor.</strong> Pintura Pro no es parte
              de ese acuerdo: no ejecuta la obra, no fija el precio, no supervisa la calidad y no
              responde por el resultado. Cualquier reclamo por el trabajo se dirige a quien lo hizo.
            </p>
          </Seccion>

          <Seccion titulo="Quién puede usarla">
            <p>
              Personas mayores de 18 años con capacidad para contratar. Al crear una cuenta declarás
              que los datos que cargás son verdaderos y que sos quien decís ser.
            </p>
          </Seccion>

          <Seccion titulo="Qué se espera de vos">
            <ul className="list-disc pl-5 space-y-2">
              <li>Publicar información veraz sobre tu trabajo, tu experiencia y tus pedidos.</li>
              <li>
                No subir fotos de trabajos que no hiciste, ni presentar como propia una obra ajena.
              </li>
              <li>
                Escribir reseñas basadas en tu experiencia real. No se pueden comprar, intercambiar
                ni escribir reseñas de trabajos que no existieron.
              </li>
              <li>No usar la plataforma para ofrecer servicios distintos de los de pintura de obra.</li>
              <li>Cumplir lo que acordaste con la otra parte, o avisar a tiempo si no vas a poder.</li>
            </ul>
            <p>
              Podemos suspender una cuenta que incumpla estas reglas, y dar de baja contenido falso o
              engañoso.
            </p>
          </Seccion>

          <Seccion titulo="Cotizaciones y pagos">
            <p>
              Las cotizaciones son ofertas del pintor. Cuando aceptás una, se registra el acuerdo y
              las dos partes acceden al teléfono de la otra para coordinar.
            </p>
            <p>
              <strong>El pago se hace directamente entre cliente y pintor</strong>, por fuera de la
              plataforma y por el medio que acuerden. Pintura Pro no cobra el trabajo, no lo retiene
              en garantía y no interviene si hay un desacuerdo sobre el pago.
            </p>
          </Seccion>

          <Seccion titulo="Reseñas y calificaciones">
            <p>
              Sólo puede reseñar un trabajo el cliente que lo contrató, y únicamente una vez que
              está marcado como completado. La calificación que se ve en cada perfil es el promedio
              de esas reseñas.
            </p>
            <p>
              Podemos dar de baja una reseña con insultos, datos personales de terceros o contenido
              manifiestamente falso; no la damos de baja sólo por ser negativa.
            </p>
          </Seccion>

          <Seccion titulo="El simulador de color">
            <p>
              El simulador da una <strong>referencia visual aproximada</strong>. El color en pantalla
              depende de tu monitor, de la luz del ambiente y de la superficie, y va a diferir del
              resultado real. Confirmá siempre el color con la carta física antes de comprar.
            </p>
            <p>
              La paleta por marcas es de elaboración propia. No es la carta oficial de ninguna marca
              y no tenemos relación comercial con ellas: sus nombres se usan sólo como referencia.
            </p>
          </Seccion>

          <Seccion titulo="Contenido que subís">
            <p>
              Las fotos y textos que publicás siguen siendo tuyos. Al subirlos nos autorizás a
              mostrarlos dentro de la plataforma para lo que fueron cargados: tu perfil, tu portfolio
              o tu pedido. Si borrás tu cuenta, dejamos de mostrarlos.
            </p>
          </Seccion>

          <Seccion titulo="Disponibilidad del servicio">
            <p>
              Trabajamos para que el sitio esté siempre disponible, pero no garantizamos que
              funcione sin interrupciones. Podemos hacer mantenimiento, cambiar funciones o
              discontinuar el servicio avisando con antelación razonable.
            </p>
          </Seccion>

          <Seccion titulo="Ley aplicable">
            <p>
              Estos términos se rigen por las leyes de la República Argentina. Ante cualquier
              conflicto son competentes los tribunales ordinarios de la Ciudad Autónoma de Buenos
              Aires, sin perjuicio de los derechos que la Ley 24.240 de Defensa del Consumidor le
              reconoce a los usuarios.
            </p>
          </Seccion>

          <Seccion titulo="Contacto">
            <p>
              Cualquier duda sobre estos términos:{" "}
              <a href={`mailto:${CONTACTO}`} className="text-ink underline underline-offset-2">
                {CONTACTO}
              </a>
              .
            </p>
          </Seccion>
        </div>
      </section>
      <Footer />
    </main>
  );
}
