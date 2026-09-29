import type { Metadata } from "next";
import { tarjeta } from "@/lib/tarjeta";

// La página es un componente cliente y por eso no puede exportar `metadata`.
// Este layout existe sólo para darle título y descripción propios.
export const metadata: Metadata = {
  title: "Colores y marcas",
  description: "Colores de ejemplo agrupados por marca y filtrados por interior y exterior. Confirmá el código en la pinturería antes de comprar.",
  alternates: { canonical: "/colores" },
  ...tarjeta({ titulo: "Colores y marcas", descripcion: "Colores de ejemplo agrupados por marca y filtrados por interior y exterior. Confirmá el código en la pinturería antes de comprar.", ruta: "/colores" }),
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
