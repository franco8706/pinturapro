/**
 * Lo común a todas las lecturas: cómo se registra un fallo de la base, qué se muestra cuando una
 * cuenta se dio de baja, y los formatos (precio, fecha, nivel, color).
 * (Parte de lib/queries: ver index.ts.)
 */
import { unstable_rethrow } from "next/navigation";
import type { Painter } from "@/lib/data";

/**
 * Un fallo de base no puede ser invisible.
 *
 * Antes cada catch de este archivo estaba vacío y varias funciones caían a los mocks sin
 * registrar nada. Con el proyecto de Supabase caído, el sitio devolvía 200 y mostraba
 * pintores de mentira: no había forma de enterarse de que la base no respondía.
 */
export function dbError(fn: string, e: unknown): void {
  // Next señaliza con excepciones: redirect(), notFound(), la detección de render dinámico.
  // Los catch de este archivo se las estaban tragando. `unstable_rethrow` las relanza todas
  // —incluso envueltas en `cause`— y es la lista que mantiene Next, no una nuestra a mano:
  // la versión anterior chequeaba "NEXT_NOT_FOUND", un digest que ya no existe en Next 15.5.
  unstable_rethrow(e);

  // Los errores de PostgREST no son `Error`: son objetos { message, code, details, hint }.
  // Sin este desarmado el log terminaba siendo "[object Object]", que no sirve para nada.
  // `details` trae el stack completo en varias líneas; nos quedamos con la causa raíz
  // (la línea "Caused by:") para que el log sea una sola línea y siga siendo accionable.
  const firstLine = (v: unknown) => String(v).split("\n").find((l) => l.trim()) ?? "";
  const cause = (v: unknown) =>
    String(v)
      .split("\n")
      .map((l) => l.trim())
      .find((l) => l.startsWith("Caused by:"));

  let msg: string;
  if (e instanceof Error) {
    msg = e.message;
  } else if (e && typeof e === "object") {
    const o = e as { message?: unknown; code?: unknown; details?: unknown };
    const parts = [
      o.message ? firstLine(o.message) : "",
      o.code ? `code=${o.code}` : "",
      o.details ? cause(o.details) ?? "" : "",
    ].filter(Boolean);
    msg = [...new Set(parts)].join(" · ") || JSON.stringify(e);
  } else {
    msg = String(e);
  }
  console.error(`[db] ${fn} falló: ${msg}`);
}

/**
 * Lo que se muestra donde había un nombre y la persona se dio de baja.
 *
 * El trabajo y la reseña sobreviven a la baja de la otra parte (migración 0019) porque son
 * también el registro de trabajo y la reputación de alguien más. Sin este texto, el fallback
 * decía "Cliente", que da a entender que hay una persona ahí.
 */
export const BAJA = "Cuenta dada de baja";

// Sin Supabase configurado (desarrollo local sin claves) se usan los datos de ejemplo.
// Si la base ESTÁ configurada y falla, ver la nota sobre getPainters: se avisa, no se inventa.
export const SUPA = !!process.env.NEXT_PUBLIC_SUPABASE_URL;

export function levelFromRating(rating: number, verified: boolean): Painter["level"] {
  if (rating >= 4.8 && verified) return "Master";
  if (rating >= 4.5) return "Gold";
  return "Silver";
}

// Color de acento estable por proyecto (la BD todavía no guarda accent_color).
const PALETTE = ["#C41E3A", "#1E3A8A", "#2D5A3D", "#B45309", "#3F3F46", "#0F766E"];

export function colorFor(seed: string): string {
  let h = 0;
  for (const ch of seed) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return PALETTE[h % PALETTE.length];
}

/**
 * Datos PROPIOS de un panel que no se pudieron LEER (permisos, red, base caída).
 * Distinto de "todavía no tenés nada".
 *
 * Es el mismo razonamiento de `ErrorDeLecturaDePerfil` (ver más abajo), aplicado a las listas
 * de los paneles privados. Confundir las dos cosas ya hizo daño: con la base ARRIBA pero
 * `jobs` sin grant, /dashboard devolvía 200 y le decía "Trabajos completados: 0 · Todavía no
 * tenés trabajos" a un pintor con nueve trabajos terminados, mientras el portfolio y las
 * reseñas cargaban al lado como si nada. Ni el pintor ni nosotros nos enterábamos. Una lista
 * vacía es una respuesta; una lectura que falla tiene que verse.
 *
 * Sólo para los paneles privados, donde la persona mira SUS datos. Las páginas públicas
 * (directorio, obras, faqs, novedades, recursos) siguen cayendo a mocks a propósito: ahí
 * mostrar algo es mejor que romper la página.
 */
export class ErrorDeLecturaDeDatos extends Error {
  constructor(fuente: string, causa: string) {
    super(`No se pudieron leer los datos (${fuente}): ${causa}`);
    this.name = "ErrorDeLecturaDeDatos";
  }
}

/** Los errores de PostgREST no son `Error`, son objetos `{ message, code, details, hint }`. */
function causaDe(e: unknown): string {
  if (e instanceof Error) return e.message;
  if (e && typeof e === "object" && "message" in e) return String((e as { message?: unknown }).message);
  return String(e);
}

/**
 * Convierte un fallo de lectura de panel en excepción que llega a `app/error.tsx`.
 *
 * El orden no es casual: `dbError` arranca con `unstable_rethrow`, que relanza las señales de
 * control de Next (redirect, notFound, render dinámico). Si tiráramos lo nuestro antes, una
 * redirección perfectamente normal se mostraría como "algo se rompió".
 *
 * Devuelve `never`, así el llamador no necesita un `return` muerto detrás.
 */
export function errorDeLectura(fuente: string, e: unknown): never {
  dbError(fuente, e);
  throw new ErrorDeLecturaDeDatos(fuente, causaDe(e));
}

const MESES = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];

export function monthYear(iso: string): string {
  const d = new Date(iso);
  return `${MESES[d.getMonth()]} ${d.getFullYear()}`;
}

export function formatARS(n: number | null): string {
  if (n == null) return "—";
  return new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 }).format(n);
}
