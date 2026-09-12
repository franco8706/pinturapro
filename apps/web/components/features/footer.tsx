import Link from "next/link";
import { CONTACTO } from "@/lib/empresa";

const columns = [
  {
    title: "Empresa",
    links: [
      { href: "/obras", label: "Obras" },
      { href: "/simulador", label: "Simulador" },
      { href: "/aprender", label: "Aprender" },
      { href: "/asesoramiento", label: "Asesoramiento" },
      { href: "/novedades", label: "Novedades" },
      { href: "/nosotros", label: "Nosotros" },
      { href: "/contacto", label: "Contacto" },
    ],
  },
  {
    title: "Pintores",
    links: [
      { href: "/pintores", label: "Directorio" },
      { href: "/mapa", label: "Mapa por zona" },
      { href: "/registro", label: "Sumate como pro" },
      { href: "/dashboard", label: "Mi panel" },
    ],
  },
  {
    title: "Marketplace",
    links: [
      { href: "/publicar", label: "Publicar trabajo" },
      { href: "/trabajos", label: "Trabajos disponibles" },
      { href: "/cotizaciones", label: "Cotizaciones" },
    ],
  },
];

export function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer className="bg-ink text-bone">
      <div className="container-asymmetric py-section-sm">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-8">
          <div className="lg:col-span-5">
            <Link href="/" className="font-display text-display-md leading-none">
              Pintura<span className="text-concrete">Pro</span>
            </Link>
            <p className="font-body text-body-md text-bone/60 mt-6 max-w-sm">
              Pintura profesional de obra. Transformamos espacios con precisión, color y un resultado que se siente.
            </p>
          </div>

          {columns.map((col) => (
            <div key={col.title} className="lg:col-span-2">
              <p className="font-mono text-mono-sm text-bone/60 uppercase tracking-widest mb-5">{col.title}</p>
              <ul className="space-y-3">
                {col.links.map((link) => (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      className="font-body text-body-sm text-bone/70 hover:text-bone transition-colors duration-300"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-16 pt-8 border-t border-bone/10 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          {/* Los legales van acá y no en una columna temática: es donde los busca la gente, y
              también donde los buscan los revisores de Facebook y Google, que no aprueban una
              app OAuth para producción sin una URL de política de privacidad accesible. */}
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 font-mono text-mono-sm text-bone/60">
            <p>© {year} Pintura Pro · Buenos Aires, Argentina</p>
            <span aria-hidden className="text-bone/20">·</span>
            <Link href="/privacidad" className="hover:text-bone transition-colors duration-300">
              Privacidad
            </Link>
            <Link href="/terminos" className="hover:text-bone transition-colors duration-300">
              Términos
            </Link>
          </div>
          {/* Instagram apuntaba a `https://instagram.com` (la portada de Instagram, no un
              perfil) y WhatsApp a `https://wa.me/` sin número: los dos abrían una página
              inútil. Ahora salen de lib/empresa.ts y el que no tiene valor no se muestra. */}
          <div className="flex gap-6 font-mono text-mono-sm text-bone/60">
            {CONTACTO.instagram && (
              <a
                href={`https://instagram.com/${CONTACTO.instagram.replace(/^@/, "")}`}
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-bone transition-colors duration-300"
              >
                Instagram
              </a>
            )}
            {CONTACTO.whatsapp && (
              <a
                href={`https://wa.me/${CONTACTO.whatsapp.replace(/\D/g, "")}`}
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-bone transition-colors duration-300"
              >
                WhatsApp
              </a>
            )}
            <a href={`mailto:${CONTACTO.email}`} className="hover:text-bone transition-colors duration-300">
              {CONTACTO.email}
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
