"use client";

import { useState } from "react";
import { guardarTelefono } from "@/app/(pro)/dashboard/actions";
import { useAccion } from "@/lib/use-accion";

/** Deja sólo dígitos y le pone el 54 de Argentina si el número vino en formato local. */
function aWhatsapp(tel: string): string {
  const d = tel.replace(/\D/g, "");
  if (!d) return "";
  if (d.startsWith("54")) return d;
  // 011 15 4444-5555 → se saca el 0 de la característica y el 15 del celular, que WhatsApp
  // no usa; van con el 9 después del 54, que es como Argentina numera los móviles.
  const sinCero = d.replace(/^0/, "");
  return `549${sinCero.replace(/^(\d{2,4})15/, "$1")}`;
}

/**
 * El punto donde el trabajo se vuelve coordinable.
 *
 * Hasta que existió esto, ganar una cotización no servía de nada: las dos partes quedaban
 * dentro del producto sin una sola forma de contactarse. `profiles.phone` estaba en el
 * esquema desde el día uno y ningún formulario lo escribía nunca.
 *
 * Se muestra únicamente sobre trabajos ya adjudicados, y el teléfono de la contraparte lo
 * resuelve la base (`contacto_del_trabajo`, migración 0011), no esta pantalla: si el trabajo
 * todavía está en 'quoted' la función no devuelve nada, sin importar lo que pida el cliente.
 */
export function ContactoTrabajo({
  jobId,
  contraparte,
  telefonoContraparte,
  miTelefono,
  rol,
}: {
  /** Sólo para dar un id único al input: hay una tarjeta de estas por trabajo, y un id
   *  repetido rompe la asociación del <label> (todos apuntarían al primero). */
  jobId: string;
  contraparte: string;
  telefonoContraparte: string | null;
  miTelefono: string;
  /** Cómo nombrar a la otra parte en el copy. */
  rol: "cliente" | "pintor";
}) {
  const [valor, setValor] = useState(miTelefono);
  const [guardado, setGuardado] = useState(false);
  const { ejecutar, pending, error } = useAccion(guardarTelefono, { onOk: () => setGuardado(true) });

  const yaTengo = miTelefono.trim().length > 0 || guardado;
  const wa = telefonoContraparte ? aWhatsapp(telefonoContraparte) : "";

  return (
    <div className="mt-4 pt-4 border-t border-concrete/15">
      <p className="font-mono text-mono-sm text-concrete uppercase tracking-widest mb-2">Para coordinar</p>

      {telefonoContraparte ? (
        <p className="font-body text-body-md text-ink">
          {contraparte}:{" "}
          <a
            href={`tel:${telefonoContraparte.replace(/\s/g, "")}`}
            className="underline underline-offset-2 tabular-nums"
          >
            {telefonoContraparte}
          </a>
          {wa && (
            <>
              {" · "}
              <a
                href={`https://wa.me/${wa}`}
                target="_blank"
                rel="noopener noreferrer"
                className="underline underline-offset-2"
              >
                WhatsApp
              </a>
            </>
          )}
        </p>
      ) : (
        <p className="font-body text-body-sm text-concrete">
          {contraparte} todavía no cargó un teléfono. Cuando lo haga, te va a aparecer acá.
        </p>
      )}

      {/* El pedido del propio teléfono va acá y no en el perfil: es el momento en que hace
          falta, y el cliente no tiene ninguna pantalla de perfil donde cargarlo. */}
      {!yaTengo && (
        <div className="mt-3">
          <p className="font-body text-body-sm text-concrete mb-2">
            Dejá tu teléfono para que {rol === "pintor" ? "el pintor" : "el cliente"} pueda coordinar con vos.
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <label htmlFor={`tel-${jobId}`} className="sr-only">
              Tu teléfono de contacto
            </label>
            <input
              id={`tel-${jobId}`}
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              value={valor}
              onChange={(e) => setValor(e.target.value)}
              placeholder="11 5555-5555"
              className="px-3 py-2 border border-concrete/30 bg-bone font-body text-body-sm focus-visible:outline-none focus-visible:border-ink"
            />
            <button
              type="button"
              onClick={() => void ejecutar(valor)}
              disabled={pending}
              aria-busy={pending}
              className="px-4 py-2 bg-ink text-bone font-body text-body-sm hover:bg-ink/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {pending ? "Guardando…" : "Guardar"}
            </button>
          </div>
          {error && (
            <p role="alert" className="font-body text-body-sm text-[#C41E3A] mt-2">
              {error}
            </p>
          )}
        </div>
      )}

      {guardado && (
        <p role="status" className="font-body text-body-sm text-[#2D5A3D] mt-2">
          ✓ Teléfono guardado.
        </p>
      )}
    </div>
  );
}
