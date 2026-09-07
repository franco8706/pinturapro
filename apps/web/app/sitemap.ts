import type { MetadataRoute } from "next";
import { SITE_URL, PUBLIC_ROUTES } from "@/lib/site";
import { getProjects, getPainters } from "@/lib/queries";

// El sitemap se regenera cada hora: las obras y los pintores cambian, pero no tanto
// como para reconsultar la base en cada visita de un crawler.
export const revalidate = 3600;

/**
 * Sitemap con las rutas públicas fijas más las dinámicas (obras y perfiles de pintor).
 *
 * Las dinámicas son best-effort a propósito: si Supabase no responde, `getProjects` y
 * `getPainters` caen a los mocks, y publicar URLs inventadas sería peor que no publicar
 * ninguna. Por eso se descarta lo que no parezca real.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const estaticas: MetadataRoute.Sitemap = PUBLIC_ROUTES.map((r) => ({
    url: `${SITE_URL}${r.path}`,
    changeFrequency: r.changeFrequency,
    priority: r.priority,
  }));

  const dinamicas: MetadataRoute.Sitemap = [];

  try {
    const obras = await getProjects();
    for (const o of obras) {
      // Los mocks de lib/data.ts usan slugs de ejemplo; sólo publicamos lo que parece real.
      if (o.slug && !o.slug.startsWith("demo-")) {
        dinamicas.push({ url: `${SITE_URL}/obras/${o.slug}`, changeFrequency: "monthly", priority: 0.7 });
      }
    }
  } catch {
    // Sin obras en el sitemap es preferible a un sitemap con URLs que dan 404.
  }

  try {
    const pintores = await getPainters();
    for (const p of pintores) {
      // Los ids de los mocks son "p1", "p2"...; los reales son UUID.
      if (p.id && p.id.length > 10) {
        dinamicas.push({ url: `${SITE_URL}/pintor/${p.id}`, changeFrequency: "weekly", priority: 0.6 });
      }
    }
  } catch {
    // idem
  }

  return [...estaticas, ...dinamicas];
}
