import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Navbar } from "@/components/features/navbar";
import { Footer } from "@/components/features/footer";
import { createClient } from "@/lib/supabase/server";
import { getOwnProfile, getMiAcceso, getCondicionesDeCobroFrescas, getMisPagos, formatARS } from "@/lib/queries";
import { datosDeTransferencia, codigoDelPintor } from "@/lib/pagos/transferencia";
import { fechaAR } from "@pinturapro/dominio";
import { YaTransferi } from "./ya-transferi";

// Pantalla privada: título propio para la pestaña y fuera de los buscadores.
export const metadata: Metadata = { title: "Mi plan", robots: { index: false, follow: false } };

/**
 * La suscripción del pintor (decisión del dueño, 6/10/2026): US$5 por mes, en pesos al dólar
 * oficial del día, por débito de Mercado Pago, QR o transferencia. Reemplaza a la comisión del
 * 10 % por trabajo, que nunca se cobró.
 *
 * Etapa 1: todavía no se cobra. La pantalla muestra el estado, el precio y los medios que van a
 * estar, y dice "Muy pronto". Etapa 3 (8/10/2026): la transferencia ya anda cuando hay cuenta
 * configurada (`TRANSFERENCIA_ALIAS`/`TITULAR`), dólar vigente y el medio encendido en /admin; el
 * débito y el QR de Mercado Pago siguen en "Muy pronto" hasta tener la cuenta del negocio.
 */
const MEDIOS = [
  {
    nombre: "Débito automático con Mercado Pago",
    detalle: "Te suscribís una vez y se cobra solo todos los meses, con tarjeta de crédito, débito o dinero en cuenta.",
  },
  {
    nombre: "QR del mes",
    detalle: "Lo escaneás con la app que uses: Mercado Pago, MODO, la de tu banco o Ualá. Se acredita solo.",
  },
  {
    nombre: "Transferencia",
    detalle: "A la cuenta de Pintura Pro, con tu código en el concepto. Se acredita cuando la confirmamos.",
  },
];

export default async function PlanPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/ingresar?next=/dashboard/plan");

  const profile = await getOwnProfile(user.id);
  if (!profile || !profile.onboarded) redirect("/bienvenida");
  if (profile.type === "client") redirect("/cliente");

  const [acceso, condiciones, pagos] = await Promise.all([
    getMiAcceso(user.id),
    getCondicionesDeCobroFrescas(),
    getMisPagos(user.id),
  ]);
  const plan = condiciones.plan;
  // La transferencia está disponible si hay cuenta, dólar del día y el medio encendido.
  const cuenta = datosDeTransferencia();
  const transferencia =
    cuenta && condiciones.precioArs != null && condiciones.medios.includes("transferencia")
      ? {
          ...cuenta,
          codigo: await codigoDelPintor(user.id).catch((e) => {
            console.error("[plan] no se pudo asignar el código de transferencia:", e instanceof Error ? e.message : e);
            return null;
          }),
        }
      : null;

  return (
    <main>
      <Navbar />
      <section className="pt-32 sm:pt-40 pb-section min-h-screen">
        <div className="container-asymmetric max-w-3xl">
          <Link href="/dashboard" className="font-body text-body-sm text-concrete hover:text-ink transition-colors">
            ← Volver al panel
          </Link>
          <h1 className="font-display text-display-xl mt-4 mb-3">Mi plan</h1>
          <p
            role="status"
            className={`font-body text-body-lg mb-10 ${acceso.puedeCotizar ? "text-concrete" : "text-[#C41E3A]"}`}
          >
            {acceso.texto}
          </p>

          <div className="border border-concrete/15 p-6 sm:p-8 mb-10">
            <p className="font-mono text-mono-sm uppercase tracking-widest text-concrete">
              {plan?.nombre ?? "Plan Pintor"}
            </p>
            <p className="font-display text-display-lg leading-none mt-3">
              US${(plan?.precioUsd ?? 5).toLocaleString("es-AR")}{" "}
              <span className="font-body text-body-lg text-concrete">por mes</span>
            </p>
            {/* El precio está en dólares y se cobra en pesos: el número en pesos se muestra
                siempre con la cotización y la fecha que lo explican. */}
            {condiciones.precioArs != null && condiciones.cotizacion ? (
              <p className="font-body text-body-md text-concrete mt-2">
                Hoy son <strong className="text-ink">{formatARS(condiciones.precioArs)}</strong>, al dólar
                oficial del Banco Nación del {fechaAR(condiciones.cotizacion.leidaEn)} (
                {formatARS(condiciones.cotizacion.venta)}). Se cobra en pesos, con la cotización del día del cobro.
              </p>
            ) : (
              <p className="font-body text-body-md text-concrete mt-2">
                Se cobra en pesos, al dólar oficial del Banco Nación del día del cobro.
              </p>
            )}
            <ul className="mt-6 space-y-2 font-body text-body-md">
              {(plan?.beneficios.length ? plan.beneficios : ["Cotizaciones ilimitadas", "Tu perfil en el directorio de pintores"]).map(
                (b) => (
                  <li key={b} className="flex gap-3">
                    <span aria-hidden="true">✓</span>
                    {b}
                  </li>
                ),
              )}
            </ul>
            <p className="font-body text-body-sm text-concrete mt-6">
              Sin comisión: lo que cobrás por cada trabajo es todo tuyo. El cliente te paga directo a vos.
            </p>
          </div>

          <h2 className="font-display text-display-md mb-2">Cómo vas a poder pagar</h2>
          <p className="font-body text-body-md text-concrete mb-6">
            {transferencia ? "Por ahora, por transferencia; el resto, muy pronto." : "Muy pronto."} Mientras dure el lanzamiento, cotizar es gratis.
            {condiciones.lanzamientoHasta
              ? ` El lanzamiento termina el ${fechaAR(condiciones.lanzamientoHasta)}.`
              : " Antes de que empiece el cobro, la fecha se publica acá y en los términos con al menos 30 días de anticipación."}
          </p>
          <ul className="space-y-3">
            {MEDIOS.map((m) =>
              m.nombre === "Transferencia" && transferencia?.codigo ? (
                <li key={m.nombre} className="border border-ink/40 p-5" id="transferencia">
                  <p className="font-display text-body-lg">Transferencia</p>
                  <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 font-body text-body-sm">
                    <dt className="text-concrete">Alias</dt>
                    <dd className="text-ink font-mono [overflow-wrap:anywhere]">{transferencia.alias}</dd>
                    {transferencia.cbu && (
                      <>
                        <dt className="text-concrete">CBU</dt>
                        <dd className="text-ink font-mono [overflow-wrap:anywhere]">{transferencia.cbu}</dd>
                      </>
                    )}
                    <dt className="text-concrete">Titular</dt>
                    <dd className="text-ink">{transferencia.titular}</dd>
                    <dt className="text-concrete">Monto de hoy</dt>
                    <dd className="text-ink font-mono">{formatARS(condiciones.precioArs)}</dd>
                    <dt className="text-concrete">Tu código</dt>
                    <dd className="text-ink font-mono">{transferencia.codigo}</dd>
                  </dl>
                  <p className="font-body text-body-sm text-concrete mt-3">
                    Poné <strong className="text-ink">{transferencia.codigo}</strong> en el concepto o la referencia: así
                    sabemos que es tuya. Cuando la hagas, avisanos.
                    {condiciones.lanzamientoHasta && new Date(condiciones.lanzamientoHasta).getTime() > Date.now()
                      ? ` Si pagás durante el lanzamiento, tu mes empieza a contar el ${fechaAR(condiciones.lanzamientoHasta)}.`
                      : ""}
                  </p>
                  {pagos.transferenciaPendiente ? (
                    <p role="status" className="mt-4 font-body text-body-sm text-ink">
                      {pagos.transferenciaPendiente.estado === "a_revisar"
                        ? `Recibimos una transferencia con tu código, pero el monto no alcanza para los ${formatARS(pagos.transferenciaPendiente.montoArs)} pedidos: la estamos revisando.`
                        : `Esperamos ${formatARS(pagos.transferenciaPendiente.montoArs)} con el código ${pagos.transferenciaPendiente.codigo}. Lo confirmamos cuando llega a la cuenta (hasta un día hábil).`}
                    </p>
                  ) : (
                    <YaTransferi />
                  )}
                </li>
              ) : (
                <li key={m.nombre} className="border border-concrete/15 p-5">
                  <div className="flex flex-wrap items-baseline justify-between gap-3">
                    <p className="font-display text-body-lg">{m.nombre}</p>
                    <span className="font-mono text-mono-sm uppercase tracking-widest text-concrete">Muy pronto</span>
                  </div>
                  <p className="font-body text-body-sm text-concrete mt-2">{m.detalle}</p>
                </li>
              ),
            )}
          </ul>
          {pagos.historial.length > 0 && (
            <>
              <h2 className="font-display text-display-md mt-12 mb-4">Tus pagos</h2>
              <ul className="space-y-2 font-body text-body-sm">
                {pagos.historial.map((p, i) => (
                  <li key={i} className="flex flex-wrap justify-between gap-3 border-b border-concrete/10 py-2">
                    <span className="text-concrete">{fechaAR(p.fecha)} · {p.medio}</span>
                    <span className="text-ink tabular-nums">
                      {p.tipo === "cobro" ? "" : p.tipo === "devolucion" ? "Devolución " : p.tipo === "contracargo" ? "Contracargo " : "Rechazado "}
                      {formatARS(p.montoArs)}
                    </span>
                  </li>
                ))}
              </ul>
            </>
          )}
          <p className="font-body text-body-sm text-concrete mt-8">
            Podés darte de baja cuando quieras, sin costo: seguís cotizando hasta el final de lo que pagaste. Las
            condiciones completas están en los{" "}
            <Link href="/terminos" className="text-ink underline underline-offset-2">
              términos
            </Link>
            .
          </p>
        </div>
      </section>
      <Footer />
    </main>
  );
}
