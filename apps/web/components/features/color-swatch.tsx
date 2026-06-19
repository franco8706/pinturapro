"use client";

import { cn } from "@/lib/utils";

interface ColorSwatchProps {
  color: string;
  selected?: boolean;
  onClick?: () => void;
  label?: string;
  size?: "sm" | "md" | "lg";
}

const sizes = {
  sm: "w-7 h-7",
  md: "w-9 h-9",
  lg: "w-12 h-12",
};

export function ColorSwatch({ color, selected, onClick, label, size = "md" }: ColorSwatchProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      aria-label={label ?? `Color ${color}`}
      title={label ?? color}
      className={cn(
        "relative shrink-0 rounded-full transition-transform duration-300 ease-expo-out",
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink",
        sizes[size],
        selected ? "scale-110 ring-2 ring-offset-2 ring-ink" : "hover:scale-105",
      )}
      style={{ backgroundColor: color }}
    >
      {selected && (
        <span className="absolute inset-0 flex items-center justify-center text-bone mix-blend-difference text-body-sm">
          ✓
        </span>
      )}
    </button>
  );
}
