import type { Metadata } from "next";

// La página es un componente cliente y por eso no puede exportar `metadata`.
// Este layout existe sólo para darle título y descripción propios.
export const metadata: Metadata = {
  title: "Sumate como Pro",
  description: "Postulate como pintor profesional: publicá tu perfil, sumá reseñas y accedé a pedidos de clientes.",
  alternates: { canonical: "/registro" },
  openGraph: { title: "Sumate como Pro", description: "Postulate como pintor profesional: publicá tu perfil, sumá reseñas y accedé a pedidos de clientes." },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
