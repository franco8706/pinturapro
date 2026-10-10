import { Navbar } from "@/components/features/navbar";
import { EMAIL_READY } from "@/lib/email";
import { Footer } from "@/components/features/footer";
import { SectionLabel } from "@/components/features/states";

import type { Metadata } from "next";
import { tarjeta } from "@/lib/tarjeta";

export const metadata: Metadata = {
  title: "Términos y condiciones",
  description: "Las reglas de uso de Pintura Pro: qué hace la plataforma, qué no, y qué se espera de cada parte.",
  alternates: { canonical: "/terminos" },
  ...tarjeta({ titulo: "Términos y condiciones", descripcion: "Las reglas de uso de Pintura Pro.", ruta: "/terminos" }),
};

/**
 * Términos y condiciones.
 *
 * Lo más importante de este texto es delimitar QUÉ ES la plataforma: un lugar donde clientes
 * y pintores se encuentran. No es la parte contratante del trabajo de pintura, no cobra el
 * trabajo ni lo garantiza. Sin esa aclaración, un cliente insatisfecho puede razonablemente
 * entender que le reclama a Pintura Pro, no al pintor.
 *
 * Desde el 6/10/2026 la plataforma no cobra comisión por trabajo: el pintor paga una
 * suscripción mensual (decisión del dueño). Mientras dure el lanzamiento no se cobra nada.
 *
 * PENDIENTE DEL DUEÑO: completar los datos de la razón social y hacerlo revisar por un abogado
 * antes de publicar —en especial la sección de la suscripción: precio en dólares cobrado en
 * pesos, renovación, baja (Disposición 945/2025) y arrepentimiento (Res. 424/2020, Ley 24.240
 * art. 34), y si el pintor cuenta como consumidor—.
 */

// Si cambiás el TEXTO de esta página, cambiá esta fecha: estuvo en "10 de septiembre" mientras
// el contenido se reescribía tres veces (marketplace puro, cancelaciones, qué es público).
const ULTIMA_ACTUALIZACION = "10 de octubre de 2026";
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
            {/* Hasta el 6/10/2026 acá decía "Comisión de la plataforma: 10%", que se calculaba
                y nunca se cobró. Ahora no hay comisión: el pintor paga una suscripción (abajo). */}
            <p>
              <strong>Pintura Pro no cobra comisión sobre los trabajos.</strong> El precio que
              acuerdan es todo del pintor, y el cliente no le paga nada a la plataforma: publicar un
              pedido y recibir cotizaciones es gratis.
            </p>
            {/* Faltaba la otra mitad: qué pasa cuando algo sale mal. Los términos decían quién
                contrata a quién y que la plataforma no responde por el resultado, pero no
                decían que existe un botón de cancelar ni qué hace. Quien sólo leía esto no se
                enteraba de la única salida que el producto ofrece de verdad.

                Cada frase de abajo está verificada contra el código: `cancelarTrabajo` en
                `(marketplace)/actions.ts` (cualquiera de las dos partes, estados 'quoted',
                'accepted' e 'in_progress', sin penalidad, con aviso por mail a la otra parte SÓLO si `EMAIL_READY`: sin `RESEND_API_KEY` no sale ningún correo, y la app móvil no los manda nunca porque requieren la clave de servicio)
                y el trigger `on_job_cancelled` de la migración 0009, que vuelve a publicar el
                pedido SÓLO si venía de 'accepted' o 'in_progress' — un pedido apenas cotizado
                nunca se había cerrado, así que no hay nada que reabrir. */}
            <p>
              <strong>Si algo se cae, se cancela.</strong> Cualquiera de las dos partes puede
              cancelar mientras el trabajo no esté terminado, desde su panel y sin dar
              explicaciones. La otra parte lo ve en su panel
              {EMAIL_READY ? " y recibe un aviso por correo" : ""}. Si el trabajo ya estaba
              aceptado, el pedido vuelve a publicarse solo para recibir cotizaciones nuevas.
            </p>
            <p>
              Cancelar <strong>no tiene ninguna penalidad dentro de la plataforma</strong>, ni
              para el cliente ni para el pintor: Pintura Pro no cobra el trabajo, no retiene y no
              arbitra. Sí queda registrado quién canceló y cuándo.
              Es la única herramienta que ofrecemos ante un incumplimiento. Lo que se haya
              acordado entre ustedes por fuera —una seña, materiales comprados, días de
              trabajo— se resuelve entre ustedes, y si hace falta, por la vía que corresponda.
            </p>
          </Seccion>

          {/* La suscripción (decisión del dueño, 6/10/2026). Cada afirmación de esta sección
              tiene que coincidir con el código: el precio y el dólar con `precio_ars()` y
              `cotizaciones_dolar` (migración 0027), la gracia con DIAS_DE_GRACIA y la regla de
              "un mes por pago" con `vigenteHasta` (packages/dominio/src/suscripcion.ts), y el
              corte con `puede_cotizar()`. */}
          <Seccion titulo="Suscripción para pintores">
            <p>
              Para enviar cotizaciones, un pintor o una empresa necesita una{" "}
              <strong>suscripción mensual de US$5</strong>. Se cobra <strong>en pesos</strong>, al
              dólar oficial vendedor del Banco Nación del día en que se genera el cobro,
              redondeado hacia arriba a la centena de pesos, y el precio en pesos se muestra
              siempre antes de pagar. Es el precio final.
            </p>
            <p>
              <strong>Durante el lanzamiento, cotizar es gratis.</strong> Antes de que empiece el
              cobro, la fecha se publica en esta página y en el panel de cada pintor con al menos
              30 días de anticipación.
            </p>
            <p>
              Se puede pagar con <strong>débito automático de Mercado Pago</strong> (se renueva
              solo cada mes), con el <strong>QR del mes</strong> o por{" "}
              <strong>transferencia</strong> con el código de cada pintor. Pintura Pro no guarda
              datos de tarjetas: los maneja Mercado Pago. Cada pago aprobado suma un mes de acceso,
              contado desde el vencimiento anterior, así que pagar antes no hace perder días. Una
              transferencia vale por el monto que te mostramos al avisarla, si llega mientras ese
              aviso está vigente (3 días); si no, por el precio del día en que llega.
            </p>
            <p>
              Si un débito automático no entra, Mercado Pago lo reintenta y seguís cotizando{" "}
              <strong>10 días</strong> más. Después, y también si no pagás el mes por QR o
              transferencia, <strong>no podés enviar cotizaciones nuevas</strong>; las que ya
              enviaste y los trabajos en curso siguen igual.
            </p>
            <p>
              <strong>Te das de baja cuando quieras</strong>, desde tu panel: no se cobra más y
              seguís cotizando hasta el final de lo que pagaste. Si sos consumidor, podés
              arrepentirte dentro de los 10 días corridos desde que te suscribiste y te devolvemos
              lo pagado. Un cambio de precio se avisa con al menos 30 días de anticipación.
            </p>
            <p>
              La suscripción es por usar la plataforma: <strong>no garantiza pedidos</strong>, que
              un cliente te elija ni ningún ingreso.
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
            {/* La frase de arriba, leída sola, promete que al borrar la cuenta desaparece
                TODO lo que subiste. No es cierto para las reseñas, y es a propósito: son la
                reputación del pintor, no sólo tu texto. Mejor decirlo acá que dejar que
                alguien lo descubra después. */}
            <p>
              <strong>Una excepción: las reseñas que escribís.</strong> Si das de baja tu cuenta,
              la reseña queda publicada sin tu nombre. Es la reputación del pintor que la recibió:
              si se fuera con tu cuenta, cualquiera podría bajarle la calificación a un pintor
              simplemente borrándose.
            </p>
          </Seccion>

          {/* No había ningún camino declarado para pedir la baja de una reseña falsa, una
              foto ajena o un texto difamatorio: ni botón, ni formulario, ni una línea en los
              términos. El botón es producto y lleva tiempo; decir a dónde escribir no. */}
          <Seccion titulo="Denunciar un contenido">
            <p>
              Si una reseña sobre vos es falsa o difamatoria, si alguien publicó una foto de un
              trabajo que no hizo, o si un contenido usa datos personales de otra persona,{" "}
              <strong>escribinos a <a href="mailto:hola@pinturapro.ar" className="text-ink underline underline-offset-2">hola@pinturapro.ar</a></strong>{" "}
              con el enlace a la página y una explicación de por qué. Revisamos cada pedido y
              respondemos; si el contenido incumple estas reglas, lo damos de baja.
            </p>
            <p>
              Una reseña cuenta lo que pasó con un trabajo. <strong>Amenazar con una mala reseña
              para conseguir un descuento, una devolución o cualquier otra cosa</strong> es un uso
              indebido: la reseña se da de baja y la cuenta puede suspenderse. Si sos pintor, ves
              cada reseña en tu panel, con un enlace para denunciarla.
            </p>
            <p>
              Somos una plataforma de intermediación: no revisamos de antemano todo lo que se
              publica. Por eso este canal existe, y por eso te pedimos que lo uses en vez de
              resolverlo por tu cuenta.
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
