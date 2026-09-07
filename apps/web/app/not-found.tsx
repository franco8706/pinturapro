import Link from "next/link";
import { Navbar } from "@/components/features/navbar";
import { Footer } from "@/components/features/footer";

/**
 * 404. Sin esto Next muestra su página por defecto, en inglés y sin la navegación
 * del sitio — un callejón sin salida para alguien que llegó por un link viejo.
 */
export default function NotFound() {
  return (
    <main>
      <Navbar />
      <section className="pt-32 sm:pt-40 pb-section min-h-[70vh] flex items-center">
        <div className="container-asymmetric w-full">
          <p className="font-mono text-mono-sm text-concrete uppercase tracking-widest mb-4">Error 404</p>
          <h1 className="font-display text-display-xl mb-6 max-w-3xl">Esta página no existe.</h1>
          <p className="font-body text-body-lg text-concrete max-w-xl mb-10">
            Puede que el link esté viejo o que la obra que buscabas ya no esté publicada. Estos son los
            caminos más transitados:
          </p>
          <nav aria-label="Sugerencias de navegación" className="flex flex-wrap gap-3">
            {[
              { href: "/", label: "Inicio" },
              { href: "/obras", label: "Obras" },
              { href: "/pintores", label: "Pintores" },
              { href: "/simulador", label: "Simulador de color" },
              { href: "/cotizar", label: "Pedir presupuesto" },
            ].map((l) => (
              <Link
                key={l.href}
                href={l.href}
                className="px-5 py-3 border border-ink font-body text-body-sm hover:bg-ink hover:text-bone transition-colors duration-300"
              >
                {l.label}
              </Link>
            ))}
          </nav>
        </div>
      </section>
      <Footer />
    </main>
  );
}
