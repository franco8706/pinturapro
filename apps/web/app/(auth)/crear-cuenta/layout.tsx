import type { Metadata } from "next";

// Ver la nota en ingresar/layout.tsx: la página es un Client Component y el título del grupo
// la pisaba con "Ingresar".
export const metadata: Metadata = {
  title: "Crear cuenta",
  description: "Creá tu cuenta de Pintura Pro como cliente o como pintor profesional.",
};

export default function CrearCuentaLayout({ children }: { children: React.ReactNode }) {
  return children;
}
