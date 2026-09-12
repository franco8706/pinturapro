import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Navbar } from "@/components/features/navbar";
import { Footer } from "@/components/features/footer";
import { SectionLabel } from "@/components/features/states";
import { createClient } from "@/lib/supabase/server";

import {
  getOwnProfile,
  getMetricasPlataforma,
  getVolumenMensual,
  getActividadReciente,
  formatARS,
} from "@/lib/queries";


// Panel privado: título propio (antes usaba el genérico de la home) y fuera de
// buscadores, como defensa en profundidad además del gate de sesión.
export const metadata: Metadata = {
  title: "Panel analítico",
  robots: { index: false, follow: false },
};

/**
 * Panel analítico del marketplace: información de negocio de la plataforma (volumen
 * transado, comisión generada), así que sólo lo ve un administrador.
 *
 * Los números salían de constantes escritas a mano ("1.284 trabajos publicados",
 * "$48.2M transados", una serie inventada para el gráfico y `mockJobs` en la columna de
 * actividad). Hoy vienen de `metricas_plataforma`, `volumen_mensual` y `actividad_reciente`
 * (migración 0012), que además verifican `is_admin` dentro de la base: el gate de esta
 * página no es lo único que separa a un curioso de las cifras del negocio.
 */
export default async function MarketplacePanelPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/ingresar?next=/panel");

  const profile = await getOwnProfile(user.id);
  // is_admin y NO type==="company": el rol de empresa se auto-asigna en el formulario
  // público de alta, así que gatear por él era una cerradura con la llave en el sobre.
  if (!profile || !profile.isAdmin) redirect("/mi-panel");

  const [metricas, meses, actividad] = await Promise.all([
    getMetricasPlataforma(),
    getVolumenMensual(),
    getActividadReciente(6),
  ]);

  const kpis = metricas
    ? [
        { label: "Pedidos publicados", value: metricas.pedidosPublicados.toLocaleString("es-AR") },
        { label: "Cotizaciones enviadas", value: metricas.cotizaciones.toLocaleString("es-AR") },
        { label: "Volumen transado", value: formatARS(metricas.volumen) },
        { label: "Comisión generada", value: formatARS(metricas.comision) },
      ]
    : [];

  // El gráfico se escala contra su propio máximo. Con la plataforma en cero, `max` sería 0
  // y las alturas quedarían en NaN%.
  const max = Math.max(1, ...meses.map((m) => m.total));
  const sinDatos = !metricas || metricas.cotizaciones === 0;

  return (
    <main>
      <Navbar />
      <section className="pt-32 sm:pt-40 pb-section min-h-screen">
        <div className="container-asymmetric">
          <SectionLabel className="mb-4">Panel analítico</SectionLabel>
          <h1 className="font-display text-display-xl mb-12">Marketplace en números.</h1>

          {sinDatos ? (
            <div className="border border-concrete/15 p-8 sm:p-12">
              <p className="font-display text-body-lg text-ink mb-2">Todavía no hay actividad para medir</p>
              <p className="font-body text-body-md text-concrete max-w-md">
                Cuando se publiquen pedidos y los pintores empiecen a cotizar, acá vas a ver el
                volumen, la comisión y la evolución mes a mes.
              </p>
            </div>
          ) : (
            <>
              {/* KPIs */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-px bg-concrete/15 border border-concrete/15 mb-12">
                {kpis.map((kpi) => (
                  <div key={kpi.label} className="bg-plaster p-4 sm:p-6 lg:p-8 min-w-0">
                    {/* En 390px un monto como "$ 28.029.998" pedía 247px dentro de una celda
                        de 130px: se cortaba y pisaba la celda de al lado, y la página entera
                        scrolleaba de costado. El tamaño baja en móvil y sube desde `sm`. */}
                    <p className="font-display text-display-md sm:text-display-lg leading-none tabular-nums break-words">
                      {kpi.value}
                    </p>
                    <p className="font-body text-body-sm text-concrete mt-2">{kpi.label}</p>
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
                {/* Gráfico */}
                <div className="lg:col-span-8">
                  <h2 className="font-display text-display-md mb-2">Volumen transado por mes</h2>
                  <p className="font-body text-body-sm text-concrete mb-8">
                    Últimos 12 meses · sólo trabajos completados
                  </p>
                  <div className="flex items-end gap-2 h-64 border-b border-concrete/20">
                    {meses.map((m) => (
                      <div key={m.mes} className="flex-1 flex flex-col justify-end h-full group" title={`${formatARS(m.total)}`}>
                        <div
                          className="w-full bg-ink/80 group-hover:bg-ink transition-colors duration-300"
                          style={{ height: `${(m.total / max) * 100}%` }}
                        />
                      </div>
                    ))}
                  </div>
                  <div className="flex gap-2 mt-3">
                    {meses.map((m) => (
                      <span key={m.mes} className="flex-1 text-center font-mono text-mono-sm text-concrete">
                        {m.inicial}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Últimos pedidos reales */}
                <div className="lg:col-span-4">
                  <h2 className="font-display text-display-md mb-8">Actividad reciente</h2>
                  {actividad.length === 0 ? (
                    <p className="font-body text-body-md text-concrete">Todavía no se publicó ningún pedido.</p>
                  ) : (
                    <div className="space-y-4">
                      {actividad.map((a, i) => (
                        <div key={`${a.titulo}-${i}`} className="pb-4 border-b border-concrete/15 last:border-0">
                          <p className="font-body text-body-md text-ink leading-snug">{a.titulo}</p>
                          <div className="flex items-center justify-between mt-1">
                            <span className="font-mono text-mono-sm text-concrete">{a.fecha}</span>
                            <span className="font-mono text-mono-sm text-concrete">
                              {a.cotizaciones} cot.
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      </section>
      <Footer />
    </main>
  );
}
