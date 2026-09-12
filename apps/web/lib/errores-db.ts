/**
 * Traduce el error de la base a algo que una persona pueda entender.
 *
 * Vive en `lib/` y no dentro de un archivo de acciones porque lo necesitan varios: Next exige
 * que TODO lo que exporta un módulo `"use server"` sea una función async, así que un helper
 * sincrónico no se puede compartir desde ahí.
 *
 * Sin esto el usuario veía en pantalla cosas como `new row violates row-level security policy
 * for table "jobs"` o el nombre de un índice: además de incomprensible y en inglés, filtra
 * nombres de tablas, constraints y policies.
 */
export function mensajeDeError(error: { message?: string; code?: string }): string {
  const m = error?.message ?? "";
  const code = error?.code ?? "";

  if (code === "23505" || /duplicate key/i.test(m)) {
    if (/uniq_jobs_quote_viva/.test(m)) return "Ya enviaste una cotización para este pedido.";
    return "Ese registro ya existe.";
  }
  if (code === "42501" || /row-level security/i.test(m)) {
    return "No podés hacer esa acción sobre este trabajo.";
  }
  if (/Transición no permitida/i.test(m)) {
    return "Ese cambio de estado no está permitido para este trabajo.";
  }
  // El trigger de 0015: alguien más se quedó con el pedido mientras mirabas la pantalla.
  if (/ya tiene un pintor asignado/i.test(m)) {
    return "Este pedido ya tiene un pintor asignado.";
  }
  // 40P01: dos personas aceptando cotizaciones del mismo pedido a la vez. La base resuelve
  // bien (gana una sola), pero sin traducir el perdedor leía "No pudimos completar la acción".
  if (code === "40P01" || /deadlock detected/i.test(m)) {
    return "Alguien más estaba operando sobre este pedido. Actualizá la página y probá de nuevo.";
  }
  if (/monto|comisión/i.test(m) && /no puede|no corresponde|fuera de rango/i.test(m)) {
    return m; // los raise del trigger ya están escritos para el usuario
  }
  if (/fetch failed|network|ENOTFOUND/i.test(m)) {
    return "No pudimos conectar con el servidor. Probá de nuevo en un momento.";
  }
  console.error("[accion] error sin traducir:", m);
  return "No pudimos completar la acción. Probá de nuevo.";
}
