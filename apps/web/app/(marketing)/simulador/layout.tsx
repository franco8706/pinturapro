import type { Metadata } from "next";

// La página es un componente cliente y por eso no puede exportar `metadata`.
// Este layout existe sólo para darle título y descripción propios.
export const metadata: Metadata = {
  title: "Simulador de color",
  description: "Subí una foto de tu pared y probá colores reales de primeras marcas antes de comprar la pintura.",
  alternates: { canonical: "/simulador" },
  openGraph: { title: "Simulador de color", description: "Subí una foto de tu pared y probá colores reales de primeras marcas antes de comprar la pintura." },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
