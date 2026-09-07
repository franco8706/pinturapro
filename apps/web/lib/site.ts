/**
 * Identidad del sitio en un solo lugar: la usan el layout (metadata/OpenGraph), robots,
 * sitemap y los links de los emails. Antes cada uno resolvía la URL a su manera.
 */

/** URL pública canónica, sin barra final. */
export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/+$/, "");

export const SITE_NAME = "Pintura Pro";

export const SITE_DESCRIPTION =
  "Pintura profesional de obra para dueños de casa, arquitectos y constructoras. Portfolio, simulador de color, presupuesto online y pintores verificados.";

/**
 * Rutas públicas indexables. Las privadas (dashboard, cliente, cotizaciones, panel, admin,
 * checkout, auth) quedan afuera a propósito: no deben aparecer en buscadores.
 */
export const PUBLIC_ROUTES = [
  { path: "/", priority: 1.0, changeFrequency: "weekly" },
  { path: "/obras", priority: 0.9, changeFrequency: "weekly" },
  { path: "/pintores", priority: 0.9, changeFrequency: "daily" },
  { path: "/simulador", priority: 0.8, changeFrequency: "monthly" },
  { path: "/colores", priority: 0.7, changeFrequency: "monthly" },
  { path: "/cotizar", priority: 0.9, changeFrequency: "monthly" },
  { path: "/mapa", priority: 0.6, changeFrequency: "weekly" },
  { path: "/aprender", priority: 0.7, changeFrequency: "weekly" },
  { path: "/novedades", priority: 0.6, changeFrequency: "weekly" },
  { path: "/asesoramiento", priority: 0.6, changeFrequency: "monthly" },
  { path: "/trabajos", priority: 0.6, changeFrequency: "daily" },
  { path: "/nosotros", priority: 0.5, changeFrequency: "yearly" },
  { path: "/contacto", priority: 0.5, changeFrequency: "yearly" },
] as const;

/** Rutas que nunca deben indexarse (sesión, paneles, flujos internos). */
export const PRIVATE_PATHS = [
  "/dashboard",
  "/cliente",
  "/cotizaciones",
  "/panel",
  "/admin",
  "/checkout",
  "/mi-panel",
  "/bienvenida",
  "/ingresar",
  "/crear-cuenta",
  "/registro",
  "/publicar",
  "/auth/",
  "/api/",
];
