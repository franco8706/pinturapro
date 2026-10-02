import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import "./globals.css";
import { SITE_URL, SITE_NAME, SITE_DESCRIPTION, SITE_TAGLINE } from "@/lib/site";
import { LenisProvider } from "@/components/providers/lenis-provider";
import { ScrollProgress } from "@/components/features/scroll-progress";
import { IMAGEN_TARJETA } from "@/lib/tarjeta";

// Las tipografías viven en el repo (app/fonts/, ver LEEME.md). Con `next/font/google` cada
// compilación las bajaba de Google, y el 28/9 una falló ahí sin que cambiara una línea de
// código: en Cloud Build es una versión que no sale. Mismos archivos, mismas variables CSS.
const inter = localFont({
  src: "./fonts/inter-latin.woff2",
  variable: "--font-inter",
  display: "swap",
  // Acotada a los pesos que el sitio usa (400 a 700): ver app/fonts/LEEME.md.
  weight: "400 700",
});

const spaceGrotesk = localFont({
  src: "./fonts/space-grotesk-latin.woff2",
  variable: "--font-space-grotesk",
  display: "swap",
  weight: "300 700",
});

const jetbrainsMono = localFont({
  src: "./fonts/jetbrains-mono-latin.woff2",
  variable: "--font-jetbrains-mono",
  display: "swap",
  // Un solo peso: las etiquetas monoespaciadas van siempre en 400 (tailwind.config.ts).
  weight: "400",
  // Se usa sólo en etiquetas chicas: que no compita con Inter y Space Grotesk por la red al
  // cargar la página.
  preload: false,
});

export const metadata: Metadata = {
  // metadataBase resuelve las URLs relativas de OpenGraph. Sin esto Next avisa en build
  // y las tarjetas al compartir quedan sin imagen ni canónica.
  metadataBase: new URL(SITE_URL),
  title: {
    default: `${SITE_NAME} | ${SITE_TAGLINE}`,
    // Cada página aporta su título y hereda la marca.
    template: `%s | ${SITE_NAME}`,
  },
  description: SITE_DESCRIPTION,
  applicationName: SITE_NAME,
  authors: [{ name: SITE_NAME }],
  keywords: [
    "pintores",
    "pintores independientes",
    "cotizaciones de pintura",
    "presupuesto de pintura",
    "simulador de color",
    "Buenos Aires",
  ],
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    locale: "es_AR",
    url: "/",
    siteName: SITE_NAME,
    title: `${SITE_NAME} | ${SITE_TAGLINE}`,
    description: SITE_DESCRIPTION,
    images: [IMAGEN_TARJETA],
  },
  // Sin título ni descripción A PROPÓSITO: Next los completa con los del openGraph de cada
  // página. Fijados acá, todas las páginas se compartían en X con el título de la portada.
  twitter: {
    card: "summary_large_image",
    images: [IMAGEN_TARJETA],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, "max-image-preview": "large" },
  },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  themeColor: "#EDEBE6",
  colorScheme: "light",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" className={`${inter.variable} ${spaceGrotesk.variable} ${jetbrainsMono.variable}`}>
      <body className="bg-plaster text-ink font-body antialiased">
        <ScrollProgress />
        <LenisProvider>
          {children}
        </LenisProvider>
      </body>
    </html>
  );
}
