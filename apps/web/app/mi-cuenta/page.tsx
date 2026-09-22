import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Navbar } from "@/components/features/navbar";
import { Footer } from "@/components/features/footer";
import { createClient } from "@/lib/supabase/server";
import { getOwnProfile } from "@/lib/queries";
import { BorrarCuenta } from "./borrar-cuenta";

/**
 * Mis datos y mi cuenta.
 *
 * Los derechos de acceso y de supresión de la Ley 25.326 se cumplían por correo: la persona
 * escribía y alguien tenía que atender el pedido dentro del plazo. Acá los ejerce sola.
 */
export const metadata: Metadata = {
  title: "Mis datos y mi cuenta",
  robots: { index: false, follow: false },
};

export default async function MiCuentaPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/ingresar?next=/mi-cuenta");

  let panel = "/mi-panel";
  try {
    panel = (await getOwnProfile(user.id))?.type === "client" ? "/cliente" : "/dashboard";
  } catch {
    panel = "/mi-panel";
  }

  return (
    <main>
      <Navbar />
      <section className="pt-32 sm:pt-40 pb-section min-h-screen">
        <div className="container-asymmetric max-w-2xl">
          <Link href={panel} className="font-body text-body-sm text-concrete hover:text-ink transition-colors">
            ← Volver al panel
          </Link>

          <h1 className="font-display text-display-xl mt-6 mb-4">Mis datos y mi cuenta</h1>
          <p className="font-body text-body-lg text-concrete mb-12">
            Entraste como <strong className="text-ink">{user.email}</strong>.
          </p>

          <section className="border-t border-concrete/15 pt-8 mb-12">
            <h2 className="font-display text-display-md mb-3">Descargar mis datos</h2>
            <p className="font-body text-body-md text-concrete mb-2">
              Un archivo con todo lo que el sitio tiene guardado sobre vos: tu perfil, lo que
              publicaste, las cotizaciones, las reseñas que escribiste y las consultas que
              mandaste por los formularios.
            </p>
            <p className="font-body text-body-sm text-concrete mb-6">
              La contraseña no está en el archivo porque no la guardamos: se almacena cifrada de
              una forma que no se puede revertir, ni siquiera por nosotros.
            </p>
            {/* Un enlace normal y no un botón con JavaScript: así funciona igual si el
                navegador es viejo, si la conexión falla a mitad, o si alguien lo guarda para
                después. `download` le dice al navegador que lo baje en vez de mostrarlo. */}
            <a
              href="/api/mis-datos"
              download
              className="inline-flex items-center px-6 py-3 bg-ink text-bone font-body text-body-sm hover:bg-ink/90 transition-colors"
            >
              Descargar mis datos
            </a>
          </section>

          <section className="border-t border-concrete/15 pt-8">
            <h2 className="font-display text-display-md mb-3">Eliminar mi cuenta</h2>
            <p className="font-body text-body-md text-concrete mb-4">
              Se borra tu cuenta y todo tu perfil: nombre, teléfono, foto, zona y descripción.
              También lo que hayas publicado —obras y pedidos, con sus fotos— y las consultas que
              hayas mandado.
            </p>
            <div className="border-l-2 border-ink pl-4 mb-6">
              <p className="font-body text-body-sm text-ink mb-2">
                <strong>Dos cosas quedan, sin tu nombre:</strong>
              </p>
              <ul className="font-body text-body-sm text-concrete space-y-1 list-disc pl-5">
                <li>
                  Los trabajos que ya acordaste con otra persona. Son el registro de trabajo de
                  esa persona —lo que acordó y lo que cobró—, no sólo tuyo.
                </li>
                <li>
                  Las reseñas que hayas escrito. Son la reputación de un pintor: si se fueran con
                  tu cuenta, cualquiera podría bajarle el promedio a un pintor dándose de baja.
                </li>
              </ul>
              <p className="font-body text-body-sm text-concrete mt-2">
                En los dos casos tu nombre desaparece: del otro lado se ve “Cuenta dada de baja”.
              </p>
            </div>
            <p className="font-body text-body-sm text-concrete mb-6">
              Si tenés un trabajo en marcha, primero hay que cerrarlo o cancelarlo: hay alguien
              del otro lado esperando.{" "}
              <strong className="text-ink">Esto no se puede deshacer.</strong>
            </p>
            <BorrarCuenta />
          </section>

          <p className="font-body text-body-sm text-concrete mt-12">
            Qué datos guardamos y para qué, en{" "}
            <Link href="/privacidad" className="text-ink underline underline-offset-2">
              la política de privacidad
            </Link>
            .
          </p>
        </div>
      </section>
      <Footer />
    </main>
  );
}
