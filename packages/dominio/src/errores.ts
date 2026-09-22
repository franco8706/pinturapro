/**
 * Traduce el error de la base a algo que una persona pueda entender.
 *
 * Vive en un paquete compartido porque la web y la app móvil tenían cada una su copia, y la
 * del móvil se quedó atrás: le faltaban las ramas del código 23514 (los topes de largo de la
 * migración 0017), del trigger "ya tiene un pintor asignado" y del deadlock. Resultado: la
 * persona llenaba una nota de 2.000 caracteres, enviaba, y leía "No pudimos completar la
 * acción" sin enterarse de que el problema era el largo.
 *
 * También vive fuera de los archivos de acciones porque Next exige que TODO lo que exporta un
 * módulo `"use server"` sea una función async, y este helper es sincrónico.
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
  // 23514: los topes de largo de la migración 0017. El nombre de la constraint dice qué
  // campo es; sin traducir, la persona leía `violates check constraint
  // "projects_title_largo"` y no tenía forma de saber que el problema era el título.
  if (code === "23514" || /violates check constraint/i.test(m)) {
    if (/title_largo/.test(m)) return "El título es demasiado largo (máximo 120 caracteres).";
    if (/description_largo/.test(m)) return "La descripción es demasiado larga (máximo 2000 caracteres).";
    if (/location_largo/.test(m)) return "La ubicación es demasiado larga (máximo 120 caracteres).";
    if (/bio_largo/.test(m)) return "La descripción del perfil es demasiado larga (máximo 1200 caracteres).";
    if (/full_name_largo/.test(m)) return "El nombre es demasiado largo (máximo 120 caracteres).";
    if (/note_largo/.test(m)) return "El mensaje de la cotización es demasiado largo (máximo 1200 caracteres).";
    if (/comment_largo/.test(m)) return "El comentario es demasiado largo (máximo 1200 caracteres).";
    if (/message_largo/.test(m)) return "El mensaje es demasiado largo (máximo 4000 caracteres).";
    if (/email_largo/.test(m)) return "El email es demasiado largo.";
    if (/phone_largo/.test(m)) return "El teléfono es demasiado largo.";
    return "Alguno de los datos es demasiado largo. Revisalo y probá de nuevo.";
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
