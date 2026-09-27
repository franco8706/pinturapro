-- ═══════════════════════════════════════════════════════════════════════════
-- 0022 · Las consultas entran sólo por el formulario
-- ═══════════════════════════════════════════════════════════════════════════
-- Los formularios públicos (/cotizar, /contacto, /registro) tienen dos defensas contra el
-- spam: un campo trampa que sólo completan los robots y un límite de 5 envíos por hora. Las
-- dos viven en el servidor, en `app/(marketing)/actions.ts`.
--
-- Pero la policy `leads_insert_any` (0007) dejaba insertar directo en la tabla con la clave
-- pública, que viaja en el código de la página. Quien la usaba se salteaba las dos defensas.
-- Medido por el agente `seguridad-rls` (27/9/2026): seis consultas en 0,43 segundos con un
-- curl, sin cuenta. Con los avisos por email activos, eso es la casilla de la empresa
-- inundada, y la tabla de prospectos llena de basura.
--
-- Desde el mismo cambio, la acción del servidor guarda con la clave de servicio DESPUÉS de
-- sus controles. Así que a anon y authenticated ya no les hace falta insertar: se les saca.
-- Leer y actualizar siguen como estaban (sólo administración, 0007/0010).
--
-- ORDEN: aplicar esta migración DESPUÉS de desplegar la versión de la web que guarda con la
-- clave de servicio. Al revés, los formularios dejan de funcionar hasta el despliegue.

drop policy if exists leads_insert_any on public.leads;
revoke insert on public.leads from anon, authenticated;
