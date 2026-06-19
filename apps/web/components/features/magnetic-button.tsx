"use client";

import Link from "next/link";
import { useRef, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { usePrefersReducedMotion } from "@/hooks/use-media-query";

type Variant = "primary" | "secondary" | "ghost";

interface MagneticButtonProps {
  children: ReactNode;
  href?: string;
  onClick?: () => void;
  type?: "button" | "submit";
  variant?: Variant;
  className?: string;
  disabled?: boolean;
}

const variantClasses: Record<Variant, string> = {
  primary: "bg-ink text-bone hover:bg-ink/90",
  secondary: "bg-bone text-ink border border-ink hover:bg-ink hover:text-bone",
  ghost: "bg-transparent text-ink border border-concrete/30 hover:border-ink",
};

/**
 * Botón con efecto magnético: el contenido se desplaza ligeramente hacia el cursor.
 * Respeta prefers-reduced-motion. Renderiza <Link> si recibe `href`, si no <button>.
 */
export function MagneticButton({
  children,
  href,
  onClick,
  type = "button",
  variant = "primary",
  className,
  disabled,
}: MagneticButtonProps) {
  const ref = useRef<HTMLSpanElement>(null);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const reduceMotion = usePrefersReducedMotion();

  const handleMove = (e: React.MouseEvent) => {
    if (reduceMotion || !ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    const x = (e.clientX - (rect.left + rect.width / 2)) * 0.3;
    const y = (e.clientY - (rect.top + rect.height / 2)) * 0.3;
    setOffset({ x, y });
  };

  const reset = () => setOffset({ x: 0, y: 0 });

  const base = cn(
    "group relative inline-flex items-center gap-3 px-7 py-4 font-body text-body-sm",
    "transition-colors duration-300 ease-expo-out select-none",
    "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink",
    disabled && "opacity-50 pointer-events-none",
    variantClasses[variant],
    className,
  );

  const inner = (
    <span
      ref={ref}
      className="inline-flex items-center gap-3 will-change-transform"
      style={{
        transform: `translate(${offset.x}px, ${offset.y}px)`,
        transition: "transform 0.4s cubic-bezier(0.16, 1, 0.3, 1)",
      }}
    >
      {children}
      <span aria-hidden className="transition-transform duration-300 ease-expo-out group-hover:translate-x-1">
        →
      </span>
    </span>
  );

  if (href) {
    return (
      <Link href={href} className={base} onMouseMove={handleMove} onMouseLeave={reset}>
        {inner}
      </Link>
    );
  }

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={base}
      onMouseMove={handleMove}
      onMouseLeave={reset}
    >
      {inner}
    </button>
  );
}
