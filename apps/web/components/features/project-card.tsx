"use client";

import Link from "next/link";
import { useState } from "react";
import { cn } from "@/lib/utils";

interface ProjectCardProps {
  title: string;
  location: string;
  category: string;
  accentColor: string;
  imageSrc: string;
  slug: string;
  index?: number;
}

export function ProjectCard({ title, location, category, accentColor, imageSrc, slug, index = 0 }: ProjectCardProps) {
  const [hovered, setHovered] = useState(false);

  return (
    <Link
      href={`/obras/${slug}`}
      className="group block"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{ transitionDelay: `${index * 0.04}s` }}
    >
      <div className="relative aspect-[4/5] overflow-hidden bg-mist">
        {/* INTEGRACIÓN: reemplazar placeholder por <Image> con asset real (Sanity/CDN) */}
        <div className="absolute inset-0 flex items-center justify-center bg-concrete/10">
          <span className="font-mono text-mono-sm text-concrete">{imageSrc}</span>
        </div>
        <div
          className={cn(
            "absolute inset-0 mix-blend-multiply transition-opacity duration-500 ease-expo-out",
            hovered ? "opacity-100" : "opacity-0",
          )}
          style={{ backgroundColor: accentColor }}
        />
        <div className="absolute top-4 left-4 flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: accentColor }} />
          <span className="font-mono text-mono-sm text-ink/80 bg-bone/80 px-2 py-0.5">{category}</span>
        </div>
      </div>
      <div className="mt-5 flex items-baseline justify-between gap-4">
        <div>
          <h3 className="font-display text-display-md leading-tight group-hover:text-ink transition-colors">{title}</h3>
          <p className="font-body text-body-sm text-concrete mt-1">{location}</p>
        </div>
        <span
          aria-hidden
          className="font-mono text-body-lg text-concrete transition-transform duration-300 ease-expo-out group-hover:translate-x-1 group-hover:text-ink"
        >
          →
        </span>
      </div>
    </Link>
  );
}
