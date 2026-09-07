import type { Metadata } from "next";

// La página es un componente cliente y por eso no puede exportar `metadata`.
// Este layout existe sólo para darle título y descripción propios.
export const metadata: Metadata = {
  title: "Pedir presupuesto",
  description: "Tu presupuesto de pintura en 4 pasos. Contanos qué necesitás y te respondemos en menos de 24 horas.",
  alternates: { canonical: "/cotizar" },
  openGraph: { title: "Pedir presupuesto", description: "Tu presupuesto de pintura en 4 pasos. Contanos qué necesitás y te respondemos en menos de 24 horas." },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
