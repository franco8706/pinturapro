import type { Metadata } from "next";
import Link from "next/link";
import { Navbar } from "@/components/features/navbar";
import { Footer } from "@/components/features/footer";

/**
 * Confirmación de la baja.
 *
 * Tiene que ser una página PÚBLICA: cuando llega acá la sesión ya no existe. La primera
 * versión mostraba el aviso en la misma pantalla de la cuenta, y como esa pantalla exige
 * sesión, el servidor mandaba a /ingresar — la persona apretaba "eliminar" y aparecía un
 * formulario de login, sin una palabra de confirmación. Medido en el navegador.
 */
export const metadata: Metadata = {
  title: "Cuenta eliminada",
  robots: { index: false, follow: false },
};

export default function CuentaEliminadaPage() {
  return (
    <main>
      <Navbar />
      <section className="pt-32 sm:pt-40 pb-section min-h-screen">
        <div className="container-asymmetric max-w-2xl">
          <p className="font-mono text-mono-sm text-concrete uppercase tracking-widest mb-4">Listo</p>
          <h1 className="font-display text-display-xl mb-6">Tu cuenta fue eliminada.</h1>
          <p className="font-body text-body-lg text-concrete mb-4">
            Borramos tu cuenta, tu perfil y todo lo que habías publicado, con sus fotos.
          </p>
          <p className="font-body text-body-md text-concrete mb-10">
            Si habías acordado algún trabajo o escrito alguna reseña, eso queda —sin tu nombre—
            porque también es el registro de trabajo y la reputación de la otra persona.
          </p>
          <div className="flex flex-wrap gap-3">
            <Link
              href="/"
              className="inline-flex items-center px-6 py-3 bg-ink text-bone font-body text-body-sm hover:bg-ink/90 transition-colors"
            >
              Ir al inicio
            </Link>
            <Link
              href="/crear-cuenta"
              className="inline-flex items-center px-6 py-3 border border-concrete/30 font-body text-body-sm hover:border-ink transition-colors"
            >
              Crear una cuenta nueva
            </Link>
          </div>
        </div>
      </section>
      <Footer />
    </main>
  );
}
