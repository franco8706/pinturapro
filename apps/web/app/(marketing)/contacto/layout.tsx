import type { Metadata } from "next";

// La página es un componente cliente y por eso no puede exportar `metadata`.
// Este layout existe sólo para darle título y descripción propios.
export const metadata: Metadata = {
  title: "Contacto",
  description: "Consultas sobre Pintura Pro, el marketplace que conecta clientes con pintores independientes.",
  alternates: { canonical: "/contacto" },
  openGraph: { title: "Contacto", description: "Consultas sobre Pintura Pro, el marketplace que conecta clientes con pintores independientes." },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
