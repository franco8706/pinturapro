"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Navbar } from "@/components/features/navbar";
import { Footer } from "@/components/features/footer";
import { LevelBadge } from "@/components/features/level-badge";
import type { Painter } from "@/lib/data";
import type {
  LeadView,
  ResenaParaModerar,
  CotizacionAdmin,
  MetricasSuscripciones,
  CancelacionTrasAceptar,
  ColaDeTransferencias,
  PagoParaAdmin,
} from "@/lib/queries";
import {
  borrarResena,
  confirmarCotizacion,
  cargarExtracto,
  confirmarTransferencia,
  rechazarTransferencia,
  devolverPago,
} from "./actions";
import { fechaAR } from "@pinturapro/dominio";
import { cn } from "@/lib/utils";

const tabs = ["Consultas", "Pintores", "Reseñas", "Cobro"] as const;
type Tab = (typeof tabs)[number];

export interface DatosDeCobro {
  cotizaciones: CotizacionAdmin[];
  metricas: MetricasSuscripciones | null;
  cancelaciones: CancelacionTrasAceptar[];
  transferencias: ColaDeTransferencias;
  pagos: PagoParaAdmin[];
  precioArs: number | null;
  precioUsd: number | null;
}

export function AdminClient({
  leads,
  painters,
  resenas,
  cobro,
}: {
  leads: LeadView[];
  painters: Painter[];
  resenas: ResenaParaModerar[];
  cobro: DatosDeCobro;
}) {
  const [tab, setTab] = useState<Tab>("Consultas");
  const sinLeer = leads.filter((l) => l.status === "new").length;

  return (
    <main>
      <Navbar />
      <section className="pt-32 sm:pt-40 pb-section min-h-screen">
        <div className="container-asymmetric">
          <div className="flex items-center gap-3 mb-2">
            <p className="font-mono text-mono-sm text-concrete uppercase tracking-widest">Panel admin</p>
            <span className="px-2 py-0.5 bg-[#C41E3A]/10 text-[#C41E3A] font-mono text-mono-sm">Sólo empresa</span>
            {sinLeer > 0 && (
              <span className="px-2 py-0.5 bg-ink text-bone font-mono text-mono-sm">{sinLeer} sin leer</span>
            )}
          </div>
          <h1 className="font-display text-display-xl mb-10">Consultas, pintores, reseñas y cobro.</h1>

          {/* Tabs */}
          <div className="flex gap-1 border-b border-concrete/15 mb-8">
            {tabs.map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={cn(
                  "px-5 py-3 font-body text-body-sm border-b-2 -mb-px transition-colors duration-300",
                  tab === t ? "border-ink text-ink" : "border-transparent text-concrete hover:text-ink",
                )}
              >
                {t}
              </button>
            ))}
          </div>

          {tab === "Consultas" && (
            leads.length === 0 ? (
              <p className="font-body text-body-md text-concrete py-12">
                Todavía no llegó ninguna consulta. Acá van a aparecer los mensajes de /contacto y las
                postulaciones de /registro.
              </p>
            ) : (
              <Table headers={["Tipo", "Nombre", "Contacto", "Detalle", "Fecha"]}>
                {leads.map((l) => (
                  <tr key={l.id} className="border-b border-concrete/10 align-top">
                    <Td>
                      <span className="font-mono text-mono-sm uppercase tracking-widest">{l.kindLabel}</span>
                    </Td>
                    <Td>{l.name}</Td>
                    <Td className="text-concrete">
                      {l.email && (
                        <a href={`mailto:${l.email}`} className="hover:text-ink transition-colors">
                          {l.email}
                        </a>
                      )}
                      {l.phone && <div className="font-mono text-mono-sm">{l.phone}</div>}
                    </Td>
                    <Td className="text-concrete max-w-sm">
                      {l.message && <p className="mb-1">{l.message}</p>}
                      {Object.entries(l.details)
                        .filter(([, v]) => v !== null && v !== undefined && String(v).trim() !== "")
                        .map(([k, v]) => (
                          <div key={k} className="font-mono text-mono-sm">
                            {k}: {String(v)}
                          </div>
                        ))}
                    </Td>
                    <Td className="text-concrete whitespace-nowrap">{l.date}</Td>
                  </tr>
                ))}
              </Table>
            )
          )}

          {tab === "Pintores" && (
            painters.length === 0 ? (
              <p className="font-body text-body-md text-concrete py-12">Todavía no hay pintores cargados.</p>
            ) : (
              <Table headers={["Pintor", "Nivel", "Rating", "Reseñas", "Zona"]}>
                {painters.map((p) => (
                  <tr key={p.id} className="border-b border-concrete/10">
                    <Td>{p.name}</Td>
                    <Td>
                      <LevelBadge level={p.level} />
                    </Td>
                    <Td>★ {p.rating.toFixed(1)}</Td>
                    <Td className="text-concrete">{p.reviews}</Td>
                    <Td className="text-concrete">{p.zone}</Td>
                  </tr>
                ))}
              </Table>
            )
          )}

          {tab === "Reseñas" && (
            resenas.length === 0 ? (
              <p className="font-body text-body-md text-concrete py-12">Todavía no hay reseñas.</p>
            ) : (
              <>
                <p className="font-body text-body-sm text-concrete max-w-2xl mb-6">
                  Las últimas {resenas.length}, de la más nueva a la más vieja. Dar de baja una reseña la
                  borra para todos y recalcula el promedio del pintor: no se puede deshacer.
                </p>
                <Table headers={["Fecha", "De", "Para", "Nota", "Texto", ""]}>
                  {resenas.map((r) => (
                    <tr key={r.id} className="border-b border-concrete/10 align-top">
                      <Td className="text-concrete whitespace-nowrap">{r.fecha}</Td>
                      <Td>{r.autor}</Td>
                      <Td>
                        <a href={`/pintor/${r.pintorId}`} className="underline underline-offset-4">
                          {r.pintor}
                        </a>
                      </Td>
                      <Td className="whitespace-nowrap">★ {r.rating}</Td>
                      <Td className="text-concrete max-w-md [overflow-wrap:anywhere]">{r.comment || "—"}</Td>
                      <Td>
                        <BorrarResena id={r.id} />
                      </Td>
                    </tr>
                  ))}
                </Table>
              </>
            )
          )}

          {tab === "Cobro" && <Cobro datos={cobro} />}
        </div>
      </section>
      <Footer />
    </main>
  );
}

const ars = (n: number | null) =>
  n == null ? "—" : new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 2 }).format(n);

/**
 * El cobro de la suscripción (6/10/2026): el dólar con el que se pasan a pesos los US$5, las
 * lecturas que no se usaron (y el botón para confirmar un salto), las cifras del mes y las
 * cancelaciones después de aceptar (H5).
 */
function Cobro({ datos }: { datos: DatosDeCobro }) {
  const vigente = datos.cotizaciones.find((c) => c.estado === "vigente");
  const aConfirmar = datos.cotizaciones.filter((c) => c.estado === "a_confirmar");
  const m = datos.metricas;
  return (
    <div className="space-y-12">
      <div>
        <h2 className="font-display text-display-md mb-3">El dólar de la suscripción</h2>
        {vigente ? (
          <p className="font-body text-body-md text-concrete max-w-2xl">
            Vigente: <strong className="text-ink">{ars(vigente.venta)}</strong> (oficial Banco Nación, venta), leído el{" "}
            {fechaAR(vigente.leidaEn)}. US${(datos.precioUsd ?? 5).toLocaleString("es-AR")} hoy son{" "}
            <strong className="text-ink">{ars(datos.precioArs)}</strong>.
          </p>
        ) : (
          <p className="font-body text-body-md text-concrete max-w-2xl">
            Todavía no hay ninguna cotización vigente: la tarea de Cloud Scheduler no corrió nunca o
            no está configurada (`COTIZACION_TOKEN`). Sin cotización no se muestra el precio en pesos.
          </p>
        )}
        {aConfirmar.length > 0 && (
          <p role="alert" className="mt-3 font-body text-body-md text-[#C41E3A] max-w-2xl">
            Hay {aConfirmar.length} lectura{aConfirmar.length > 1 ? "s" : ""} que saltó más del 10 %: no se usa hasta
            que la confirmes. Si el salto es real (una devaluación), confirmala; si no, dejala.
          </p>
        )}
      </div>

      {datos.cotizaciones.length > 0 && (
        <Table headers={["Leída", "Venta", "Control (BCRA)", "Estado", "Motivo", ""]}>
          {datos.cotizaciones.map((c) => (
            <tr key={c.id} className="border-b border-concrete/10 align-top">
              <Td className="text-concrete whitespace-nowrap">{fechaAR(c.leidaEn)}</Td>
              <Td className="tabular-nums">{ars(c.venta)}</Td>
              <Td className="tabular-nums text-concrete">{ars(c.control)}</Td>
              <Td>{c.estado === "a_confirmar" ? "A confirmar" : c.estado === "vigente" ? "Vigente" : "Descartada"}</Td>
              <Td className="text-concrete max-w-sm [overflow-wrap:anywhere]">{c.motivo ?? "—"}</Td>
              <Td>
                {c.estado === "a_confirmar" ? (
                  <ConfirmarCotizacion id={c.id} venta={c.venta} etiqueta="Confirmar" />
                ) : c.estado === "descartada" ? (
                  <ConfirmarCotizacion id={c.id} venta={c.venta} etiqueta="Usarla igual" />
                ) : null}
              </Td>
            </tr>
          ))}
        </Table>
      )}

      <Transferencias cola={datos.transferencias} />

      <UltimosPagos pagos={datos.pagos} />

      <div>
        <h2 className="font-display text-display-md mb-3">Suscripciones</h2>
        {m ? (
          <p className="font-body text-body-md text-concrete max-w-2xl">
            Al día: <strong className="text-ink">{m.activos}</strong> · en gracia: {m.enGracia} · en el lanzamiento:{" "}
            {m.enLanzamiento} · sin acceso: {m.sinAcceso}. Ingreso del mes: <strong className="text-ink">{ars(m.ingresoMesArs)}</strong>
            {m.devolucionesMesArs > 0 ? ` (devoluciones: ${ars(m.devolucionesMesArs)})` : ""}. Transferencias para revisar:{" "}
            {m.transferenciasARevisar}.
          </p>
        ) : (
          <p className="font-body text-body-md text-concrete">La base todavía no tiene el modelo de cobro (migración 0027).</p>
        )}
      </div>

      <div>
        <h2 className="font-display text-display-md mb-3">Cancelados después de aceptar</h2>
        <p className="font-body text-body-sm text-concrete max-w-2xl mb-4">
          Trabajos que se aceptaron —y por lo tanto las dos partes vieron el teléfono de la otra— y después se
          cancelaron. Muchos de la misma cuenta pueden ser alguien juntando teléfonos o cerrando por fuera.
        </p>
        {datos.cancelaciones.length === 0 ? (
          <p className="font-body text-body-md text-concrete">Ninguno.</p>
        ) : (
          <Table headers={["Aceptado", "Cancelado", "Canceló", "Monto"]}>
            {datos.cancelaciones.map((c) => (
              <tr key={c.jobId} className="border-b border-concrete/10">
                <Td className="text-concrete whitespace-nowrap">{c.aceptadoEn ? fechaAR(c.aceptadoEn) : "—"}</Td>
                <Td className="text-concrete whitespace-nowrap">{c.canceladoEn ? fechaAR(c.canceladoEn) : "—"}</Td>
                <Td>{c.canceladoPor ?? "—"}</Td>
                <Td className="tabular-nums">{ars(c.monto)}</Td>
              </tr>
            ))}
          </Table>
        )}
      </div>
    </div>
  );
}

/**
 * Las transferencias: los avisos de los pintores ("Ya transferí"), el extracto del banco que los
 * confirma solo cuando todo cierra, y lo que queda para mirar a mano, con lo que llegó y por qué.
 */
function Transferencias({ cola }: { cola: ColaDeTransferencias }) {
  const router = useRouter();
  const [resultado, setResultado] = useState("");
  const [error, setError] = useState("");
  const [pendiente, empezar] = useTransition();
  return (
    <div>
      <h2 className="font-display text-display-md mb-3">Transferencias</h2>
      <p className="font-body text-body-sm text-concrete max-w-2xl mb-4">
        Cargá el extracto del banco en CSV (desde el home banking), con la columna de saldo. Una línea se confirma
        sola si trae el código de un pintor (PP-0037), al menos el 97 % de lo pedido, y cierra con el saldo de las
        líneas de al lado. Lo demás queda acá abajo para que lo mires contra el banco. Cargar el mismo extracto dos
        veces no registra nada dos veces.
      </p>
      <form
        className="flex flex-wrap items-center gap-3 mb-6"
        onSubmit={(e) => {
          e.preventDefault();
          const fd = new FormData(e.currentTarget);
          setError("");
          setResultado("");
          empezar(async () => {
            const r = await cargarExtracto(fd);
            if (r.error) setError(r.error);
            else if (r.resumen) {
              const s = r.resumen;
              if (!s.entendido) {
                setError("No encontramos el encabezado del extracto (una columna de fecha y una de importe o crédito).");
                return;
              }
              const avisos = [
                s.ilegibles ? `${s.ilegibles} líneas no se pudieron leer (otra cantidad de columnas): miralas en el banco` : "",
                s.conError ? `${s.conError} líneas fallaron: volvé a cargar el archivo` : "",
                !s.conSaldo ? "el extracto no trae saldo, así que nada se confirmó solo" : "",
              ].filter(Boolean);
              setResultado(
                `${s.lineas} créditos leídos: ${s.confirmadas} confirmadas, ${s.aRevisar} para revisar, ${s.yaCargadas} ya cargadas antes, ${s.sinCodigo} sin código, ${s.codigoDesconocido} con un código que no es de nadie.${avisos.length ? ` Ojo: ${avisos.join("; ")}.` : ""}`,
              );
              router.refresh();
            }
          });
        }}
      >
        <label className="font-body text-body-sm">
          <span className="sr-only">Extracto del banco (CSV)</span>
          <input type="file" name="extracto" accept=".csv,text/csv,text/plain" className="font-body text-body-sm" />
        </label>
        <button
          type="submit"
          disabled={pendiente}
          className="px-5 py-2.5 bg-ink text-bone font-body text-body-sm hover:bg-ink/90 transition-colors disabled:opacity-50"
        >
          {pendiente ? "Leyendo…" : "Cargar extracto"}
        </button>
      </form>
      <p role="status" aria-live="polite" className="font-body text-body-sm text-ink mb-4">
        {resultado}
      </p>
      {error && (
        <p role="alert" className="font-body text-body-sm text-[#C41E3A] mb-4">
          {error}
        </p>
      )}
      {cola.filas.length === 0 ? (
        <p className="font-body text-body-md text-concrete">No hay transferencias esperando.</p>
      ) : (
        <>
          <Table headers={["Fecha", "Pintor", "Código", "Pedido", "Llegó", "Estado", ""]}>
            {cola.filas.map((x) => (
              <tr key={x.id} data-cobro={x.id} className="border-b border-concrete/10 align-top">
                <Td className="text-concrete whitespace-nowrap">{fechaAR(x.creado)}</Td>
                <Td>{x.pintor}</Td>
                <Td className="font-mono">{x.codigo ?? "—"}</Td>
                <Td className="tabular-nums">{ars(x.montoArs)}</Td>
                <Td className="tabular-nums">{x.recibido == null ? "—" : ars(x.recibido)}</Td>
                <Td className="max-w-sm">
                  {x.estado === "a_revisar" ? (
                    <>
                      <span className="text-ink">Para revisar: {x.motivo ?? "no se pudo confirmar sola"}</span>
                      {x.linea && (
                        <span className="block font-mono text-mono-sm text-concrete [overflow-wrap:anywhere] mt-1" title={x.linea}>
                          {x.linea.length > 120 ? `${x.linea.slice(0, 120)}…` : x.linea}
                        </span>
                      )}
                    </>
                  ) : (
                    <span className="text-concrete">Esperando (vale hasta el {fechaAR(x.venceEn)})</span>
                  )}
                </Td>
                <Td>
                  <AccionTransferencia id={x.id} monto={x.recibido ?? x.montoArs} />
                </Td>
              </tr>
            ))}
          </Table>
          {cola.ocultas > 0 && (
            <p className="font-body text-body-sm text-[#C41E3A] mt-3">
              Hay {cola.ocultas} más que no entran en la lista: resolvé las de arriba y aparecen.
            </p>
          )}
        </>
      )}
    </div>
  );
}

/** "Llegó" en dos clics, diciendo cuánto se va a registrar; "No llegó" anula sin tocar el libro. */
function AccionTransferencia({ id, monto }: { id: string; monto: number }) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [confirmar, setConfirmar] = useState(false);
  const [pendiente, empezar] = useTransition();
  const hacer = (accion: (id: string) => Promise<{ error?: string; ok?: boolean }>) =>
    empezar(async () => {
      const r = await accion(id);
      if (r.error) setError(r.error);
      else router.refresh();
    });
  return (
    <span className="flex flex-col gap-1">
      {confirmar ? (
        <span className="flex gap-3 whitespace-nowrap">
          <button
            type="button"
            disabled={pendiente}
            onClick={() => hacer(confirmarTransferencia)}
            className="py-1 font-body text-body-sm text-ink underline underline-offset-4"
          >
            {pendiente ? "Registrando…" : `Sí, registrar ${ars(monto)}`}
          </button>
          <button
            type="button"
            disabled={pendiente}
            onClick={() => setConfirmar(false)}
            className="py-1 font-body text-body-sm text-concrete underline underline-offset-4"
          >
            Cancelar
          </button>
        </span>
      ) : (
        <span className="flex gap-3 whitespace-nowrap">
          <button
            type="button"
            disabled={pendiente}
            onClick={() => setConfirmar(true)}
            className="py-1 font-body text-body-sm text-ink underline underline-offset-4"
          >
            Llegó
          </button>
          <button
            type="button"
            disabled={pendiente}
            onClick={() => hacer(rechazarTransferencia)}
            className="py-1 font-body text-body-sm text-concrete underline underline-offset-4"
          >
            No llegó
          </button>
        </span>
      )}
      {error && (
        <span role="alert" className="font-body text-body-sm text-[#C41E3A]">
          {error}
        </span>
      )}
    </span>
  );
}

/**
 * Lo que entró al libro, sea solo o a mano: antes nada de eso se veía y un pago mal confirmado
 * no dejaba huella en pantalla. "Devolver" registra la devolución y le saca ese mes al pintor.
 */
function UltimosPagos({ pagos }: { pagos: PagoParaAdmin[] }) {
  return (
    <div>
      <h2 className="font-display text-display-md mb-3">Últimos pagos</h2>
      {pagos.length === 0 ? (
        <p className="font-body text-body-md text-concrete">Todavía no entró ningún pago.</p>
      ) : (
        <Table headers={["Registrado", "En el banco", "Pintor", "Monto", "Origen", ""]}>
          {pagos.map((p) => (
            <tr key={p.id} data-pago={p.id} className="border-b border-concrete/10 align-top">
              <Td className="text-concrete whitespace-nowrap">{fechaAR(p.fecha)}</Td>
              <Td className="text-concrete whitespace-nowrap">{p.fechaBanco ? fechaAR(`${p.fechaBanco}T12:00:00-03:00`) : "—"}</Td>
              <Td>{p.pintor}</Td>
              <Td className="tabular-nums">
                {p.tipo === "cobro" ? "" : "−"}
                {ars(p.montoArs)}
              </Td>
              <Td className="max-w-sm">
                <span>{p.origen}</span>
                {p.linea && (
                  <span className="block font-mono text-mono-sm text-concrete [overflow-wrap:anywhere] mt-1" title={p.linea}>
                    {p.linea.length > 120 ? `${p.linea.slice(0, 120)}…` : p.linea}
                  </span>
                )}
              </Td>
              <Td>{p.tipo === "cobro" ? p.devuelto ? <span className="text-concrete">Devuelto</span> : <Devolver id={p.id} monto={p.montoArs} /> : null}</Td>
            </tr>
          ))}
        </Table>
      )}
    </div>
  );
}

function Devolver({ id, monto }: { id: string; monto: number }) {
  const router = useRouter();
  const [confirmar, setConfirmar] = useState(false);
  const [error, setError] = useState("");
  const [pendiente, empezar] = useTransition();
  if (!confirmar) {
    return (
      <button
        type="button"
        onClick={() => setConfirmar(true)}
        className="py-1 font-body text-body-sm text-concrete underline underline-offset-4 hover:text-ink whitespace-nowrap"
      >
        Devolver
      </button>
    );
  }
  return (
    <span className="flex flex-col gap-1">
      <span className="flex gap-3 whitespace-nowrap">
        <button
          type="button"
          disabled={pendiente}
          onClick={() =>
            empezar(async () => {
              const r = await devolverPago(id);
              if (r.error) setError(r.error);
              else router.refresh();
            })
          }
          className="py-1 font-body text-body-sm text-ink underline underline-offset-4"
        >
          {pendiente ? "Registrando…" : `Sí, devolví ${ars(monto)}`}
        </button>
        <button
          type="button"
          disabled={pendiente}
          onClick={() => setConfirmar(false)}
          className="py-1 font-body text-body-sm text-concrete underline underline-offset-4"
        >
          No
        </button>
      </span>
      {error && (
        <span role="alert" className="font-body text-body-sm text-[#C41E3A]">
          {error}
        </span>
      )}
    </span>
  );
}

/** Dos clics, como dar de baja una reseña: cambia el precio que pagan todos. */
function ConfirmarCotizacion({ id, venta, etiqueta }: { id: number; venta: number; etiqueta: string }) {
  const router = useRouter();
  const [confirmar, setConfirmar] = useState(false);
  const [error, setError] = useState("");
  const [pendiente, empezar] = useTransition();
  if (!confirmar) {
    return (
      <button
        type="button"
        onClick={() => setConfirmar(true)}
        className="py-1 font-body text-body-sm text-concrete underline underline-offset-4 hover:text-ink whitespace-nowrap"
      >
        {etiqueta}
      </button>
    );
  }
  return (
    <span className="flex flex-col gap-1">
      <span className="flex gap-3 whitespace-nowrap">
        <button
          type="button"
          disabled={pendiente}
          onClick={() =>
            empezar(async () => {
              const r = await confirmarCotizacion(id);
              if (r.error) setError(r.error);
              else router.refresh();
            })
          }
          className="py-1 font-body text-body-sm text-ink underline underline-offset-4"
        >
          {pendiente ? "Confirmando…" : `Sí, usar ${ars(venta)}`}
        </button>
        <button
          type="button"
          disabled={pendiente}
          onClick={() => setConfirmar(false)}
          className="py-1 font-body text-body-sm text-concrete underline underline-offset-4"
        >
          No
        </button>
      </span>
      {error && (
        <span role="alert" className="font-body text-body-sm text-[#C41E3A]">
          {error}
        </span>
      )}
    </span>
  );
}

/** Dos clics: el primero pregunta, el segundo borra. Sin diálogo del navegador. */
function BorrarResena({ id }: { id: string }) {
  const router = useRouter();
  const [confirmar, setConfirmar] = useState(false);
  const [error, setError] = useState("");
  const [pendiente, empezar] = useTransition();

  if (!confirmar) {
    return (
      <button
        type="button"
        onClick={() => setConfirmar(true)}
        className="py-1 font-body text-body-sm text-concrete underline underline-offset-4 hover:text-ink whitespace-nowrap"
      >
        Dar de baja
      </button>
    );
  }
  return (
    <span className="flex flex-col gap-1">
      <span className="flex gap-3 whitespace-nowrap">
        <button
          type="button"
          disabled={pendiente}
          onClick={() =>
            empezar(async () => {
              const r = await borrarResena(id);
              if (r?.error) setError(r.error);
              else router.refresh();
            })
          }
          className="py-1 font-body text-body-sm text-[#C41E3A] underline underline-offset-4 disabled:opacity-50"
        >
          {pendiente ? "Borrando…" : "Sí, borrarla"}
        </button>
        <button
          type="button"
          disabled={pendiente}
          onClick={() => setConfirmar(false)}
          className="py-1 font-body text-body-sm text-concrete underline underline-offset-4"
        >
          No
        </button>
      </span>
      {error && (
        <span role="alert" className="font-body text-body-sm text-[#C41E3A]">
          {error}
        </span>
      )}
    </span>
  );
}

function Table({ headers, children }: { headers: string[]; children: React.ReactNode }) {
  return (
    <div className="overflow-x-auto border border-concrete/15">
      <table className="w-full text-left">
        <thead>
          <tr className="border-b border-concrete/20 bg-mist">
            {headers.map((h) => (
              <th key={h} className="px-5 py-3 font-mono text-mono-sm text-concrete uppercase tracking-widest font-normal">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}

function Td({ children, className }: { children: React.ReactNode; className?: string }) {
  return <td className={cn("px-5 py-4 font-body text-body-sm align-middle", className)}>{children}</td>;
}
