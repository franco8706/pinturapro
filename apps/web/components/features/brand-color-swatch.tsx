"use client";

import { cn } from "@/lib/utils";
import { PALETA_DEMO, type BrandColor } from "@/lib/brands";

interface BrandColorSwatchProps {
  color: BrandColor;
  selected?: boolean;
  onClick?: () => void;
}

/**
 * Muestra de color con nombre y código.
 *
 * Con la paleta de muestra se muestra el hex y no el código: los códigos son inventados, y
 * alguien que los anota y los pide en la pinturería se lleva la pintura equivocada. El hex,
 * en cambio, es exactamente lo que se ve en pantalla y no promete nada sobre un producto.
 */
export function BrandColorSwatch({ color, selected, onClick }: BrandColorSwatchProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={cn(
        "group text-left transition-transform duration-300 ease-expo-out focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink",
        onClick && "hover:-translate-y-1",
      )}
    >
      <div
        className={cn(
          "aspect-square w-full transition-shadow duration-300",
          selected ? "ring-2 ring-offset-2 ring-ink" : "ring-1 ring-inset ring-black/5",
        )}
        style={{ backgroundColor: color.hex }}
      />
      <div className="mt-2">
        <p className="font-body text-body-sm text-ink leading-tight truncate">{color.name}</p>
        <p className="font-mono text-mono-sm text-concrete">
          {!PALETA_DEMO && color.code ? color.code : color.hex.toUpperCase()}
        </p>
      </div>
    </button>
  );
}
