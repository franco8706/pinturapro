import type { MetadataRoute } from "next";
import { SITE_URL, PRIVATE_PATHS } from "@/lib/site";

/**
 * robots.txt generado. Sin esto los buscadores indexan también /dashboard, /cliente,
 * /cotizaciones y /checkout — paneles privados que no deberían aparecer en Google.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: PRIVATE_PATHS,
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
