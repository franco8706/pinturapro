/**
 * Catálogo de colores por marca.
 *
 * ⚠️ FUENTE DE DATOS: los sitios oficiales (Alba, Sherwin, Sinteplast, Plavicon)
 * NO exponen sus cartas de color en HTML — las renderan con apps JS internas.
 * Por eso esta data es **curada**: nombres/códigos reales y hex fieles/aproximados.
 * Para reemplazarla por datos oficiales ver `scripts/scrape-brands.mjs`.
 *
 * `usage` indica si el color/línea aplica a interior, exterior o ambos, para
 * poder filtrar según lo que el cliente quiera pintar.
 */

export type Usage = "interior" | "exterior" | "ambos";

export interface BrandColor {
  /** Nombre comercial del color */
  name: string;
  /** Código de la marca, si aplica */
  code?: string;
  /** Hex aproximado para previsualización */
  hex: string;
  /** Línea / producto */
  line: string;
  usage: Usage;
}

export interface Brand {
  id: string;
  name: string;
  /** Color de acento de la marca (para la UI) */
  accent: string;
  description: string;
  colors: BrandColor[];
}

export const brands: Brand[] = [
  {
    id: "alba",
    name: "Alba",
    accent: "#E2001A",
    description: "Marca líder en Argentina. Líneas Albalatex (interior) y Albamur (exterior).",
    colors: [
      { name: "Blanco Puro", code: "AL-100", hex: "#FAFAF7", line: "Albalatex", usage: "interior" },
      { name: "Marfil", code: "AL-110", hex: "#F1E9D2", line: "Albalatex", usage: "interior" },
      { name: "Arena", code: "AL-120", hex: "#D8C6A3", line: "Albalatex", usage: "interior" },
      { name: "Gris Perla", code: "AL-210", hex: "#C9C9C4", line: "Albalatex", usage: "ambos" },
      { name: "Verde Agua", code: "AL-330", hex: "#A8C7BB", line: "Albalatex", usage: "interior" },
      { name: "Celeste Cielo", code: "AL-410", hex: "#A9C6DC", line: "Albalatex", usage: "interior" },
      { name: "Terracota", code: "AL-520", hex: "#B5623F", line: "Albamur", usage: "exterior" },
      { name: "Ocre Toscana", code: "AL-530", hex: "#C68A3E", line: "Albamur", usage: "exterior" },
      { name: "Gris Cemento", code: "AL-240", hex: "#8A8A86", line: "Albamur", usage: "exterior" },
      { name: "Verde Inglés", code: "AL-360", hex: "#2F5D50", line: "Albamur", usage: "exterior" },
      { name: "Azul Profundo", code: "AL-450", hex: "#28415F", line: "Albalatex", usage: "ambos" },
      { name: "Negro Mate", code: "AL-900", hex: "#1C1C1A", line: "Albalatex", usage: "ambos" },
    ],
  },
  {
    id: "sherwin-williams",
    name: "Sherwin Williams",
    accent: "#0046AD",
    description: "Catálogo internacional. Líneas Loxon (exterior) y Kem (interior).",
    colors: [
      { name: "Pure White", code: "SW 7005", hex: "#EDECE6", line: "Kem Interior", usage: "interior" },
      { name: "Agreeable Gray", code: "SW 7029", hex: "#D1CBBF", line: "Kem Interior", usage: "interior" },
      { name: "Sea Salt", code: "SW 6204", hex: "#CBD3C7", line: "Kem Interior", usage: "interior" },
      { name: "Naval", code: "SW 6244", hex: "#2C3B4D", line: "Kem Interior", usage: "ambos" },
      { name: "Tricorn Black", code: "SW 6258", hex: "#2A2A2C", line: "Kem Interior", usage: "ambos" },
      { name: "Accessible Beige", code: "SW 7036", hex: "#D2C4AC", line: "Kem Interior", usage: "interior" },
      { name: "Rosemary", code: "SW 6187", hex: "#5C6453", line: "Loxon Exterior", usage: "exterior" },
      { name: "Cyberspace", code: "SW 7076", hex: "#4A4F54", line: "Loxon Exterior", usage: "exterior" },
      { name: "Roycroft Copper", code: "SW 2839", hex: "#9C5B3F", line: "Loxon Exterior", usage: "exterior" },
      { name: "Iron Ore", code: "SW 7069", hex: "#3B3A36", line: "Loxon Exterior", usage: "exterior" },
      { name: "Repose Gray", code: "SW 7015", hex: "#C9C5BC", line: "Kem Interior", usage: "ambos" },
      { name: "Alabaster", code: "SW 7008", hex: "#EDEAE0", line: "Kem Interior", usage: "interior" },
    ],
  },
  {
    id: "sinteplast",
    name: "Sinteplast",
    accent: "#009640",
    description: "Línea Recuplast (interior/exterior) y Latex Multiuso.",
    colors: [
      { name: "Blanco", code: "RC-01", hex: "#F7F6F1", line: "Recuplast Interior", usage: "interior" },
      { name: "Lino", code: "RC-08", hex: "#E5DAC4", line: "Recuplast Interior", usage: "interior" },
      { name: "Durazno", code: "RC-22", hex: "#EBC2A0", line: "Recuplast Interior", usage: "interior" },
      { name: "Verde Manzana", code: "RC-34", hex: "#9FB86B", line: "Recuplast Interior", usage: "interior" },
      { name: "Gris Topo", code: "RC-41", hex: "#9A9387", line: "Recuplast Interior", usage: "ambos" },
      { name: "Celeste", code: "RC-48", hex: "#9EC1D4", line: "Recuplast Interior", usage: "interior" },
      { name: "Tierra Siena", code: "RC-55", hex: "#A85E3C", line: "Recuplast Frentes", usage: "exterior" },
      { name: "Amarillo Colonial", code: "RC-61", hex: "#D9A441", line: "Recuplast Frentes", usage: "exterior" },
      { name: "Gris Grafito", code: "RC-72", hex: "#54534F", line: "Recuplast Frentes", usage: "exterior" },
      { name: "Verde Patagonia", code: "RC-38", hex: "#37574A", line: "Recuplast Frentes", usage: "exterior" },
      { name: "Borravino", code: "RC-66", hex: "#6E2F33", line: "Recuplast Frentes", usage: "exterior" },
      { name: "Negro", code: "RC-90", hex: "#201F1D", line: "Recuplast Interior", usage: "ambos" },
    ],
  },
  {
    id: "plavicon",
    name: "Plavicon",
    accent: "#F39200",
    description: "Especialistas en látex e impermeabilizantes para frentes y membranas.",
    colors: [
      { name: "Blanco Mate", code: "PL-W1", hex: "#F5F4EF", line: "Látex Interior", usage: "interior" },
      { name: "Hueso", code: "PL-W3", hex: "#E9E1CF", line: "Látex Interior", usage: "interior" },
      { name: "Beige Pampa", code: "PL-B2", hex: "#D6C4A0", line: "Látex Interior", usage: "interior" },
      { name: "Gris Plata", code: "PL-G2", hex: "#BFBFBA", line: "Látex Interior", usage: "ambos" },
      { name: "Verde Salvia", code: "PL-V4", hex: "#8FA585", line: "Látex Interior", usage: "interior" },
      { name: "Celeste Sereno", code: "PL-C3", hex: "#A7C3D2", line: "Látex Interior", usage: "interior" },
      { name: "Rojo Teja", code: "PL-R5", hex: "#A24B33", line: "Impermeabilizante Frente", usage: "exterior" },
      { name: "Terracota Sol", code: "PL-T2", hex: "#BC6E45", line: "Impermeabilizante Frente", usage: "exterior" },
      { name: "Gris Membrana", code: "PL-G6", hex: "#6B6A66", line: "Membrana Pasiva", usage: "exterior" },
      { name: "Verde Bosque", code: "PL-V8", hex: "#33503F", line: "Impermeabilizante Frente", usage: "exterior" },
      { name: "Azul Marino", code: "PL-A7", hex: "#27374D", line: "Látex Interior", usage: "ambos" },
      { name: "Grafito", code: "PL-N9", hex: "#2B2B29", line: "Impermeabilizante Frente", usage: "ambos" },
    ],
  },
];

/** Devuelve los colores de una marca filtrados por uso (interior/exterior). */
export function colorsByUsage(brand: Brand, target: "interior" | "exterior"): BrandColor[] {
  return brand.colors.filter((c) => c.usage === target || c.usage === "ambos");
}

/** Aplana todos los colores de todas las marcas (para búsqueda global). */
export function allColors(): (BrandColor & { brandId: string; brandName: string })[] {
  return brands.flatMap((b) => b.colors.map((c) => ({ ...c, brandId: b.id, brandName: b.name })));
}

export function getBrand(id: string): Brand | undefined {
  return brands.find((b) => b.id === id);
}
