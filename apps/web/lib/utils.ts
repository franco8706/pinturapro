import { COMISION, comisionDe } from "@pinturapro/dominio";
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

/**
 * Comisión del marketplace: se reexporta de `@pinturapro/dominio`, no se calcula acá.
 *
 * Este bloque decía "Fuente única" y era una SEGUNDA copia de la fórmula: el formulario le
 * mostraba al pintor la comisión con `comisionDe` (del paquete) y la acción guardaba la de
 * acá. Hoy daban lo mismo, pero nada las ataba — y este proyecto ya tuvo el checkout
 * mostrando 8% mientras `cotizar()` guardaba 10%. Lo marcó el agente `dinero-y-comisiones`.
 * La prueba `reglas-compartidas` verifica que acá no vuelva a aparecer una fórmula propia.
 */

export const COMMISSION_RATE = COMISION;

/** Comisión en pesos para un monto dado. */
export const commissionFor = comisionDe;
