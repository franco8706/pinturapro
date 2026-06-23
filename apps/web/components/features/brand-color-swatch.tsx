"use client";

import { cn } from "@/lib/utils";
import type { BrandColor } from "@/lib/brands";

interface BrandColorSwatchProps {
  color: BrandColor;
  selected?: boolean;
  onClick?: () => void;
}

/** Muestra de color de marca con nombre y código. */
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
        <p className="font-mono text-mono-sm text-concrete">{color.code ?? color.hex.toUpperCase()}</p>
      </div>
    </button>
  );
}
