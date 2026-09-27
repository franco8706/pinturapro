import type { Metadata } from "next";

// Client Component: el título no se puede exportar desde la página. Sin esto la pestaña
// decía "Transformamos espacios con color" — lo marcó el sub-agente visitante de
// `recorrido-web`, midiendo el <title> de cada pantalla en producción.
export const metadata: Metadata = {
  title: "Recuperar contraseña",
  description: "Te mandamos un enlace para elegir una contraseña nueva.",
  robots: { index: false, follow: false },
};

export default function RecuperarLayout({ children }: { children: React.ReactNode }) {
  return children;
}
