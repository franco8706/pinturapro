import type { Metadata } from "next";

// La página es un componente cliente y por eso no puede exportar `metadata`.
// Este layout existe sólo para darle título y descripción propios.
export const metadata: Metadata = {
  title: "Colores y marcas",
  description: "Paleta curada de Alba, Sherwin Williams, Sinteplast y Plavicon, filtrada por interior y exterior.",
  alternates: { canonical: "/colores" },
  openGraph: { title: "Colores y marcas", description: "Paleta curada de Alba, Sherwin Williams, Sinteplast y Plavicon, filtrada por interior y exterior." },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
