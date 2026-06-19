"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Revela su contenido con un fade + slide al entrar en viewport.
 * Respeta prefers-reduced-motion vía CSS global (transition-duration override).
 */
export function Reveal({
  children,
  className,
  delay = 0,
  as: Tag = "div",
}: {
  children: ReactNode;
  className?: string;
  delay?: number;
  as?: "div" | "section" | "li" | "article";
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.15, rootMargin: "0px 0px -10% 0px" },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return (
    <Tag
      ref={ref as never}
      className={cn(
        "transition-all duration-700 ease-expo-out",
        visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6",
        className,
      )}
      style={{ transitionDelay: `${delay}s` }}
    >
      {children}
    </Tag>
  );
}

export function SectionLabel({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <p className={cn("font-mono text-mono-sm text-concrete uppercase tracking-widest", className)}>{children}</p>
  );
}

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center text-center py-section-sm border border-dashed border-concrete/30">
      <div className="w-12 h-12 rounded-full border border-concrete/30 mb-6 flex items-center justify-center font-mono text-concrete">
        ∅
      </div>
      <h3 className="font-display text-display-md mb-2">{title}</h3>
      {description && <p className="font-body text-body-md text-concrete max-w-sm mb-6">{description}</p>}
      {action}
    </div>
  );
}

export function ErrorState({
  title = "Algo salió mal",
  description = "No pudimos cargar esta información. Probá de nuevo en un momento.",
  onRetry,
}: {
  title?: string;
  description?: string;
  onRetry?: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center text-center py-section-sm">
      <div className="w-12 h-12 rounded-full bg-[#C41E3A]/10 text-[#C41E3A] mb-6 flex items-center justify-center font-mono">
        !
      </div>
      <h3 className="font-display text-display-md mb-2">{title}</h3>
      <p className="font-body text-body-md text-concrete max-w-sm mb-6">{description}</p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="px-6 py-3 border border-ink font-body text-body-sm hover:bg-ink hover:text-bone transition-colors duration-300"
        >
          Reintentar
        </button>
      )}
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("animate-pulse bg-concrete/15 rounded-sm", className)} />;
}

export function LoadingState({ label = "Cargando…" }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-3 py-section-sm text-concrete">
      <span className="w-2 h-2 rounded-full bg-concrete animate-pulse" />
      <span className="font-mono text-mono-sm uppercase tracking-widest">{label}</span>
    </div>
  );
}
