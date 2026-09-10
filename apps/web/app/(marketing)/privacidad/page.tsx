import { Navbar } from "@/components/features/navbar";
import { Footer } from "@/components/features/footer";
import { SectionLabel } from "@/components/features/states";

import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Política de privacidad",
  description: "Qué datos recolecta Pintura Pro, para qué los usa, con quién los comparte y cómo ejercer tus derechos.",
  alternates: { canonical: "/privacidad" },
  openGraph: { title: "Política de privacidad", description: "Qué datos recolecta Pintura Pro, para qué los usa y con quién los comparte." },
};

/**
 * Política de privacidad.
 *
 * No existía, y hacía falta por tres motivos distintos: la Ley 25.326 exige informar qué se
 * hace con los datos personales; Facebook no aprueba una app para producción sin una URL de
 * política de privacidad; y Google la pide en el consent screen de OAuth.
 *
 * El contenido describe lo que el sistema HACE de verdad, verificado contra el código:
 * qué columnas se guardan, a qué terceros viaja cada dato y en qué momento se comparte el
 * teléfono. Si algo del producto cambia, este texto cambia con él.
 *
 * PENDIENTE DEL DUEÑO: completar los datos del responsable (razón social, domicilio, CUIT)
 * en `RESPONSABLE`, y hacerlo revisar por un abogado antes de publicar.
 */

const RESPONSABLE = {
  nombre: "Pintura Pro",
  email: "hola@pinturapro.ar",
  // TODO(dueño): razón social, CUIT y domicilio legal. La Ley 25.326 exige identificar al
  // responsable de la base de datos, y la AAIP pide domicilio para los reclamos.
};

const ULTIMA_ACTUALIZACION = "10 de septiembre de 2026";

function Seccion({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <section className="mb-10">
      <h2 className="font-display text-display-md mb-4">{titulo}</h2>
      <div className="font-body text-body-md text-concrete space-y-3 max-w-2xl [&_strong]:text-ink">{children}</div>
    </section>
  );
}

export default function PrivacidadPage() {
  return (
    <main>
      <Navbar />
      <section className="pt-32 sm:pt-40 pb-section">
        <div className="container-asymmetric">
          <SectionLabel className="mb-4">Legales</SectionLabel>
          <h1 className="font-display text-display-xl mb-4 max-w-3xl text-balance">Política de privacidad.</h1>
          <p className="font-mono text-mono-sm text-concrete mb-12">
            Última actualización: {ULTIMA_ACTUALIZACION}
          </p>

          <Seccion titulo="Quién es responsable de tus datos">
            <p>
              {RESPONSABLE.nombre} es responsable de la base de datos de usuarios de este sitio.
              Para cualquier consulta sobre tus datos personales, escribinos a{" "}
              <a href={`mailto:${RESPONSABLE.email}`} className="text-ink underline underline-offset-2">
                {RESPONSABLE.email}
              </a>
              .
            </p>
          </Seccion>

          <Seccion titulo="Qué datos recolectamos">
            <p>
              <strong>Si creás una cuenta:</strong> tu nombre, email y el rol que elegís (cliente,
              pintor o empresa). Si entrás con Google, Microsoft o Facebook, recibimos de ese
              proveedor tu nombre y email; nunca tu contraseña.
            </p>
            <p>
              <strong>Si completás tu perfil:</strong> foto, biografía, zona de trabajo,
              especialidades y teléfono. El teléfono es opcional.
            </p>
            <p>
              <strong>Si usás el marketplace:</strong> los pedidos que publicás, las cotizaciones
              que enviás o recibís, los montos acordados y las reseñas que escribís.
            </p>
            <p>
              <strong>Si nos escribís por un formulario</strong> de contacto, cotización o
              postulación: los datos que completes, incluido tu teléfono si lo dejás.
            </p>
            <p>
              <strong>Si subís fotos:</strong> las de tu portfolio y tu foto de perfil quedan
              guardadas. Las fotos que cargás en el <strong>simulador de color</strong> son un caso
              aparte: mirá la sección siguiente.
            </p>
          </Seccion>

          <Seccion titulo="Las fotos del simulador de color">
            <p>
              El <strong>pincel</strong> y la <strong>varita mágica</strong> procesan la foto
              enteramente en tu navegador: esa imagen nunca sale de tu dispositivo.
            </p>
            <p>
              La <strong>detección automática con IA</strong> sí necesita enviarla. La foto viaja a
              nuestro servidor y de ahí a <strong>Replicate</strong>, un servicio de procesamiento
              en Estados Unidos, que la analiza para detectar los contornos de las paredes.{" "}
              <strong>No la guardamos</strong> ni la usamos para ningún otro fin. Si preferís que la
              foto no salga de tu equipo, usá el pincel o la varita: el resultado es el mismo, sólo
              cambia cuánto trabajo hacés vos.
            </p>
          </Seccion>

          <Seccion titulo="Para qué los usamos">
            <p>
              Para que la plataforma funcione: mostrar el directorio de pintores, conectar pedidos
              con cotizaciones, permitir que las partes se contacten cuando cierran un trabajo, y
              avisarte por email cuando pasa algo que te involucra.
            </p>
            <p>
              <strong>No vendemos tus datos</strong> ni los cedemos con fines publicitarios.
            </p>
          </Seccion>

          <Seccion titulo="Qué ve el resto de la gente">
            <p>
              <strong>Si sos pintor o empresa,</strong> tu perfil es público: nombre, foto, bio,
              zona, especialidades, calificación y reseñas aparecen en el directorio y pueden ser
              indexados por buscadores. Tu ubicación aparece en el mapa a nivel de zona.
            </p>
            <p>
              <strong>Si sos cliente,</strong> tu perfil no figura en ningún directorio público. Tu
              nombre aparece como autor de las reseñas que escribís, y el pintor ve tu nombre en los
              pedidos que publicás.
            </p>
            <p>
              <strong>Tu teléfono nunca es público.</strong> Se le muestra únicamente a la otra
              parte de un trabajo <strong>ya adjudicado</strong>, para que puedan coordinar. Mientras
              una cotización siga pendiente, nadie ve tu teléfono. Tu email no se le muestra a
              ningún otro usuario.
            </p>
          </Seccion>

          <Seccion titulo="Con quién los compartimos">
            <p>Sólo con los servicios que necesitamos para operar:</p>
            <ul className="list-disc pl-5 space-y-2">
              <li>
                <strong>Supabase</strong> — base de datos, cuentas y almacenamiento de fotos
                (servidores en Estados Unidos).
              </li>
              <li>
                <strong>Replicate</strong> — análisis de las fotos del simulador, sólo en modo IA
                (Estados Unidos).
              </li>
              <li>
                <strong>Resend</strong> — envío de los emails de aviso.
              </li>
              <li>
                <strong>Google, Microsoft y Facebook</strong> — únicamente si elegís entrar con
                alguna de esas cuentas.
              </li>
            </ul>
            <p>
              Esto implica que tus datos se procesan fuera de Argentina. Al usar el sitio, prestás
              tu consentimiento para esa transferencia.
            </p>
          </Seccion>

          <Seccion titulo="Cuánto tiempo los guardamos">
            <p>
              Mientras tengas la cuenta abierta. Si la cerrás, borramos tu perfil y tus datos de
              contacto. Las reseñas y el historial de trabajos se conservan de forma{" "}
              <strong>anonimizada</strong>: son parte de la reputación de la otra parte, que no
              tiene por qué perderla porque vos te vayas.
            </p>
          </Seccion>

          <Seccion titulo="Tus derechos">
            <p>
              Podés pedirnos acceder a tus datos, corregirlos, actualizarlos o eliminarlos.
              Escribinos a{" "}
              <a href={`mailto:${RESPONSABLE.email}`} className="text-ink underline underline-offset-2">
                {RESPONSABLE.email}
              </a>{" "}
              y te respondemos dentro de los plazos que fija la Ley 25.326 de Protección de Datos
              Personales.
            </p>
            <p className="text-body-sm">
              La Agencia de Acceso a la Información Pública, órgano de control de la Ley 25.326,
              atiende las denuncias de quienes vean afectado su derecho a la protección de sus datos
              personales.
            </p>
          </Seccion>

          <Seccion titulo="Cookies y sesión">
            <p>
              Usamos una cookie técnica para mantener tu sesión abierta. No usamos cookies de
              publicidad ni de seguimiento de terceros.
            </p>
          </Seccion>

          <Seccion titulo="Cambios">
            <p>
              Si cambiamos esta política, actualizamos la fecha del encabezado. Si el cambio afecta
              de manera significativa cómo tratamos tus datos, te avisamos por email.
            </p>
          </Seccion>
        </div>
      </section>
      <Footer />
    </main>
  );
}
