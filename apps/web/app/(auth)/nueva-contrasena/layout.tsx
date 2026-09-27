import type { Metadata } from "next";

// Client Component: el título no se puede exportar desde la página. Sin esto la pestaña
// decía "Transformamos espacios con color" — lo marcó el sub-agente visitante de
// `recorrido-web`, midiendo el <title> de cada pantalla en producción.
export const metadata: Metadata = {
  title: "Nueva contraseña",
  description: "Elegí una contraseña nueva para tu cuenta.",
  robots: { index: false, follow: false },
};

export default function NuevaContrasenaLayout({ children }: { children: React.ReactNode }) {
  return children;
}
