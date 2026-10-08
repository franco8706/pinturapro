import Link from "next/link";
import { Navbar } from "@/components/features/navbar";
import { Footer } from "@/components/features/footer";
import { SectionLabel, EmptyState } from "@/components/features/states";
import { createClient } from "@/lib/supabase/server";
import {
  getOpenServiceRequests,
  getOwnProfile,
  getPedidosYaCotizados,
  getMiAcceso,
  getCondicionesDeCobro,
  formatARS,
  type MiAcceso,
} from "@/lib/queries";
import { fechaAR } from "@pinturapro/dominio";
import { QuoteForm } from "./quote-form";

import type { Metadata } from "next";
import { tarjeta } from "@/lib/tarjeta";

export const metadata: Metadata = {
  title: "Trabajos disponibles",
  description: "Pedidos de pintura publicados por clientes. Cotizá y sumá trabajo a tu agenda.",
  alternates: { canonical: "/trabajos" },
  // Se ve sin cuenta (los pintores llegan de afuera), pero fuera de Google: son pedidos de
  // personas, con su zona y su presupuesto. Decisión por defecto de la ronda de escala (29/9);
  // si el dueño quiere el tablero indexado, se saca esta línea y se vuelve a sumar al sitemap.
  robots: { index: false, follow: true },
  ...tarjeta({ titulo: "Trabajos disponibles", descripcion: "Pedidos de pintura publicados por clientes. Cotizá y sumá trabajo a tu agenda.", ruta: "/trabajos" }),
};

function budgetLabel(min: number | null, max: number | null): string {
  if (min && max) return `${formatARS(min)} – ${formatARS(max)}`;
  if (max) return `Hasta ${formatARS(max)}`;
  if (min) return `Desde ${formatARS(min)}`;
  return "A definir";
}

export default async function TrabajosPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [requests, condiciones] = await Promise.all([getOpenServiceRequests(), getCondicionesDeCobro()]);

  // Esta página es el lado de la oferta. A una cuenta de cliente se le mostraba el
  // formulario de cotización sobre los pedidos ajenos, y la cotización se creaba de
  // verdad (medido). Si el perfil no se puede leer, se muestra igual: la base rechaza
  // al que no es pintor (policy jobs_insert_painter_quote, migración 0016).
  let esCliente = false;
  let yaCotizados = new Set<string>();
  // La suscripción (0027): se pide una sola vez por página, no por tarjeta.
  let acceso: MiAcceso | null = null;
  if (user) {
    try {
      esCliente = (await getOwnProfile(user.id))?.type === "client";
    } catch {
      esCliente = false;
    }
    if (!esCliente) {
      [yaCotizados, acceso] = await Promise.all([
        getPedidosYaCotizados(user.id, requests.map((r) => r.id)),
        getMiAcceso(user.id),
      ]);
    }
  }
  // El aviso del precio, para quien cotiza o puede llegar a cotizar (no para clientes).
  const precioHoy =
    condiciones.precioArs != null ? ` (hoy ${formatARS(condiciones.precioArs)})` : "";
  const avisoPintores = !condiciones.disponible
    ? null
    : acceso && !acceso.puedeCotizar
      ? null
      : `Para pintores: cotizar es gratis durante el lanzamiento${
          condiciones.lanzamientoHasta ? `, hasta el ${fechaAR(condiciones.lanzamientoHasta)}` : ""
        }. Después, una suscripción de US$${(condiciones.plan?.precioUsd ?? 5).toLocaleString("es-AR")} por mes${precioHoy}, sin comisión sobre tus trabajos.`;

  return (
    <main>
      <Navbar />
      <section className="pt-32 sm:pt-40 pb-section min-h-screen">
        <div className="container-asymmetric">
          <div className="mb-12">
            <SectionLabel className="mb-4">Marketplace</SectionLabel>
            <h1 className="font-display text-display-xl max-w-3xl text-balance mb-6">
              Trabajos disponibles para cotizar.
            </h1>
            <p className="font-body text-body-lg text-concrete max-w-xl">
              Clientes reales buscando pintores. Enviá tu cotización y ganá el trabajo.
            </p>
            {!esCliente && avisoPintores && (
              <p className="font-body text-body-sm text-concrete max-w-xl mt-4">{avisoPintores}</p>
            )}
            {acceso && !acceso.puedeCotizar && (
              <p role="status" className="font-body text-body-md text-[#C41E3A] max-w-xl mt-4">
                {acceso.texto}{" "}
                <Link href="/dashboard/plan" className="text-ink underline underline-offset-2">
                  Ver mi plan
                </Link>
              </p>
            )}
          </div>

          {requests.length === 0 ? (
            <EmptyState
              title="Todavía no hay trabajos publicados"
              description="Cuando un cliente publique un pedido, va a aparecer acá para que lo coticen."
            />
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {requests.map((r) => (
                <article key={r.id} className="border border-concrete/15 p-6 sm:p-8 flex flex-col">
                  <div className="flex items-start justify-between gap-4 mb-3">
                    <h2 className="font-display text-display-md leading-tight">{r.title}</h2>
                    <span className="font-mono text-mono-sm text-concrete whitespace-nowrap">{r.date}</span>
                  </div>
                  {r.description && <p className="font-body text-body-md text-concrete mb-4">{r.description}</p>}
                  <div className="flex flex-wrap gap-x-6 gap-y-1 font-body text-body-sm text-concrete mb-1">
                    {r.location && <span>📍 {r.location}</span>}
                    <span>💰 {budgetLabel(r.budgetMin, r.budgetMax)}</span>
                    <span>Cliente: {r.ownerName}</span>
                  </div>

                  <div className="mt-auto">
                    {!user ? (
                      <Link
                        href="/ingresar?next=/trabajos"
                        className="mt-4 inline-block py-1 font-body text-body-sm text-ink underline underline-offset-2"
                      >
                        Ingresá como pintor para cotizar →
                      </Link>
                    ) : user.id === r.ownerId ? (
                      <p className="mt-4 font-body text-body-sm text-concrete">Este es tu pedido.</p>
                    ) : yaCotizados.has(r.id) ? (
                      /* Antes mostraba el formulario igual: el pintor lo completaba entero y
                         recién al enviar la base le decía que ya había cotizado. */
                      <p className="mt-4 font-body text-body-sm text-concrete">
                        Ya cotizaste este pedido.{" "}
                        <Link href="/dashboard" className="text-ink underline underline-offset-2">
                          Ver en mi panel
                        </Link>
                      </p>
                    ) : esCliente ? (
                      <p className="mt-4 font-body text-body-sm text-concrete">
                        Las cotizaciones las envían los pintores.{" "}
                        <Link href="/cliente" className="text-ink underline underline-offset-2">
                          Volver a mi panel
                        </Link>
                      </p>
                    ) : acceso && !acceso.puedeCotizar ? (
                      /* La base no le deja cotizar (0027): en lugar de un formulario que va a
                         rebotar al enviar, el motivo y el camino. */
                      <p className="mt-4 font-body text-body-sm text-concrete">
                        Para cotizar necesitás una suscripción activa.{" "}
                        <Link href="/dashboard/plan" className="text-ink underline underline-offset-2">
                          Ver mi plan
                        </Link>
                      </p>
                    ) : (
                      <QuoteForm projectId={r.id} clientId={r.ownerId} />
                    )}
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>
      </section>
      <Footer />
    </main>
  );
}
