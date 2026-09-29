import type { Metadata } from "next";
import { tarjeta } from "@/lib/tarjeta";

// La página es un componente cliente y por eso no puede exportar `metadata`.
// Este layout existe sólo para darle título y descripción propios.
export const metadata: Metadata = {
  title: "Simulador de color",
  description: "Subí una foto de tu pared y probá colores sobre ella antes de comprar la pintura.",
  alternates: { canonical: "/simulador" },
  ...tarjeta({ titulo: "Simulador de color", descripcion: "Subí una foto de tu pared y probá colores sobre ella antes de comprar la pintura.", ruta: "/simulador" }),
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
