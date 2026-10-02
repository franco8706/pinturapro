/**
 * Pintores: el directorio, el perfil público y el perfil propio.
 * (Parte de lib/queries: ver index.ts.)
 */
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { createPublicClient } from "@/lib/supabase/publico";
import { publico, ETIQUETAS } from "@/lib/cache-publico";
import { mockPainters, type Painter } from "@/lib/data";
import type { ProfileType } from "@/lib/supabase/types";
import { dbError, SUPA, levelFromRating, ErrorDeLecturaDeDatos } from "./base";

/**
 * Sin Supabase configurado (desarrollo local sin claves) se muestran los datos de ejemplo: es
 * lo que permite trabajar en la interfaz sin base.
 *
 * Pero si la base SÍ está configurada y la lectura falla, caer a los datos de ejemplo es otra
 * cosa: son pintores y obras INVENTADOS. En producción eso significa mostrarle a una persona
 * un profesional que no existe, con un teléfono que no es de nadie, sin decirle que la base se
 * cayó. Ahí es preferible avisar que no se pudo cargar —el error boundary de app/error.tsx ya
 * dice "fue un problema nuestro, probá de nuevo"— que inventar.
 *
 * Pintores verificados (profiles type=painter), ordenados por rating.
 */
async function leer_getPainters(): Promise<Painter[]> {
  if (!SUPA) return mockPainters;
  try {
    const supabase = createPublicClient();
    // Las coordenadas ya no están en el grant de columna de `profiles` (0013): eran la casa
    // de cada cliente, legible por cualquiera con la anon key. Se piden aparte, por una
    // función que sólo devuelve pintores.
    const [{ data, error }, geo] = await Promise.all([
      supabase
        .from("profiles")
        .select("id, full_name, avatar_url, location, verified, rating, rating_count, specialties")
        .eq("type", "painter")
        .order("rating", { ascending: false })
        .limit(60), // tope: el directorio se sirve entero a un Client Component
      supabase.rpc("pintores_geolocalizados" as never),
    ]);
    if (error || !data) {
      if (error) dbError("getPainters", error);
      throw new ErrorDeLecturaDeDatos("pintores", error?.message ?? "sin datos");
    }
    if (geo.error) dbError("getPainters/geo", geo.error); // sin coords el mapa queda vacío, el directorio no
    const coords = new Map<string, { lat: number | null; lng: number | null }>();
    for (const g of (geo.data ?? []) as unknown as { id: string; lat: number; lng: number }[]) {
      coords.set(g.id, { lat: g.lat, lng: g.lng });
    }
    const rows = data as unknown as {
      id: string;
      full_name: string | null;
      avatar_url: string | null;
      location: string | null;
      verified: boolean;
      rating: number;
      rating_count: number;
      specialties: string[] | null;
    }[];
    return rows.map((p) => ({
      id: p.id,
      name: p.full_name ?? "Pintor",
      level: levelFromRating(Number(p.rating), p.verified),
      rating: Number(p.rating),
      reviews: p.rating_count,
      specialty: p.specialties ?? [],
      zone: p.location ?? "",
      image: p.avatar_url ?? "",
      portfolio: [],
      lat: coords.get(p.id)?.lat ?? null,
      lng: coords.get(p.id)?.lng ?? null,
    }));
  } catch (e) {
    if (e instanceof ErrorDeLecturaDeDatos) throw e;
    dbError("getPainters", e);
    throw new ErrorDeLecturaDeDatos("pintores", String(e));
  }
}

export const getPainters = publico(leer_getPainters, "getPainters", [ETIQUETAS.pintores]);

export interface PainterDetail extends Painter {
  bio: string;
}

/** Un pintor por id (perfil público). */
/** `cache()` por lo mismo que getProjectBySlug: metadata + cuerpo pedían el mismo pintor. */
const ES_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const getPainterById = cache(
  publico(async (id: string): Promise<PainterDetail | null> => {
  if (!SUPA) {
    const m = mockPainters.find((p) => p.id === id);
    return m ? { ...m, bio: "" } : null;
  }
  // Un id que no tiene forma de uuid no puede existir: se contesta 404 sin molestar a la base.
  // Antes se consultaba igual y Postgres devolvía `invalid input syntax for type uuid`, que
  // quedaba escrito en la consola del navegador —estructura interna a la vista— y encima
  // gastaba una consulta por cada URL inventada que alguien probara.
  if (!ES_UUID.test(id)) return null;
  try {
    const supabase = createPublicClient();
    const { data, error } = await supabase
      .from("profiles")
      .select("id, full_name, avatar_url, location, bio, verified, rating, rating_count, specialties")
      .eq("id", id)
      .in("type", ["painter", "company"])
      .maybeSingle();
    // Igual que con las obras: "no existe" (404) y "no se pudo leer" no son lo mismo.
    if (error) {
      dbError("getPainterById", error);
      throw new ErrorDeLecturaDeDatos("el pintor", error.message ?? "error de la base");
    }
    if (!data) return null;
    const p = data as unknown as {
      id: string;
      full_name: string | null;
      avatar_url: string | null;
      location: string | null;
      bio: string | null;
      verified: boolean;
      rating: number;
      rating_count: number;
      specialties: string[] | null;
    };
    return {
      id: p.id,
      name: p.full_name ?? "Pintor",
      level: levelFromRating(Number(p.rating), p.verified),
      rating: Number(p.rating),
      reviews: p.rating_count,
      specialty: p.specialties ?? [],
      zone: p.location ?? "",
      image: p.avatar_url ?? "",
      portfolio: [],
      bio: p.bio ?? "",
    };
  } catch (e) {
    if (e instanceof ErrorDeLecturaDeDatos) throw e;
    dbError("getPainterById", e);
    throw new ErrorDeLecturaDeDatos("el pintor", String(e));
  }
  }, "getPainterById", [ETIQUETAS.pintores]),
);

export interface OwnProfile {
  id: string;
  type: ProfileType;
  /** false = llegó por OAuth y todavía no eligió rol (va a /bienvenida). */
  onboarded: boolean;
  /** Acceso al panel de administración. Nada que ver con type='company': ese es un rol
   *  de negocio que cualquiera elige al registrarse. Este flag sólo se activa por SQL. */
  isAdmin: boolean;
  name: string;
  image: string;
  verified: boolean;
  rating: number;
  ratingCount: number;
  level: Painter["level"];
  bio: string;
  specialty: string[];
  zone: string;
}

/**
 * El perfil no se pudo LEER (permisos, red, base caída). Distinto de "no hay perfil".
 *
 * Existe porque confundir las dos cosas hacía daño real: cuando `profiles` no se podía leer,
 * `getOwnProfile` devolvía `null` igual que si la fila no existiera, y las cuatro páginas que
 * hacen `if (!profile || !profile.onboarded) redirect("/bienvenida")` mandaban a elegir rol a
 * gente que ya lo tenía elegido, sin decirle nada. Pasó de verdad: la migración 0008 agregó
 * `profiles.is_admin` sin sumarla al grant por columna de 0006, y todo usuario logueado
 * quedó rebotando a /bienvenida. El propio 0006 avisa que esto se repite con cada columna
 * nueva, así que el modo de falla necesita ser ruidoso, no silencioso.
 */
export class ErrorDeLecturaDePerfil extends Error {
  constructor(causa: string) {
    super(`No se pudo leer el perfil: ${causa}`);
    this.name = "ErrorDeLecturaDePerfil";
  }
}

/**
 * Perfil de la cuenta logueada, sin filtrar por tipo (sirve para rutear al panel correcto).
 *
 * Devuelve `null` SÓLO si la cuenta todavía no tiene fila en `profiles` (alta a medias).
 * Si la lectura falla, tira `ErrorDeLecturaDePerfil` y la ataja `app/error.tsx`: es preferible
 * decir "algo se rompió" que rutear a la persona a un lugar equivocado como si fuera normal.
 */
export async function getOwnProfile(id: string): Promise<OwnProfile | null> {
  if (!SUPA) return null;
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("profiles")
      .select("id, type, onboarded, full_name, avatar_url, location, bio, verified, rating, rating_count, specialties")
      .eq("id", id)
      .maybeSingle();
    // `is_admin` ya no se lee como columna: desde 0023 la columna no se le entrega a nadie.
    // Era legible SIN CUENTA (0010 la había abierto para que las policies de `leads` pudieran
    // consultarla), y `profiles?is_admin=eq.true` devolvía, en un solo pedido, cuál es la única
    // cuenta con máximo privilegio de la plataforma: reconocimiento gratis para un phishing
    // dirigido. Lo midió el agente `seguridad-rls`. `es_admin()` sólo contesta sobre quien
    // pregunta, y falla cerrado: sin la función, nadie es admin.
    const { data: esAdmin } = await supabase.rpc("es_admin");
    if (error) {
      dbError("getOwnProfile", error);
      throw new ErrorDeLecturaDePerfil(error.message ?? "error de la base");
    }
    // Sin error y sin fila: la cuenta existe en auth pero no en profiles. El llamador la
    // manda a /bienvenida, que es exactamente lo que corresponde.
    if (!data) return null;
    const p = data as unknown as {
      id: string;
      type: ProfileType;
      onboarded: boolean | null;
      full_name: string | null;
      avatar_url: string | null;
      location: string | null;
      bio: string | null;
      verified: boolean;
      rating: number;
      rating_count: number;
      specialties: string[] | null;
    };
    return {
      id: p.id,
      type: p.type,
      // Si la columna todavía no existe (migración 0003 sin correr) asumimos onboarded:
      // es preferible dejar entrar que trabar a todos en /bienvenida.
      onboarded: p.onboarded ?? true,
      // Falla CERRADO, al revés que onboarded: es un privilegio, no un paso de alta.
      isAdmin: esAdmin === true,
      name: p.full_name ?? "",
      image: p.avatar_url ?? "",
      verified: p.verified,
      rating: Number(p.rating),
      ratingCount: p.rating_count,
      level: levelFromRating(Number(p.rating), p.verified),
      bio: p.bio ?? "",
      specialty: p.specialties ?? [],
      zone: p.location ?? "",
    };
  } catch (e) {
    // Sin esto el catch se tragaba la excepción de arriba y la volvía a convertir en null,
    // que es justo el comportamiento que este cambio viene a sacar.
    if (e instanceof ErrorDeLecturaDePerfil) throw e;
    dbError("getOwnProfile", e);
    throw new ErrorDeLecturaDePerfil(e instanceof Error ? e.message : String(e));
  }
}

/** Puntos a favor / a considerar del pintor. Fail-safe si las columnas no existen aún. */
async function leer_getPainterExtras(id: string): Promise<{ pros: string[]; cons: string[] }> {
  if (!SUPA) return { pros: [], cons: [] };
  try {
    const supabase = createPublicClient();
    const { data, error } = await supabase.from("profiles").select("pros, cons").eq("id", id).maybeSingle();
    if (error || !data) {
      if (error) dbError("getPainterExtras", error);
      return { pros: [], cons: [] };
    }
    const p = data as unknown as { pros: string[] | null; cons: string[] | null };
    return { pros: p.pros ?? [], cons: p.cons ?? [] };
  } catch (e) {
    dbError("getPainterExtras", e);
    return { pros: [], cons: [] };
  }
}

export const getPainterExtras = publico(leer_getPainterExtras, "getPainterExtras", [ETIQUETAS.pintores]);
