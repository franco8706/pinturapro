-- ═══════════════════════════════════════════════════════════════════════════
-- 0023 · Quién es administrador deja de ser público
-- ═══════════════════════════════════════════════════════════════════════════
-- `profiles.is_admin` se podía leer SIN CUENTA: `profiles?select=id,full_name&is_admin=eq.true`
-- con la clave pública devolvía, en un solo pedido, cuál es la única cuenta con máximo
-- privilegio de la plataforma. No es una credencial, pero es el primer paso de un phishing
-- dirigido: ya sabés a quién escribirle. Lo midió el agente `seguridad-rls` (27/9/2026).
--
-- Estaba abierta por una razón: las policies de `leads` preguntaban
-- `exists(select 1 from profiles where id = auth.uid() and is_admin)` con los permisos de
-- quien consulta, y para eso hacía falta poder leer la columna (0010). El arreglo es el mismo
-- patrón que `es_pintor()` (0016): una función `security definer` que contesta sólo sobre
-- quien pregunta, y la columna cerrada para todos.
--
-- ORDEN: la web tiene que dejar de pedir `is_admin` en `getOwnProfile` ANTES de esta
-- migración (va en el mismo cambio). Al revés, el panel falla con "permission denied".

create or replace function public.es_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((select p.is_admin from public.profiles p where p.id = auth.uid()), false);
$$;

-- Las funciones nuevas quedan ejecutables por PUBLIC si no se revoca: la trampa de siempre.
revoke execute on function public.es_admin() from public, anon;
grant execute on function public.es_admin() to authenticated;

comment on function public.es_admin() is
  'Si quien pregunta es administrador. Reemplaza leer profiles.is_admin, que era público (0023).';

-- Las policies de leads, iguales que antes pero preguntándole a la función. Y sólo para
-- authenticated: estaban para `public`, así que anon las evaluaba sin motivo.
drop policy if exists leads_select_admin on public.leads;
create policy leads_select_admin on public.leads
  for select to authenticated
  using (public.es_admin());

drop policy if exists leads_update_admin on public.leads;
create policy leads_update_admin on public.leads
  for update to authenticated
  using (public.es_admin());

-- La columna, cerrada. `profiles` se otorga por columna desde 0006, así que acá el revoke por
-- columna sí hace efecto (en `projects` no lo hacía hasta revocar la tabla: ver 0020).
revoke select (is_admin) on public.profiles from anon, authenticated;

-- ── recalc_profile_rating ──
-- Cualquier cuenta podía llamarla con el id de OTRO perfil y dispararle una escritura, a
-- demanda y sin tope. No corrompe nada (recalcula desde `reviews`), pero no tiene por qué
-- estar abierta: la única que la llama es el trigger `on_review_change`, que es `security
-- definer` y corre con los permisos del dueño. 0018 le sacó el permiso a anon; éste es el que
-- quedaba.
revoke execute on function public.recalc_profile_rating(uuid) from authenticated;
