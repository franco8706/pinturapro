import type { Metadata } from "next";

// El título vive acá y no en la página porque `/ingresar` es un Client Component, y desde
// uno no se puede exportar `metadata`. Antes el título lo fijaba el layout del grupo (auth),
// así que /crear-cuenta heredaba "Ingresar" y la pestaña decía lo contrario de la pantalla.
export const metadata: Metadata = {
  title: "Ingresar",
  description: "Entrá a tu cuenta de Pintura Pro.",
};

export default function IngresarLayout({ children }: { children: React.ReactNode }) {
  return children;
}
