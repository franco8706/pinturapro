"use client";

import { useEffect } from "react";
import Link from "next/link";

/**
 * Error boundary de la aplicación.
 *
 * Sin esto, cualquier excepción no atrapada en un Server Component deja al usuario frente a la
 * pantalla de error cruda de Next (en inglés, y en producción sin ninguna explicación).
 * Es especialmente probable acá: la capa de datos cae a mocks cuando Supabase falla, pero
 * cualquier error fuera de esos try/catch llega hasta acá.
 *
 * No mostramos `error.message`: puede traer detalles internos. Sí mostramos el `digest`, que es
 * el identificador que Next escribe en los logs del servidor y permite cruzar el reporte del
 * usuario con la traza real.
 */
export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error("[error-boundary]", error.digest ?? "(sin digest)", error.message);
  }, [error]);

  return (
    <main className="min-h-screen flex items-center bg-plaster text-ink">
      <div className="container-asymmetric w-full py-section">
        <p className="font-mono text-mono-sm text-concrete uppercase tracking-widest mb-4">Algo se rompió</p>
        <h1 className="font-display text-display-lg mb-6 max-w-3xl">
          No pudimos cargar esta página.
        </h1>
        <p className="font-body text-body-lg text-concrete max-w-xl mb-3">
          Fue un problema nuestro, no tuyo. Probá de nuevo en un momento; si sigue pasando, escribinos
          y contanos qué estabas haciendo.
        </p>
        {error.digest && (
          <p className="font-mono text-mono-sm text-concrete/70 mb-10">
            Código de referencia: <span className="text-ink">{error.digest}</span>
          </p>
        )}
        <div className="flex flex-wrap gap-3">
          <button
            onClick={reset}
            className="px-5 py-3 bg-ink text-bone font-body text-body-sm hover:bg-ink/90 transition-colors duration-300"
          >
            Reintentar
          </button>
          <Link
            href="/"
            className="px-5 py-3 border border-ink font-body text-body-sm hover:bg-ink hover:text-bone transition-colors duration-300"
          >
            Ir al inicio
          </Link>
          <Link
            href="/contacto"
            className="px-5 py-3 border border-concrete/40 text-concrete font-body text-body-sm hover:border-ink hover:text-ink transition-colors duration-300"
          >
            Reportar el problema
          </Link>
        </div>
      </div>
    </main>
  );
}
