import type { Metadata } from "next";
import { SITE_NAME } from "./site";

/**
 * La tarjeta que aparece al compartir un enlace (WhatsApp, Facebook, X) y los datos que Google
 * lee para la vista previa. Una sola función para todas las páginas.
 *
 * Por qué existe: Next NO combina el `openGraph` de una página con el del layout raíz — lo
 * reemplaza entero. Cada página que definía `openGraph: { title, description }` perdía el
 * nombre del sitio, el idioma, el tipo, la dirección y la imagen. Y como el layout fijaba el
 * título de la tarjeta de X, TODAS las páginas se compartían con el título de la portada.
 * Medido por el agente `buscadores` el 28/9: ninguna ficha de pintor tenía imagen al
 * compartirla, que es la página que más gente podría traer.
 */

/** Imagen por defecto (1200×630), la sirve `app/og.png/route.tsx`. */
export const IMAGEN_TARJETA = {
  url: "/og.png",
  width: 1200,
  height: 630,
  alt: "Pintura Pro — pintores independientes y clientes, en un solo lugar",
};

type Imagen = { url: string; alt?: string; width?: number; height?: number };

export function tarjeta({
  titulo,
  descripcion,
  ruta,
  tipo = "website",
  imagen,
}: {
  titulo: string;
  descripcion: string;
  /** La misma dirección que la canónica: `/pintor/<id>`, `/obras`… */
  ruta: string;
  tipo?: "website" | "article" | "profile";
  /** Foto propia de la página (portada de la obra, foto del pintor). Sin foto, la del sitio. */
  imagen?: Imagen;
}): Pick<Metadata, "openGraph" | "twitter"> {
  const imagenes = [imagen ?? IMAGEN_TARJETA];
  return {
    openGraph: {
      type: tipo,
      locale: "es_AR",
      siteName: SITE_NAME,
      url: ruta,
      title: titulo,
      description: descripcion,
      images: imagenes,
    },
    twitter: {
      card: "summary_large_image",
      title: titulo,
      description: descripcion,
      images: imagenes,
    },
  };
}
