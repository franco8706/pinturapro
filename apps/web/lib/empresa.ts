/**
 * Los datos de la empresa que la web afirma en público.
 *
 * Existe porque estaban desparramados en el código como valores de relleno que se leían como
 * hechos: la home anunciaba "+340 obras entregadas" (la base tiene 3), "12 años de oficio",
 * "100% garantía escrita" —un compromiso legal sin nada detrás— y la página de contacto daba
 * un WhatsApp `+54 9 11 5555-0123`, que es un número de ejemplo.
 *
 * Nada de eso se puede inventar desde acá: son datos que sólo tiene el dueño. La regla de
 * este archivo es simple: **lo que está en `null` no se muestra**. Preferimos una sección con
 * un dato menos antes que una cifra inventada.
 *
 * Las que SÍ se pueden calcular (reseñas, obras publicadas) no viven acá: salen de la base.
 */

export interface DatoEmpresa {
  /** null = todavía no hay dato real. La UI omite la tarjeta en vez de inventar. */
  value: number | null;
  prefix?: string;
  suffix?: string;
  decimals?: number;
  label: string;
}

/**
 * TODO(dueño): completar con los números reales y borrar los `null`.
 * Mientras estén en null, la home muestra sólo las métricas que salen de la base.
 */
export const DATOS_EMPRESA: DatoEmpresa[] = [
  // Años que la empresa lleva trabajando. Lo sabe el dueño; no hay forma de derivarlo.
  { value: null, prefix: "", suffix: "", decimals: 0, label: "Años de oficio" },
  // Obras entregadas fuera de la plataforma (las de acá se cuentan solas).
  { value: null, prefix: "+", suffix: "", decimals: 0, label: "Obras entregadas" },
];

/**
 * Datos de contacto.
 *
 * TODO(dueño): reemplazar los `null` por los reales. Un WhatsApp de ejemplo en producción
 * significa que alguien que quiere contratar escribe a un número que no existe.
 */
export const CONTACTO = {
  email: "hola@pinturapro.ar",
  /** Sólo dígitos con código de país, como lo pide wa.me. Ej: "5491122334455". */
  whatsapp: null as string | null,
  instagram: null as string | null,
  taller: "Barracas, CABA — con cita previa",
  horario: "Lun a Vie, 8 a 18hs",
};

/** El número tal como lo escribe una persona, a partir del formato de wa.me. */
export function whatsappLegible(numero: string): string {
  const d = numero.replace(/\D/g, "");
  if (d.startsWith("549") && d.length >= 12) {
    return `+54 9 ${d.slice(3, 5)} ${d.slice(5, 9)}-${d.slice(9)}`;
  }
  return `+${d}`;
}
