-- ═══════════════════════════════════════════════════════════════════════════
-- 0016 · Cotizar y publicar obras es de pintores, no de cualquier cuenta
-- ═══════════════════════════════════════════════════════════════════════════
-- Medido en el navegador con una cuenta de tipo 'client' (Marina Acosta):
-- entró a /trabajos, vio "Cotizar este trabajo" en el pedido de OTRA clienta,
-- mandó $111.111 y la base lo aceptó ("Cotización enviada").
--
-- Por qué pasaba: ninguna de las tres capas miraba el rol.
--   · La página mostraba el formulario a cualquiera que no fuera el dueño
--     (`trabajos/page.tsx`: el único caso contemplado era `user.id === r.ownerId`).
--   · La acción `cotizar` sólo rechazaba cotizar el pedido propio.
--   · `jobs_insert_painter_quote` (0015) exige painter_id = auth.uid(), pero
--     nunca exige que ese auth.uid() sea un pintor. El nombre de la policy dice
--     "painter" y por eso pasó desapercibido en las revisiones anteriores.
--
-- Consecuencia real, no teórica: el marketplace quedaba abierto a que cualquiera
-- con una cuenta gratis se hiciera pasar por pintor, cobrara una seña y
-- desapareciera. La plataforma además devenga comisión sobre ese trabajo.
--
-- Lo mismo con las obras: `projects_modify_own` era `for all` sin mirar el tipo,
-- así que una cuenta de cliente podía publicar portfolio y aparecer en /obras.

-- ── Quién es pintor ───────────────────────────────────────────────────────
-- security definer para que la policy no dependa de que el usuario pueda leer
-- su propio perfil, y para evitar recursión entre policies de tablas distintas.
create or replace function public.es_pintor()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and p.type in ('painter', 'company')
  );
$$;

comment on function public.es_pintor() is
  'true si la sesión actual es de un pintor o una empresa. Usada por las policies que '
  'separan el lado de la oferta del lado de la demanda en el marketplace.';

-- Postgres le da EXECUTE a PUBLIC en cada función nueva, y Supabase se lo da a
-- anon por privilegios por defecto. Una visita sin cuenta no tiene nada que
-- preguntar acá.
revoke execute on function public.es_pintor() from public, anon;
grant execute on function public.es_pintor() to authenticated;

-- ── Cotizar: además de todo lo anterior, hay que ser pintor ───────────────
drop policy if exists "jobs_insert_painter_quote" on public.jobs;
create policy "jobs_insert_painter_quote" on public.jobs
  for insert with check (
    painter_id = auth.uid()
    and public.es_pintor()
    and status = 'quoted'
    and amount is not null
    and amount > 0
    and commission_amount is not null
    and commission_amount >= 0
    and exists (
      select 1 from public.projects pr
      where pr.id = project_id
        and pr.type = 'service'
        and pr.owner_id = client_id
        and pr.published           -- un pedido cerrado no recibe cotizaciones nuevas
    )
    -- Y que no tenga ya un trabajo adjudicado, aunque `published` hubiera quedado mal.
    and not exists (
      select 1 from public.jobs j
      where j.project_id = jobs.project_id
        and j.status in ('accepted', 'in_progress', 'completed')
    )
  );

-- ── Obras (portfolio): las publica quien pinta ────────────────────────────
-- `projects_modify_own` era una sola policy `for all`. Se abre en tres para poder
-- pedir el rol sólo al escribir portfolio: los pedidos ('service') los publica
-- cualquiera, que es justamente lo que hace un cliente.
-- El borrado no mira el rol a propósito: si una cuenta cambiara de tipo, tiene
-- que poder seguir borrando lo suyo.
drop policy if exists "projects_modify_own" on public.projects;
drop policy if exists "projects_insert_own" on public.projects;
drop policy if exists "projects_update_own" on public.projects;
drop policy if exists "projects_delete_own" on public.projects;

create policy "projects_insert_own" on public.projects
  for insert with check (
    owner_id = auth.uid()
    and (type = 'service' or public.es_pintor())
  );

create policy "projects_update_own" on public.projects
  for update using (owner_id = auth.uid())
  with check (
    owner_id = auth.uid()
    and (type = 'service' or public.es_pintor())
  );

create policy "projects_delete_own" on public.projects
  for delete using (owner_id = auth.uid());
