"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { eliminarMiCuenta } from "./actions";
import { cn } from "@/lib/utils";

/**
 * Confirmación de baja.
 *
 * Se pide escribir la palabra a mano en lugar de un "¿estás seguro?": un borrado que no se
 * puede deshacer no puede depender de un clic mal dado, y el diálogo de confirmación se
 * aprieta sin leer.
 */
export function BorrarCuenta() {
  const router = useRouter();
  const [confirmacion, setConfirmacion] = useState("");
  const [error, setError] = useState("");
  const [enviando, setEnviando] = useState(false);
  // Cerrojo sincrónico: `disabled` recién se ve al repintar, y acá un doble clic dispararía
  // dos bajas (ver el mismo patrón en /contacto).
  const enVuelo = useRef(false);
  const confirmado = confirmacion.trim().toUpperCase() === "ELIMINAR";

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (enVuelo.current) return;
        enVuelo.current = true;
        setError("");
        void (async () => {
          setEnviando(true);
          try {
            const res = await eliminarMiCuenta(confirmacion);
            if (res?.error) setError(res.error);
            else {
              // A una página pública, no a ésta: acá ya no hay sesión, y esta pantalla la
              // exige, así que el servidor mandaba a /ingresar. La persona apretaba
              // "eliminar" y le aparecía un formulario de login, sin una palabra de
              // confirmación. Medido en el navegador.
              router.replace("/cuenta-eliminada");
            }
          } catch (err) {
            console.error("[baja] falló:", err);
            setError("No pudimos completar la baja. Revisá tu conexión y probá de nuevo.");
          } finally {
            setEnviando(false);
            enVuelo.current = false;
          }
        })();
      }}
      className="space-y-4"
    >
      <label className="block">
        <span className="font-body text-body-sm text-ink">
          Para confirmar, escribí <strong>ELIMINAR</strong>
        </span>
        <input
          type="text"
          value={confirmacion}
          onChange={(e) => setConfirmacion(e.target.value)}
          autoComplete="off"
          aria-describedby={error ? "error-baja" : undefined}
          className="mt-2 w-full sm:w-64 border border-concrete/30 bg-plaster px-3 py-2 font-body text-body-md text-ink focus:border-ink outline-none transition-colors"
        />
      </label>

      {error && (
        <p id="error-baja" role="alert" className="font-body text-body-sm text-[#C41E3A]">
          {error}
        </p>
      )}

      {/* El botón se puede apretar siempre —deshabilitado no se enfoca con teclado, y quien
          navega así no podría enterarse de qué falta— pero tiene que VERSE que todavía no
          está listo. Sin esta pista, alguien que mira la pantalla no tiene forma de saber
          que el texto está mal hasta que aprieta. */}
      <button
        type="submit"
        disabled={enviando}
        aria-disabled={!confirmado}
        className={cn(
          "inline-flex items-center px-6 py-3 border font-body text-body-sm transition-colors disabled:cursor-not-allowed",
          confirmado
            ? "border-[#C41E3A] text-[#C41E3A] hover:bg-[#C41E3A] hover:text-bone"
            : "border-concrete/30 text-concrete",
        )}
      >
        {enviando ? "Eliminando…" : "Eliminar mi cuenta definitivamente"}
      </button>
    </form>
  );
}
