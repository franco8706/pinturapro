import type { Metadata } from "next";
import { tarjeta } from "@/lib/tarjeta";

// La página es un componente cliente y por eso no puede exportar `metadata`.
// Este layout existe sólo para darle título y descripción propios.
export const metadata: Metadata = {
  title: "Sumate como Pro",
  description: "Postulate como pintor profesional: publicá tu perfil, sumá reseñas y accedé a pedidos de clientes.",
  alternates: { canonical: "/registro" },
  ...tarjeta({ titulo: "Sumate como Pro", descripcion: "Postulate como pintor profesional: publicá tu perfil, sumá reseñas y accedé a pedidos de clientes.", ruta: "/registro" }),
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
