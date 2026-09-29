import type { Metadata, Viewport } from "next";
import { Inter, Space_Grotesk, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { SITE_URL, SITE_NAME, SITE_DESCRIPTION, SITE_TAGLINE } from "@/lib/site";
import { LenisProvider } from "@/components/providers/lenis-provider";
import { ScrollProgress } from "@/components/features/scroll-progress";
import { IMAGEN_TARJETA } from "@/lib/tarjeta";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-space-grotesk",
  display: "swap",
  weight: ["400", "500", "700"],
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jetbrains-mono",
  display: "swap",
  weight: ["400", "500"],
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
