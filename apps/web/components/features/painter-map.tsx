"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { Painter } from "@/lib/data";
import { escapeHtml } from "@/lib/utils";
// Next resuelve el CSS en build; el componente ya se carga con `ssr:false`.
import "leaflet/dist/leaflet.css";

/**
 * Mapa real de pintores por zona (Leaflet + OpenStreetMap).
 *
 * Por qué OSM y no Google/Mapbox: no necesita cuenta, ni API key, ni tarjeta, ni tiene
 * cuota mensual. La capa de tiles está aislada en `TILE_LAYER`, así que migrar a otro
 * proveedor es cambiar esa constante (y sumar su key) sin tocar el resto del componente.
 *
 * Leaflet toca `window` al importarse, así que la página lo carga con `dynamic(ssr:false)`.
 */

const TILE_LAYER = {
  url: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
  attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
  maxZoom: 19,
};

/** AMBA: centro y zoom que encuadran CABA + primer cordón. */
const CENTER: [number, number] = [-34.61, -58.45];
const ZOOM = 11;

interface PainterMapProps {
  painters: Painter[];
  /** Pintor resaltado (sincroniza con la lista lateral). */
  activeId?: string | null;
  onSelect?: (id: string | null) => void;
}

export function PainterMap({ painters, activeId, onSelect }: PainterMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  // `L.Map` y `L.Marker` sin importar el tipo en el módulo (Leaflet se carga en runtime).
  const mapRef = useRef<import("leaflet").Map | null>(null);
  const markersRef = useRef<Map<string, import("leaflet").Marker>>(new Map());
  const [ready, setReady] = useState(false);
  const router = useRouter();

  // Sólo los que tienen ubicación cargada entran al mapa. Memoizado: si se recalculara en
  // cada render, el efecto de abajo recrearía los marcadores y re-encuadraría el mapa con
  // sólo pasar el mouse por la lista.
  const located = useMemo(
    () => painters.filter((p) => typeof p.lat === "number" && typeof p.lng === "number"),
    [painters],
  );

  // ── Montaje del mapa (una sola vez) ──
  useEffect(() => {
    let cancelled = false;

    (async () => {
      const L = (await import("leaflet")).default;
      if (cancelled || !containerRef.current || mapRef.current) return;

      const map = L.map(containerRef.current, {
        center: CENTER,
        zoom: ZOOM,
        scrollWheelZoom: false, // no secuestra el scroll de la página
        attributionControl: true,
      });
      L.tileLayer(TILE_LAYER.url, { attribution: TILE_LAYER.attribution, maxZoom: TILE_LAYER.maxZoom }).addTo(map);
      mapRef.current = map;
      setReady(true);
    })();

    return () => {
      cancelled = true;
      mapRef.current?.remove();
      mapRef.current = null;
      markersRef.current.clear();
    };
  }, []);

  // ── Marcadores ──
  // `divIcon` en vez del pin por defecto: evita el problema clásico de rutas de assets con
  // bundlers y deja estilar el marcador con los tokens del design system.
  useEffect(() => {
    if (!ready || !mapRef.current) return;
    let cancelled = false;

    (async () => {
      const L = (await import("leaflet")).default;
      const map = mapRef.current;
      if (cancelled || !map) return;

      for (const m of markersRef.current.values()) m.remove();
      markersRef.current.clear();

      for (const p of located) {
        const icon = L.divIcon({
          className: "", // sin estilos propios de Leaflet
          html: `
            <div style="transform:translate(-50%,-50%)">
              <div data-pin style="
                display:flex;align-items:center;gap:6px;
                background:#FFFFFF;color:#141414;
                border:1px solid rgba(107,107,107,.35);
                padding:5px 9px;white-space:nowrap;
                font-family:Inter,system-ui,sans-serif;font-size:12px;line-height:1;
                box-shadow:0 1px 4px rgba(0,0,0,.14);
                transition:background .2s,color .2s,border-color .2s;
              ">
                <span style="font-weight:500">${escapeHtml(p.name)}</span>
                <span style="opacity:.65">★ ${p.rating.toFixed(1)}</span>
              </div>
            </div>`,
        });

        const marker = L.marker([p.lat as number, p.lng as number], { icon, title: p.name })
          .addTo(map)
          .on("click", () => {
            onSelect?.(p.id);
            router.push(`/pintor/${p.id}`);
          });
        markersRef.current.set(p.id, marker);
      }

      // Encuadrar todos los pintores (con margen), sólo si hay más de uno.
      if (located.length > 1) {
        const bounds = L.latLngBounds(located.map((p) => [p.lat as number, p.lng as number]));
        map.fitBounds(bounds, { padding: [56, 56], maxZoom: 13 });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [ready, located, onSelect, router]);

  // ── Resaltado ──
  // Se pinta sobre el DOM del marcador ya creado en vez de reconstruirlo: el hover en la
  // lista no debe recrear marcadores ni mover el encuadre del mapa.
  useEffect(() => {
    for (const [id, marker] of markersRef.current) {
      const pin = marker.getElement()?.querySelector<HTMLElement>("[data-pin]");
      if (!pin) continue;
      const active = id === activeId;
      pin.style.background = active ? "#141414" : "#FFFFFF";
      pin.style.color = active ? "#FFFFFF" : "#141414";
      pin.style.borderColor = active ? "#141414" : "rgba(107,107,107,.35)";
      // El activo va arriba de los demás.
      if (active) marker.setZIndexOffset(1000);
      else marker.setZIndexOffset(0);
    }
  }, [activeId, located]);

  return (
    <div className="relative">
      <div
        ref={containerRef}
        className="aspect-[4/3] w-full bg-mist border border-concrete/15 z-0"
        role="application"
        aria-label="Mapa de pintores por zona"
      />
      {located.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <p className="font-body text-body-md text-concrete bg-bone/90 px-4 py-2">
            Todavía ningún pintor cargó su ubicación.
          </p>
        </div>
      )}
    </div>
  );
}
