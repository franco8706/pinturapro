"use client";

import { useEffect } from "react";

/**
 * Último recurso: sólo se muestra si falla el propio root layout (fuentes, providers,
 * globals.css). Por eso tiene que traer su propio <html> y <body> y no puede depender
 * de Tailwind ni de ningún componente del sitio — con estilos inline es lo único que
 * seguro se ve.
 */
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error("[global-error]", error.digest ?? "(sin digest)", error.message);
  }, [error]);

  return (
    <html lang="es">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          background: "#EDEBE6",
          color: "#141414",
          fontFamily: "Inter, system-ui, -apple-system, sans-serif",
        }}
      >
        <div style={{ maxWidth: "34rem", padding: "2rem", margin: "0 auto" }}>
          <p
            style={{
              fontSize: ".75rem",
              letterSpacing: ".05em",
              textTransform: "uppercase",
              color: "#6B6B6B",
              margin: "0 0 1rem",
            }}
          >
            Error del sitio
          </p>
          <h1 style={{ fontSize: "2.25rem", lineHeight: 1.05, margin: "0 0 1rem", fontWeight: 700 }}>
            Pintura Pro no está disponible.
          </h1>
          <p style={{ fontSize: "1.05rem", lineHeight: 1.6, color: "#3a3a3a", margin: "0 0 1.5rem" }}>
            Estamos teniendo un problema para cargar el sitio. Volvé a intentar en un momento.
          </p>
          {error.digest && (
            <p style={{ fontSize: ".8rem", color: "#6B6B6B", margin: "0 0 1.5rem" }}>
              Código de referencia: {error.digest}
            </p>
          )}
          <button
            onClick={reset}
            style={{
              background: "#141414",
              color: "#fff",
              border: 0,
              padding: ".85rem 1.4rem",
              fontSize: ".9rem",
              cursor: "pointer",
            }}
          >
            Reintentar
          </button>
        </div>
      </body>
    </html>
  );
}
