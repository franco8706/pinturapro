import type { Metadata } from "next";
import { tarjeta } from "@/lib/tarjeta";

// La página es un componente cliente y por eso no puede exportar `metadata`.
// Este layout existe sólo para darle título y descripción propios.
export const metadata: Metadata = {
  title: "Contacto",
  description: "Consultas sobre Pintura Pro, el marketplace que conecta clientes con pintores independientes.",
  alternates: { canonical: "/contacto" },
  ...tarjeta({ titulo: "Contacto", descripcion: "Consultas sobre Pintura Pro, el marketplace que conecta clientes con pintores independientes.", ruta: "/contacto" }),
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
