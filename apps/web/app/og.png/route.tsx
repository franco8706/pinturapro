import { ImageResponse } from "next/og";

/**
 * La imagen que acompaña cualquier enlace a Pintura Pro que se comparta por WhatsApp,
 * Facebook o X, cuando la página no tiene una foto propia (ver `lib/tarjeta.ts`).
 *
 * Se arma al compilar y queda fija (`force-static`): no se genera en cada visita ni depende de
 * nada de afuera — la tipografía es la que trae `next/og`. Una dirección estable (`/og.png`)
 * y no la de `opengraph-image`, que lleva un hash, porque las páginas la nombran a mano: Next
 * no hereda la imagen del layout en las páginas que definen su propia tarjeta.
 */
export const dynamic = "force-static";

const MUESTRAS = ["#C0643F", "#D4A24C", "#8A9A7B", "#2F5D6B", "#A39E93", "#141414"];

export function GET() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: "#EDEBE6",
          color: "#141414",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", padding: "72px 80px 0" }}>
          <div style={{ display: "flex", fontSize: 120, letterSpacing: -4, lineHeight: 1 }}>
            <span>Pintura</span>
            <span style={{ color: "#686868" }}>Pro</span>
          </div>
          <div style={{ display: "flex", fontSize: 50, marginTop: 36, lineHeight: 1.15 }}>
            Encontrá pintor y compará cotizaciones
          </div>
          <div style={{ display: "flex", fontSize: 30, marginTop: 24, color: "#686868" }}>
            Pintores independientes · Publicar tu pedido es gratis
          </div>
        </div>
        <div style={{ display: "flex", height: 96 }}>
          {MUESTRAS.map((c) => (
            <div key={c} style={{ flex: 1, background: c }} />
          ))}
        </div>
      </div>
    ),
    { width: 1200, height: 630 },
  );
}
