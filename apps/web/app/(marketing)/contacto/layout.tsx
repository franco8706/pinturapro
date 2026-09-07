import type { Metadata } from "next";

// La página es un componente cliente y por eso no puede exportar `metadata`.
// Este layout existe sólo para darle título y descripción propios.
export const metadata: Metadata = {
  title: "Contacto",
  description: "Escribinos y te respondemos a la brevedad. Pintura profesional de obra en Buenos Aires.",
  alternates: { canonical: "/contacto" },
  openGraph: { title: "Contacto", description: "Escribinos y te respondemos a la brevedad. Pintura profesional de obra en Buenos Aires." },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
