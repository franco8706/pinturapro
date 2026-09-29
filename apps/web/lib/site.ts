/**
 * Identidad del sitio en un solo lugar: la usan el layout (metadata/OpenGraph), robots,
 * sitemap y los links de los emails. Antes cada uno resolvía la URL a su manera.
 */

/** URL pública canónica, sin barra final. */
export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/+$/, "");

export const SITE_NAME = "Pintura Pro";

/**
 * Lo que Google muestra debajo del título y lo que aparece al compartir un enlace por
 * WhatsApp. Decía "pintores verificados" —la frase que ya se había sacado de /pintores por
 * falsa: `profiles.verified` no lo escribe ningún código— y describía una empresa de pintura
 * de obra. Pintura Pro es un marketplace puro (decisión del dueño, 27/9/2026). Lo encontró el
 * agente `contenido-confianza`.
 */
export const SITE_DESCRIPTION =
  "Publicá lo que necesitás pintar y recibí cotizaciones de pintores independientes. Compará precios, trabajos anteriores y reseñas de clientes reales. Publicar es gratis.";

/** Lo que acompaña al nombre en el título por defecto (la portada). */
export const SITE_TAGLINE = "Encontrá pintor y compará cotizaciones";

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
  { path: "/mapa", priority: 0.6, changeFrequency: "weekly" },
  { path: "/aprender", priority: 0.7, changeFrequency: "weekly" },
  { path: "/novedades", priority: 0.6, changeFrequency: "weekly" },
  { path: "/asesoramiento", priority: 0.6, changeFrequency: "monthly" },
  { path: "/nosotros", priority: 0.5, changeFrequency: "yearly" },
  { path: "/contacto", priority: 0.5, changeFrequency: "yearly" },
  // Prioridad baja pero indexables a propósito: Facebook y Google verifican que la URL de
  // la política de privacidad sea pública y accesible antes de aprobar la app OAuth.
  { path: "/privacidad", priority: 0.3, changeFrequency: "yearly" },
  { path: "/terminos", priority: 0.3, changeFrequency: "yearly" },
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
  // Recuperar y cambiar la contraseña son de la misma familia que /ingresar: no tienen
  // nada que buscar un buscador, y la de cambio llega con un token en la dirección.
  "/recuperar",
  "/nueva-contrasena",
  // Pantallas de la cuenta: ni se buscan ni tienen sentido en un resultado de Google.
  "/mi-cuenta",
  "/cuenta-eliminada",
  "/auth/",
  "/api/",
];
