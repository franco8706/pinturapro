/**
 * Pedidos, cotizaciones y trabajos: lo que ve el cliente, lo que ve el pintor y el tablero.
 * (Parte de lib/queries: ver index.ts.)
 */
import { createClient } from "@/lib/supabase/server";
import type { Painter } from "@/lib/data";
import { dbError, BAJA, SUPA, levelFromRating, ErrorDeLecturaDeDatos, errorDeLectura, monthYear } from "./base";

export interface ClientJobView {
  id: string;
  status: string;
  statusLabel: string;
  amount: number | null;
  painter: string | null;
  painterId: string | null;
  project: string | null;
  reviewed: boolean;
}

/** Trabajos del cliente, con el pintor y la obra resueltos (respeta RLS con sesión). */
export async function getJobsForClient(clientId: string): Promise<ClientJobView[]> {
  if (!SUPA) return [];
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("jobs")
      .select("id, status, amount, painter_id, project_id, created_at")
      .eq("client_id", clientId)
      .order("created_at", { ascending: false })
      .limit(50); // tope: los ids alimentan .in() derivados
    // Falló la lectura: es distinto de "no hay filas" y no se puede mostrar como si fuera lo mismo.
    if (error) errorDeLectura("getJobsForClient", error);
    // Sin error y sin filas: el cliente genuinamente no pidió ningún trabajo todavía.
    if (!data) return [];
    const rows = data as unknown as {
      id: string;
      status: string;
      amount: number | null;
      painter_id: string | null;
      project_id: string | null;
    }[];
    const painterIds = [...new Set(rows.map((r) => r.painter_id).filter(Boolean))] as string[];
    const projectIds = [...new Set(rows.map((r) => r.project_id).filter(Boolean))] as string[];
    const jobIds = rows.map((r) => r.id);

    // Las tres consultas derivadas dependen sólo de `rows`, no entre sí: iban encadenadas
    // con await y pagaban 4 idas y vueltas donde alcanzan 2.
    const [ps, pr, rv] = await Promise.all([
      painterIds.length
        ? supabase.from("profiles").select("id, full_name").in("id", painterIds)
        : Promise.resolve({ data: [], error: null }),
      projectIds.length
        ? supabase.from("projects").select("id, title").in("id", projectIds)
        : Promise.resolve({ data: [], error: null }),
      jobIds.length
        ? supabase.from("reviews").select("job_id").eq("author_id", clientId).in("job_id", jobIds)
        : Promise.resolve({ data: [], error: null }),
    ]);

    const names = new Map<string, string>();
    for (const p of (ps.data ?? []) as unknown as { id: string; full_name: string | null }[])
      names.set(p.id, p.full_name ?? "Pintor");

    const titles = new Map<string, string>();
    for (const p of (pr.data ?? []) as unknown as { id: string; title: string }[]) titles.set(p.id, p.title);

    // Qué trabajos ya tienen reseña de este cliente (para no ofrecer reseñar dos veces).
    const reviewed = new Set<string>();
    for (const r of (rv.data ?? []) as unknown as { job_id: string }[]) reviewed.add(r.job_id);
    return rows.map((r) => ({
      id: r.id,
      status: r.status,
      statusLabel: JOB_STATUS_LABEL[r.status] ?? r.status,
      amount: r.amount,
      // `null` significa "todavía nadie", y se muestra como "Esperando pintor". Pero un
      // trabajo YA adjudicado cuyo pintor se dio de baja también llegaba con null, así que
      // una tarjeta podía decir "Completado" y "Esperando pintor" al mismo tiempo. Son dos
      // situaciones distintas y tienen que verse distinto.
      painter: r.painter_id
        ? names.get(r.painter_id) ?? "Pintor"
        : r.status === "quoted"
          ? null
          : BAJA,
      painterId: r.painter_id,
      project: r.project_id ? titles.get(r.project_id) ?? null : null,
      reviewed: reviewed.has(r.id),
    }));
  } catch (e) {
    // Sin esto, el catch se tragaría la excepción de arriba y la volvería a convertir en la
    // lista vacía, que es justo el comportamiento que este cambio viene a sacar.
    if (e instanceof ErrorDeLecturaDeDatos) throw e;
    errorDeLectura("getJobsForClient", e);
  }
}

export interface JobView {
  id: string;
  status: string;
  statusLabel: string;
  amount: number | null;
  client: string;
  project: string | null;
}

const JOB_STATUS_LABEL: Record<string, string> = {
  draft: "Borrador",
  published: "Publicado",
  quoted: "Cotizado",
  accepted: "Aceptado",
  in_progress: "En curso",
  completed: "Completado",
  cancelled: "Cancelado",
};

/** Trabajos donde el pintor participa, con cliente y obra resueltos (respeta RLS con sesión). */
export async function getJobsForPainter(painterId: string): Promise<JobView[]> {
  if (!SUPA) return [];
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("jobs")
      .select("id, status, amount, client_id, project_id, created_at")
      .eq("painter_id", painterId)
      .order("created_at", { ascending: false })
      .limit(50); // tope: los ids alimentan .in() derivados
    // Falló la lectura: es distinto de "no hay filas" y no se puede mostrar como si fuera lo mismo.
    if (error) errorDeLectura("getJobsForPainter", error);
    // Sin error y sin filas: el pintor genuinamente no tiene trabajos todavía.
    if (!data) return [];
    const rows = data as unknown as {
      id: string;
      status: string;
      amount: number | null;
      client_id: string;
      project_id: string | null;
    }[];
    // Igual que con las reseñas: `client_id` en NULL es un cliente dado de baja.
    const clientIds = [...new Set(rows.map((r) => r.client_id).filter(Boolean))] as string[];
    const projectIds = [...new Set(rows.map((r) => r.project_id).filter(Boolean))] as string[];
    const names = new Map<string, string>();
    const titles = new Map<string, string>();
    if (clientIds.length) {
      const { data: cs } = await supabase.from("profiles").select("id, full_name").in("id", clientIds);
      for (const c of (cs ?? []) as unknown as { id: string; full_name: string | null }[])
        names.set(c.id, c.full_name ?? "Cliente");
    }
    if (projectIds.length) {
      const { data: ps } = await supabase.from("projects").select("id, title").in("id", projectIds);
      for (const p of (ps ?? []) as unknown as { id: string; title: string }[]) titles.set(p.id, p.title);
    }
    return rows.map((r) => ({
      id: r.id,
      status: r.status,
      statusLabel: JOB_STATUS_LABEL[r.status] ?? r.status,
      amount: r.amount,
      client: r.client_id ? names.get(r.client_id) ?? "Cliente" : BAJA,
      project: r.project_id ? titles.get(r.project_id) ?? null : null,
    }));
  } catch (e) {
    // Sin esto, el catch se tragaría la excepción de arriba y la volvería a convertir en la
    // lista vacía, que es justo el comportamiento que este cambio viene a sacar.
    if (e instanceof ErrorDeLecturaDeDatos) throw e;
    errorDeLectura("getJobsForPainter", e);
  }
}

// ───────────────────────── Marketplace ─────────────────────────

export interface ServiceRequest {
  id: string;
  title: string;
  description: string;
  location: string;
  budgetMin: number | null;
  budgetMax: number | null;
  ownerId: string;
  ownerName: string;
  date: string;
}

/** Pedidos de trabajo abiertos (projects type=service, published) para que los pintores coticen. */
export async function getOpenServiceRequests(): Promise<ServiceRequest[]> {
  if (!SUPA) return [];
  try {
    const supabase = await createClient();
    // Va por `pedidos_abiertos` (0014) y no por un select a `projects`: filtrar sólo por
    // `published` dejaba en el tablero pedidos ya terminados cada vez que esa columna quedaba
    // desincronizada. El seed, por ejemplo, inserta jobs directamente en 'completed', y como
    // el trigger que cierra el pedido es AFTER UPDATE, para esas filas nunca corrió.
    const { data, error } = await supabase.rpc("pedidos_abiertos", { limite: 50 } as never);
    if (error || !data) {
      if (error) dbError("getOpenServiceRequests", error);
      return [];
    }
    const rows = data as unknown as {
      id: string;
      title: string;
      description: string | null;
      location: string | null;
      budget_min: number | null;
      budget_max: number | null;
      owner_id: string;
      created_at: string;
    }[];
    const ownerIds = [...new Set(rows.map((r) => r.owner_id))];
    const names = new Map<string, string>();
    if (ownerIds.length) {
      const { data: os } = await supabase.from("profiles").select("id, full_name").in("id", ownerIds);
      for (const o of (os ?? []) as unknown as { id: string; full_name: string | null }[])
        names.set(o.id, o.full_name ?? "Cliente");
    }
    return rows.map((r) => ({
      id: r.id,
      title: r.title,
      description: r.description ?? "",
      location: r.location ?? "",
      budgetMin: r.budget_min,
      budgetMax: r.budget_max,
      ownerId: r.owner_id,
      ownerName: names.get(r.owner_id) ?? "Cliente",
      date: monthYear(r.created_at),
    }));
  } catch (e) {
    dbError("getOpenServiceRequests", e);
    return [];
  }
}

/**
 * Ids de los pedidos que ESTE pintor ya cotizó (cotización viva, no cancelada).
 *
 * Sin esto, /trabajos le ofrecía "Cotizar este trabajo" sobre un pedido que ya había
 * cotizado: completaba el monto y la nota, apretaba enviar, y recién ahí la base lo frenaba
 * con "Ya enviaste una cotización para este pedido". El trabajo perdido era del pintor.
 *
 * Devuelve un Set vacío ante cualquier error: la pantalla se comporta como antes (ofrece
 * cotizar) y la base sigue siendo la que impide el duplicado de verdad.
 */
export async function getPedidosYaCotizados(painterId: string, pedidoIds: string[]): Promise<Set<string>> {
  if (!SUPA || pedidoIds.length === 0) return new Set();
  try {
    const supabase = await createClient();
    // Sólo los pedidos que están en pantalla. Antes traía TODOS los trabajos del pintor, sin
    // límite: la API corta en 1.000 filas, así que un pintor con mucha historia volvía a ver
    // "Cotizar" sobre algo que ya había cotizado (escala-y-volumen, 29/9). Acotado a los ids
    // del tablero, la respuesta nunca pasa de la cantidad de pedidos que se muestran.
    const { data, error } = await supabase
      .from("jobs")
      .select("project_id, status")
      .eq("painter_id", painterId)
      .in("project_id", pedidoIds)
      .in("status", ["quoted", "accepted", "in_progress", "completed"]);
    if (error) {
      dbError("getPedidosYaCotizados", error);
      return new Set();
    }
    const rows = (data ?? []) as unknown as { project_id: string | null }[];
    return new Set(rows.map((r) => r.project_id).filter((x): x is string => !!x));
  } catch (e) {
    dbError("getPedidosYaCotizados", e);
    return new Set();
  }
}

export interface QuoteView {
  id: string;
  /** El pedido al que pertenece. Necesario para no mezclar cotizaciones de
   *  trabajos distintos al decidir cuál ya fue adjudicado. */
  projectId: string | null;
  amount: number | null;
  note: string | null;
  status: string;
  statusLabel: string;
  painterId: string;
  painter: string;
  painterLevel: Painter["level"];
  painterRating: number;
  request: string | null;
}

/** Cotizaciones recibidas por el cliente, con el pintor y el pedido resueltos. */
export async function getQuotesForClient(clientId: string): Promise<QuoteView[]> {
  if (!SUPA) return [];
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("jobs")
      .select("id, amount, note, status, painter_id, project_id, created_at")
      .eq("client_id", clientId)
      .in("status", ["quoted", "accepted"])
      .order("created_at", { ascending: false })
      .limit(50); // tope: los ids alimentan .in() derivados
    // Falló la lectura: es distinto de "no hay filas" y no se puede mostrar como si fuera lo mismo.
    if (error) errorDeLectura("getQuotesForClient", error);
    // Sin error y sin filas: el cliente genuinamente no recibió cotizaciones todavía.
    if (!data) return [];
    const rows = data as unknown as {
      id: string;
      amount: number | null;
      note: string | null;
      status: string;
      painter_id: string | null;
      project_id: string | null;
    }[];
    const painterIds = [...new Set(rows.map((r) => r.painter_id).filter(Boolean))] as string[];
    const projectIds = [...new Set(rows.map((r) => r.project_id).filter(Boolean))] as string[];
    const painters = new Map<string, { name: string; level: Painter["level"]; rating: number }>();
    const titles = new Map<string, string>();
    if (painterIds.length) {
      const { data: ps } = await supabase
        .from("profiles")
        .select("id, full_name, verified, rating")
        .in("id", painterIds);
      for (const p of (ps ?? []) as unknown as {
        id: string;
        full_name: string | null;
        verified: boolean;
        rating: number;
      }[])
        painters.set(p.id, {
          name: p.full_name ?? "Pintor",
          level: levelFromRating(Number(p.rating), p.verified),
          rating: Number(p.rating),
        });
    }
    if (projectIds.length) {
      const { data: pr } = await supabase.from("projects").select("id, title").in("id", projectIds);
      for (const p of (pr ?? []) as unknown as { id: string; title: string }[]) titles.set(p.id, p.title);
    }
    return rows.map((r) => {
      const p = r.painter_id ? painters.get(r.painter_id) : undefined;
      return {
        id: r.id,
        projectId: r.project_id,
        amount: r.amount,
        note: r.note,
        status: r.status,
        statusLabel: JOB_STATUS_LABEL[r.status] ?? r.status,
        painterId: r.painter_id ?? "",
        painter: p?.name ?? "Pintor",
        painterLevel: p?.level ?? "Silver",
        painterRating: p?.rating ?? 0,
        request: r.project_id ? titles.get(r.project_id) ?? null : null,
      };
    });
  } catch (e) {
    // Sin esto, el catch se tragaría la excepción de arriba y la volvería a convertir en la
    // lista vacía, que es justo el comportamiento que este cambio viene a sacar.
    if (e instanceof ErrorDeLecturaDeDatos) throw e;
    errorDeLectura("getQuotesForClient", e);
  }
}

export interface PedidoPropio {
  id: string;
  title: string;
  location: string;
  budgetMin: number | null;
  budgetMax: number | null;
  published: boolean;
  /** Cotizaciones VIVAS (status='quoted'), las únicas que el cliente todavía puede aceptar. */
  cotizaciones: number;
  /**
   * En qué anda el pedido, mirando los trabajos que salieron de él.
   *
   * Hace falta porque `cotizaciones` sólo cuenta las vivas: al aceptar una, el resto se
   * cancela y la aceptada deja de ser 'quoted', así que el contador vuelve a cero. El panel
   * entonces mostraba "Cerrado · Sin cotizaciones aún" en un pedido que en realidad se
   * adjudicó y se terminó — el cartel decía lo contrario de lo que había pasado.
   */
  estado: "abierto" | "adjudicado" | "terminado" | "cerrado";
  date: string;
}

/**
 * Los pedidos de servicio que publicó un cliente.
 *
 * Existe porque /cliente listaba sólo `jobs`, que se pueblan cuando un PINTOR cotiza. Un
 * pedido sin cotizaciones no existía para el panel: el cliente publicaba, veía "Tu trabajo
 * está publicado", entraba a su panel y leía "Todavía no pediste ningún trabajo". Varios
 * terminaban publicando de nuevo y duplicando el pedido.
 */
export async function getPedidosDelCliente(clientId: string): Promise<PedidoPropio[]> {
  if (!SUPA) return [];
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("projects")
      .select("id, title, location, budget_min, budget_max, published, created_at")
      .eq("owner_id", clientId)
      .eq("type", "service")
      .order("created_at", { ascending: false })
      .limit(50);
    // Falló la lectura: es distinto de "no hay filas" y no se puede mostrar como si fuera lo mismo.
    if (error) errorDeLectura("getPedidosDelCliente", error);
    // Sin error y sin filas: el cliente genuinamente no publicó ningún pedido todavía.
    if (!data) return [];
    const rows = data as unknown as {
      id: string;
      title: string;
      location: string | null;
      budget_min: number | null;
      budget_max: number | null;
      published: boolean;
      created_at: string;
    }[];
    if (rows.length === 0) return [];

    // Todos los trabajos de estos pedidos, no sólo los 'quoted': con el estado de cada uno
    // se sabe si el pedido sigue esperando ofertas, ya se adjudicó, o terminó.
    const conteo = new Map<string, number>();
    const estados = new Map<string, Set<string>>();
    const { data: js, error: errJobs } = await supabase
      .from("jobs")
      .select("project_id, status")
      .in("project_id", rows.map((r) => r.id));
    // Esta lectura no es decorativa: de acá salen `cotizaciones` y `estado`. Si falla y
    // seguimos, el panel dice "Cerrado · Sin cotizaciones aún" sobre un pedido adjudicado,
    // que es exactamente la mentira que el comentario de arriba viene a evitar.
    if (errJobs) errorDeLectura("getPedidosDelCliente/jobs", errJobs);
    for (const j of (js ?? []) as unknown as { project_id: string | null; status: string }[]) {
      if (!j.project_id) continue;
      if (j.status === "quoted") conteo.set(j.project_id, (conteo.get(j.project_id) ?? 0) + 1);
      const set = estados.get(j.project_id) ?? new Set<string>();
      set.add(j.status);
      estados.set(j.project_id, set);
    }

    return rows.map((r) => {
      const s = estados.get(r.id) ?? new Set<string>();
      // El orden importa: un pedido terminado pudo tener antes cotizaciones perdedoras
      // canceladas, y lo que hay que contar es cómo terminó, no por dónde pasó.
      const estado: PedidoPropio["estado"] = s.has("completed")
        ? "terminado"
        : s.has("accepted") || s.has("in_progress")
          ? "adjudicado"
          : r.published
            ? "abierto"
            : "cerrado";
      return {
        id: r.id,
        title: r.title,
        location: r.location ?? "",
        budgetMin: r.budget_min,
        budgetMax: r.budget_max,
        published: r.published,
        cotizaciones: conteo.get(r.id) ?? 0,
        estado,
        date: monthYear(r.created_at),
      };
    });
  } catch (e) {
    // Sin esto, el catch se tragaría la excepción de arriba y la volvería a convertir en la
    // lista vacía, que es justo el comportamiento que este cambio viene a sacar.
    if (e instanceof ErrorDeLecturaDeDatos) throw e;
    errorDeLectura("getPedidosDelCliente", e);
  }
}

export interface ContactoContraparte {
  nombre: string;
  telefono: string | null;
}

/**
 * El teléfono de la otra parte de un trabajo en marcha.
 *
 * Va por la función `contacto_del_trabajo` (migración 0011) y no por un select a `profiles`
 * porque 0006 le revocó `phone` a authenticated: la RLS de perfiles es `using (true)`, así
 * que devolver la columna sería publicar el teléfono de todos. La función es
 * `security definer` y decide por vínculo — sos parte de ESE trabajo y el trabajo ya arrancó.
 *
 * Devuelve null si no corresponde mostrarlo (no sos parte, o el trabajo sigue en 'quoted').
 */
export async function getContactoDelTrabajo(jobId: string): Promise<ContactoContraparte | null> {
  if (!SUPA) return null;
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("contacto_del_trabajo", { job_id: jobId } as never);
    if (error) {
      dbError("getContactoDelTrabajo", error);
      return null;
    }
    const filas = (data ?? []) as unknown as { nombre: string | null; telefono: string | null }[];
    if (filas.length === 0) return null;
    return { nombre: filas[0].nombre ?? "La otra parte", telefono: filas[0].telefono };
  } catch (e) {
    dbError("getContactoDelTrabajo", e);
    return null;
  }
}

/**
 * El teléfono propio, para precargar el formulario.
 *
 * Hace falta una función aparte por lo mismo que arriba: ni el dueño puede leer su propio
 * `phone` con un select normal. Sin esto el campo aparecería vacío siempre y la persona
 * lo pisaría sin querer creyendo que nunca lo cargó.
 */
export async function getMiTelefono(): Promise<string> {
  if (!SUPA) return "";
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("mi_telefono" as never);
    if (error) {
      dbError("getMiTelefono", error);
      return "";
    }
    return (data as unknown as string | null) ?? "";
  } catch (e) {
    dbError("getMiTelefono", e);
    return "";
  }
}
