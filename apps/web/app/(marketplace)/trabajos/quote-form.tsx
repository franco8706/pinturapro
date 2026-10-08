"use client";

import { useEffect, useRef, useState } from "react";
import { cotizar } from "../actions";
import Link from "next/link";
import { montoDesdeTexto, motivoCotizacionInvalida } from "@pinturapro/dominio";

/** Formulario inline para que un pintor cotice un pedido de trabajo. */
export function QuoteForm({ projectId, clientId }: { projectId: string; clientId: string }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  // La base no deja cotizar sin suscripción (0027): además del motivo, el camino para resolverlo.
  const [sinSuscripcion, setSinSuscripcion] = useState(false);
  const [sent, setSent] = useState(false);
  /**
   * Lo que se escribió en el campo, para devolverlo interpretado.
   *
   * El campo es texto libre —`inputMode="numeric"` es sólo una pista para el teclado del
   * celular, no filtra nada— y hasta acá nadie le mostraba al pintor el número que iba a
   * salir. Con el parser viejo, pegar un monto copiado de una planilla en inglés
   * ("1,500,000") mandaba una cotización por UN PESO sin ningún aviso. El parser ahora
   * rechaza eso, pero la defensa de verdad es esta: que el número se vea escrito en pesos
   * antes de apretar enviar. Un cero de más se descubre mirando, no
   * validando.
   */
  const [monto, setMonto] = useState("");
  const montoLeido = montoDesdeTexto(monto);
  // Además de entenderse, tiene que ser una cotización posible: $1 pasaba sin objeción.
  const motivo = motivoCotizacionInvalida(monto);
  /**
   * Lo que se anuncia a un lector de pantalla, con espera.
   *
   * El texto de arriba se reescribía en cada tecla y era la zona hablada: escribir "320000"
   * eran seis anuncios completos ($3, $32, … $320.000) que el lector encola uno tras otro, en
   * la única pantalla donde un pintor decide plata. Mismo error que ya se había corregido en
   * el simulador; lo marcó el agente `accesibilidad`. Ahora lo visible cambia al instante y lo
   * hablado espera a que la persona deje de escribir.
   */
  const [anuncio, setAnuncio] = useState("");
  useEffect(() => {
    if (!monto.trim()) return setAnuncio("");
    const t = setTimeout(() => {
      const n = montoDesdeTexto(monto);
      setAnuncio(
        n === null || motivoCotizacionInvalida(monto)
          ? motivoCotizacionInvalida(monto) ?? ""
          : `Vas a cotizar ${n.toLocaleString("es-AR")} pesos.`,
      );
    }, 700);
    return () => clearTimeout(t);
  }, [monto]);

  /**
   * Cerrojo sincrónico contra el doble envío. `disabled={loading}` no alcanza: el estado de
   * React recién se ve después de repintar, así que varios clics dentro del mismo instante
   * entran todos. Medido en /contacto: tres clics seguidos crearon TRES consultas.
   */
  const enviando = useRef(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (enviando.current) return;
    enviando.current = true;
    setError("");
    setSinSuscripcion(false);
    setLoading(true);
    const fd = new FormData(e.currentTarget);
    fd.set("project_id", projectId);
    fd.set("client_id", clientId);
    // Se manda lo que la pantalla MUESTRA, no lo que haya en el campo. El agente
    // `formularios-hostiles` pisó el valor del input sin avisarle a React —como hace un
    // autocompletado o una extensión—: la pantalla siguió diciendo "Vas a cotizar $100.000" y
    // se guardó una cotización por $1. El eco del monto es la defensa contra un cero de más;
    // si lo enviado puede ser otra cosa, no defiende nada.
    fd.set("amount", monto);
    try {
      const res = await cotizar(fd);
      if (res?.error) {
        setError(res.error);
        setSinSuscripcion(res.codigo === "sin_suscripcion");
        return;
      }
      setSent(true);
    } catch (err) {
      // Sin este catch, un rechazo de la promesa dejaba el botón clavado en "Enviando…".
      console.error("[cotizar] falló:", err);
      setError("No pudimos enviar la cotización. Revisá tu conexión y probá de nuevo.");
    } finally {
      setLoading(false);
      enviando.current = false;
    }
  }

  if (sent) {
    return <p className="mt-4 font-body text-body-sm text-[#2D5A3D]">✓ Cotización enviada. El cliente la verá en su panel.</p>;
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mt-4 px-5 py-2.5 bg-ink text-bone font-body text-body-sm hover:bg-ink/90 transition-colors"
      >
        Cotizar este trabajo
      </button>
    );
  }

  return (
    <form onSubmit={onSubmit} className="mt-4 space-y-3 border-t border-concrete/15 pt-4">
      <div className="flex flex-col sm:flex-row gap-3">
        <label className="block">
          <span className="font-mono text-mono-sm uppercase tracking-widest text-concrete">Monto (ARS)</span>
          <input
            name="amount"
            inputMode="numeric"
            required
            placeholder="320000"
            aria-describedby="aviso-precio"
            value={monto}
            onChange={(e) => setMonto(e.target.value)}
            className="mt-1 w-full sm:w-44 border border-concrete/30 bg-plaster px-3 py-2 font-body text-body-md text-ink focus:border-ink outline-none transition-colors"
          />
        </label>
      </div>

      {/* El número, de vuelta y en criollo. `aria-live` para que también se escuche: quien no
          ve la pantalla necesita esta confirmación más que nadie. */}
      <p className="sr-only" role="status" aria-live="polite">
        {anuncio}
      </p>
      {monto.trim() !== "" && (
        <p className="font-body text-body-sm">
          {montoLeido === null || motivo ? (
            <span className="text-[#C41E3A]">{motivo}</span>
          ) : (
            <span className="text-concrete">
              Vas a cotizar{" "}
              <strong className="text-ink">${montoLeido.toLocaleString("es-AR")}</strong>.
              {/* Los montos se guardan en pesos enteros (`amount` es int4) y el parser descarta
                  los centavos. El número de arriba ya era el entero, pero no decía que algo
                  se había dejado afuera: "234.567,89" mostraba $234.567 sin explicación. Lo
                  marcó el agente `dinero-y-comisiones`. */}
              {/,\d{1,2}\s*$/.test(monto) && !/,0{1,2}\s*$/.test(monto)
                ? " Los centavos no se cotizan: el monto va en pesos enteros."
                : ""}
            </span>
          )}
        </p>
      )}
      {/* Hasta el 6/10/2026 acá se avisaba un 10 % de comisión sobre el trabajo adjudicado, que
          nunca se cobró. Desde entonces el pintor paga una suscripción fija y la plataforma no
          toca el precio del trabajo: el cliente le paga todo al pintor. */}
      <p id="aviso-precio" className="font-body text-body-sm text-concrete">
        Poné el precio final para el cliente, con materiales y mano de obra. El cliente te paga a
        vos el total: Pintura Pro no cobra comisión sobre tus trabajos.
      </p>
      <label className="block">
        <span className="font-mono text-mono-sm uppercase tracking-widest text-concrete">Mensaje</span>
        <textarea
          name="note"
          rows={3}
          placeholder="Qué incluye, materiales, plazos…"
          aria-describedby="aviso-contacto"
          className="mt-1 w-full border border-concrete/30 bg-plaster px-3 py-2 font-body text-body-md text-ink focus:border-ink outline-none transition-colors resize-y"
        />
        {/* El cliente tenía su aviso ("poné el barrio, no la dirección"); el pintor, ninguno, y
            la nota se ve ANTES de aceptar (abuso-marketplace, 2/10). */}
        <span id="aviso-contacto" className="block mt-1 font-body text-body-sm text-concrete">
          Sin teléfono ni mail: tu contacto se le comparte al cliente cuando acepta tu cotización.
        </span>
      </label>
      {error && (
        <p role="alert" className="font-body text-body-sm text-[#C41E3A]">
          {error}
          {sinSuscripcion && (
            <>
              {" "}
              <Link href="/dashboard/plan" className="underline underline-offset-4 text-ink">
                Ir a Mi plan
              </Link>
            </>
          )}
        </p>
      )}
      <div className="flex gap-3">
        <button
          type="submit"
          disabled={loading}
          className="px-5 py-2.5 bg-ink text-bone font-body text-body-sm hover:bg-ink/90 transition-colors disabled:opacity-50"
        >
          {loading ? "Enviando…" : "Enviar cotización"}
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="px-5 py-2.5 border border-concrete/30 font-body text-body-sm hover:border-ink transition-colors"
        >
          Cancelar
        </button>
      </div>
    </form>
  );
}
