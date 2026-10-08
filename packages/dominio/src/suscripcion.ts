/**
 * La suscripción del pintor: cuánto cuesta en pesos, hasta cuándo puede cotizar y qué decirle.
 *
 * Por qué existe (6/10/2026): la plataforma cobraba —en el papel— un 10 % de comisión por
 * trabajo, pero no la cobraba, y no había forma honesta de cobrarla: cliente y pintor se
 * conocen en persona, y cualquier precio que se declare en la plataforma se puede declarar
 * más bajo. El dueño decidió cobrarle al pintor una suscripción fija de US$5 por mes, en
 * pesos al dólar del día, por Mercado Pago, QR o transferencia. Con eso el ingreso deja de
 * depender del monto de ningún trabajo.
 *
 * Todo lo que acá se decide también lo decide la base (`puede_cotizar()`, migración 0027),
 * que es la barrera de verdad: esto sirve para que la pantalla, los mails y las tareas
 * programadas digan y calculen lo mismo, y para poder probarlo sin levantar nada.
 */

/** Días que un débito automático rechazado sigue dando acceso: la ventana en la que Mercado Pago reintenta (4 veces en 10 días). */
export const DIAS_DE_GRACIA = 10;
/** Un QR o una transferencia del mes se calcula con el dólar del día y vale esto; después se genera otro. */
export const VALIDEZ_DEL_COBRO_DIAS = 3;
/** A quien no tiene débito automático se le avisa esto antes del vencimiento, con el monto del día. */
export const AVISO_DIAS_ANTES = 7;
/** Una transferencia vale si llega al menos esto del monto pedido: el dólar se mueve entre que la persona lo ve y transfiere. */
export const TOLERANCIA_TRANSFERENCIA = 0.97;
/** Una cotización que salta más que esto respecto de la anterior no se usa hasta que el dueño la confirme. */
export const SALTO_MAXIMO = 0.1;
/** Si la fuente principal y la de control difieren más que esto, la lectura no se usa. */
export const DIFERENCIA_MAXIMA_FUENTES = 0.05;

/** El texto que ve un pintor al que la base no deja cotizar. Uno solo, para web y móvil, sin precio ni enlace (la app no vende). */
export const MOTIVO_SIN_SUSCRIPCION = "Tu cuenta no tiene una suscripción activa para enviar cotizaciones.";

// ── Fechas ──
// Argentina está en UTC−3 todo el año (sin horario de verano desde 2009). Los servidores
// (Cloud Run) están en UTC: sin fijar la zona, un cobro de las 22 h del 31 se mostraba el 1.

const MS_DIA = 86_400_000;
const DESFASE_AR = -3 * 3_600_000;

/** La fecha en Argentina, como "5/11/2026". */
export function fechaAR(f: Date | string | number): string {
  const d = new Date(new Date(f).getTime() + DESFASE_AR);
  return `${d.getUTCDate()}/${d.getUTCMonth() + 1}/${d.getUTCFullYear()}`;
}

/**
 * Suma un mes calendario en hora argentina. Si el día no existe en el mes siguiente, queda en
 * el último: el 31/1 + 1 mes es el 28/2 (o 29), no el 3/3. Así nadie paga un mes y recibe 28 días
 * de un lado y 34 del otro según cuándo pagó.
 */
export function sumarMes(f: Date | string | number, meses = 1): Date {
  const t = new Date(f).getTime();
  const local = new Date(t + DESFASE_AR);
  const anio = local.getUTCFullYear();
  const mes = local.getUTCMonth() + meses;
  const ultimoDia = new Date(Date.UTC(anio, mes + 1, 0)).getUTCDate();
  const dia = Math.min(local.getUTCDate(), ultimoDia);
  const nuevo = Date.UTC(anio, mes, dia, local.getUTCHours(), local.getUTCMinutes(), local.getUTCSeconds(), local.getUTCMilliseconds());
  return new Date(nuevo - DESFASE_AR);
}

export function sumarDias(f: Date | string | number, dias: number): Date {
  return new Date(new Date(f).getTime() + dias * MS_DIA);
}

// ── El dólar ──

/**
 * Cuánto se cobra en pesos: precio en dólares × dólar vendedor, redondeado HACIA ARRIBA a la
 * centena ($7.700, no $7.693,40). Se cuenta en centavos enteros para que 5 × 1540 no salga
 * 7700,000000001 y suba a $7.800.
 */
export function precioEnPesos(precioUsd: number, venta: number): number {
  const centavos = Math.round(precioUsd * venta * 100);
  return Math.ceil(centavos / 10_000) * 100;
}

export type EstadoCotizacion = "vigente" | "a_confirmar" | "descartada";

/**
 * Qué hacer con una lectura del dólar. Se toca plata: ante la duda, NO se usa, y se sigue
 * cobrando con la última buena (nunca se frena un cobro por la cotización).
 *
 *  · Sin lectura válida de la fuente principal → `null`: no hay nada que guardar.
 *  · La de control difiere más del 5 % → `descartada` (una de las dos está rota).
 *  · Salta más del 10 % respecto de la vigente → `a_confirmar`: la confirma el dueño en /admin.
 *  · Si no → `vigente`. Sin fuente de control, igual vale: alcanza con que no salte.
 */
export function evaluarCotizacion(
  principal: number | null | undefined,
  control: number | null | undefined,
  anterior: number | null | undefined,
  { saltoMaximo = SALTO_MAXIMO, diferenciaMaxima = DIFERENCIA_MAXIMA_FUENTES } = {},
): { estado: EstadoCotizacion; motivo: string } | null {
  const valida = (n: unknown): n is number => typeof n === "number" && Number.isFinite(n) && n > 0;
  if (!valida(principal)) return null;
  if (valida(control) && Math.abs(principal - control) / control > diferenciaMaxima) {
    return { estado: "descartada", motivo: `las fuentes no coinciden: ${principal} contra ${control}` };
  }
  if (valida(anterior) && Math.abs(principal - anterior) / anterior > saltoMaximo) {
    return { estado: "a_confirmar", motivo: `salta ${Math.round((principal / anterior - 1) * 100)} % respecto de ${anterior}` };
  }
  return { estado: "vigente", motivo: valida(control) ? "coincide con la fuente de control" : "sin fuente de control" };
}

// ── El acceso ──

export type TipoMovimiento = "cobro" | "rechazo" | "devolucion" | "contracargo";
export type Movimiento = {
  tipo: TipoMovimiento;
  fecha: Date | string;
  /** El id del pago en el proveedor (o de la línea del extracto). */
  eventoId: string;
  /** En devoluciones y contracargos: el `eventoId` del cobro que anulan. */
  anula?: string | null;
};

/**
 * Hasta cuándo está pago, sumando un mes por cada cobro aprobado, en orden. Cada mes se cuenta
 * desde que vencía el anterior o desde el día del pago si ya había vencido: pagar antes nunca
 * hace perder días, y pagar tarde no regala los días en que no estaba pago. Un cobro devuelto o
 * contracargado no cuenta. Sin cobros, `null`.
 */
export function vigenteHasta(movimientos: Movimiento[], { desde }: { desde?: Date | string | null } = {}): Date | null {
  const anulados = new Set(
    movimientos.filter((m) => (m.tipo === "devolucion" || m.tipo === "contracargo") && m.anula).map((m) => m.anula as string),
  );
  // `desde`: el fin del lanzamiento. Un pago hecho mientras cotizar es gratis no "gasta" su mes
  // en días que ya eran gratis: cuenta desde que termina el lanzamiento.
  const piso = desde ? new Date(desde).getTime() : null;
  const cobros = movimientos
    .filter((m) => m.tipo === "cobro" && !anulados.has(m.eventoId))
    .map((m) => new Date(piso !== null ? Math.max(new Date(m.fecha).getTime(), piso) : new Date(m.fecha).getTime()))
    .sort((a, b) => a.getTime() - b.getTime());
  let hasta: Date | null = null;
  for (const fecha of cobros) {
    const desde: Date = hasta && hasta.getTime() > fecha.getTime() ? hasta : fecha;
    hasta = sumarMes(desde);
  }
  return hasta;
}

export type Modalidad = "debito" | "pago_mensual";

/**
 * Hasta cuándo puede cotizar. La gracia es sólo del débito automático vivo: mientras Mercado
 * Pago reintenta, no se le corta a nadie que está por pagar. Al que paga a mano (QR o
 * transferencia) se le avisa 7 días antes, y una suscripción cancelada llega hasta lo pagado.
 */
export function accesoHasta(vigente: Date | null, modalidad: Modalidad, cancelada: boolean): Date | null {
  if (!vigente) return null;
  return modalidad === "debito" && !cancelada ? sumarDias(vigente, DIAS_DE_GRACIA) : vigente;
}

export type EstadoAcceso = "lanzamiento" | "activa" | "en_gracia" | "vencida" | "sin_suscripcion";

export function estadoDeAcceso({
  ahora = new Date(),
  vigente,
  acceso,
  lanzamientoHasta,
}: {
  ahora?: Date;
  vigente: Date | null;
  acceso: Date | null;
  lanzamientoHasta: Date | null;
}): EstadoAcceso {
  const t = ahora.getTime();
  if (vigente && vigente.getTime() > t) return "activa";
  if (acceso && acceso.getTime() > t) return "en_gracia";
  if (lanzamientoHasta && lanzamientoHasta.getTime() > t) return "lanzamiento";
  return vigente ? "vencida" : "sin_suscripcion";
}

/** Lo que ve el pintor sobre su acceso, en palabras. Sin precio ni enlace: también lo muestra la app. */
export function textoDeAcceso(
  estado: EstadoAcceso,
  { vigente, acceso, lanzamientoHasta }: { vigente?: Date | null; acceso?: Date | null; lanzamientoHasta?: Date | null } = {},
): string {
  switch (estado) {
    case "lanzamiento":
      return lanzamientoHasta
        ? `Cotizar es gratis durante el lanzamiento, hasta el ${fechaAR(lanzamientoHasta)}.`
        : "Cotizar es gratis durante el lanzamiento.";
    case "activa":
      return vigente ? `Tu suscripción está al día hasta el ${fechaAR(vigente)}.` : "Tu suscripción está al día.";
    case "en_gracia":
      return acceso
        ? `Tu último pago no entró. Podés seguir cotizando hasta el ${fechaAR(acceso)}.`
        : "Tu último pago no entró.";
    case "vencida":
      return "Tu suscripción venció: no podés enviar cotizaciones nuevas.";
    case "sin_suscripcion":
      return MOTIVO_SIN_SUSCRIPCION;
  }
}

// ── Transferencias ──

/** El código que el pintor pone en el concepto de la transferencia: "PP-1234". */
export function codigoDeTransferencia(numero: number): string {
  return `PP-${String(Math.trunc(numero)).padStart(4, "0")}`;
}

/** Busca el código en el concepto de una línea del extracto. Los bancos lo recortan o le sacan el guion. */
export function codigoEnTexto(texto: unknown): string | null {
  if (typeof texto !== "string") return null;
  const m = /\bPP[\s\-_.]?0*(\d{1,7})\b/i.exec(texto);
  return m ? codigoDeTransferencia(Number(m[1])) : null;
}

/** Si lo transferido alcanza para el monto pedido (con la tolerancia del dólar que se movió). */
export function transferenciaAlcanza(transferido: number, pedido: number): boolean {
  if (!Number.isFinite(transferido) || !Number.isFinite(pedido) || pedido <= 0) return false;
  return transferido >= Math.floor(pedido * TOLERANCIA_TRANSFERENCIA);
}
