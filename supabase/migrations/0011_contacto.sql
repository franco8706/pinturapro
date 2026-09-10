-- 0011: cliente y pintor se pasan el teléfono cuando el trabajo ya es un trabajo.
--
-- Hasta acá el producto no permitía coordinar nada. Un pintor ganaba una cotización y no
-- tenía cómo llamar al cliente; el cliente aceptaba y no tenía cómo decirle a qué hora
-- abrirle la puerta. `profiles.phone` existía desde 0001 pero ningún formulario lo escribía,
-- y 0006 le revocó el SELECT a anon/authenticated (con razón: la RLS de `profiles` es
-- `using (true)`, así que un grant de columna sería el teléfono de todos, público).
--
-- La salida no es aflojar el grant sino preguntar por el vínculo: estas dos funciones son
-- `security definer` (leen `phone` salteando el grant) pero sólo devuelven algo cuando quien
-- pregunta tiene derecho a saberlo.

-- ── El teléfono propio ────────────────────────────────────────────────
-- Para precargar el formulario de perfil. Sin esto el dueño tampoco puede leer su propio
-- teléfono, y el campo aparecería vacío cada vez, invitando a pisarlo sin querer.
create or replace function public.mi_telefono()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select phone from public.profiles where id = auth.uid();
$$;

-- ── El teléfono de la contraparte ─────────────────────────────────────
-- Devuelve a la OTRA parte del trabajo, y sólo si:
--   · quien pregunta es una de las dos partes de ESE trabajo, y
--   · el trabajo ya está en marcha.
--
-- 'quoted' queda deliberadamente afuera: si cotizar alcanzara para ver el teléfono,
-- cualquiera se registraría de pintor, cotizaría todo lo publicado a cualquier precio y
-- se llevaría la agenda entera. El dato se libera cuando el cliente eligió, que es también
-- cuando empieza a hacer falta.
create or replace function public.contacto_del_trabajo(job_id uuid)
returns table (nombre text, telefono text)
language sql
stable
security definer
set search_path = public
as $$
  select p.full_name, p.phone
  from public.jobs j
  join public.profiles p
    on p.id = case
                when j.client_id = auth.uid() then j.painter_id
                else j.client_id
              end
  where j.id = job_id
    and (j.client_id = auth.uid() or j.painter_id = auth.uid())
    and j.status in ('accepted', 'in_progress', 'completed');
$$;

-- Sin sesión no hay vínculo que mirar: las dos funciones dependen de auth.uid().
--
-- Hacen falta LOS DOS revokes, y por razones distintas:
--   · PUBLIC  → Postgres le da EXECUTE a PUBLIC en toda función nueva.
--   · anon    → Supabase, además, tiene un ALTER DEFAULT PRIVILEGES que le otorga EXECUTE
--               explícitamente sobre cada función que nace en el schema public.
-- Sacárselo sólo a PUBLIC deja el grant nominal de `anon` intacto (verificado en pg_proc:
-- quedaba `anon=X/postgres`). No filtraba nada, porque sin JWT auth.uid() es null y la
-- consulta no devuelve filas — pero toda la defensa quedaba colgando de ese único detalle.
revoke execute on function public.mi_telefono() from public, anon;
revoke execute on function public.contacto_del_trabajo(uuid) from public, anon;
grant execute on function public.mi_telefono() to authenticated;
grant execute on function public.contacto_del_trabajo(uuid) to authenticated;

comment on function public.contacto_del_trabajo(uuid) is
  'Teléfono y nombre de la contraparte de un trabajo en marcha. security definer: lee phone '
  'salteando el grant de columna de 0006, pero sólo para quien es parte del trabajo.';
