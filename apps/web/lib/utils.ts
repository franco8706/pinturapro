import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Escapa texto para interpolarlo dentro de HTML.
 *
 * Obligatorio para cualquier dato que venga del usuario y termine en markup que no
 * pasa por React: el HTML de los marcadores del mapa y, sobre todo, el cuerpo de los
 * emails. Sin esto, la nota de una cotización puede inyectar links de phishing en un
 * mail que sale desde nuestro dominio.
 */
export function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
}
