-- ═══════════════════════════════════════════════════════════════════════════
-- 0024 · Lo que se rompe cuando el marketplace crece
-- ═══════════════════════════════════════════════════════════════════════════
-- Ronda de escala (28-29/9/2026). El agente `escala-y-volumen` generó 3.000 pintores, 50.000
-- pedidos, 200.000 trabajos y 100.000 reseñas dentro de una transacción que se deshizo al
-- final (`tools/auditoria/escala/volumen.sql`) y midió las consultas reales de la app. Con
-- los datos de hoy (3 pintores, 25 trabajos) nada de esto se nota.
--
-- ORDEN: la web tiene que llamar a `resumen_publico()` y al tablero nuevo en el mismo cambio
-- (lib/queries.ts). La firma vieja de `pedidos_abiertos(integer)` desaparece acá.

-- ─── 1. Los números de la portada, calculados en la base ─────────────────────
-- `getNumerosReales` bajaba TODAS las reseñas para promediarlas en la app. La API REST corta
-- en 1.000 filas: pasadas las 1.000 reseñas, el promedio y el contador de la portada salían
-- de un pedazo cualquiera de la tabla (sin `order`, ni siquiera el mismo pedazo cada vez).
-- Y "trabajos completados" daba 0 para todo visitante sin cuenta, porque RLS no le deja
-- contar trabajos: la portada nunca mostró esa cifra a quien no había iniciado sesión.
-- Devuelve sólo agregados de la plataforma, ningún dato de nadie.
create or replace function public.resumen_publico()
returns table (obras bigint, trabajos_completados bigint, resenias bigint, promedio numeric)
language sql
stable
security definer
set search_path = public
as $$
  select
    (select count(*) from public.projects where type = 'portfolio' and published),
    (select count(*) from public.jobs where status = 'completed'),
    (select count(*) from public.reviews),
    (select round(avg(rating)::numeric, 1) from public.reviews);
$$;
revoke execute on function public.resumen_publico() from public;
grant execute on function public.resumen_publico() to anon, authenticated;

-- ─── 2. El tablero de pedidos, con "ver anteriores" ──────────────────────────
-- Mostraba los 50 pedidos más nuevos y nada más: un pedido que nadie cotizaba rápido se caía
-- del tablero para siempre, y el cliente creía que seguía a la vista. `antes_de` permite
-- pedir la página siguiente (los pedidos publicados antes del último que se vio).
drop function if exists public.pedidos_abiertos(integer);
create function public.pedidos_abiertos(limite integer default 50, antes_de timestamptz default null)
returns table (id uuid, title text, description text, location text, budget_min integer,
               budget_max integer, owner_id uuid, created_at timestamptz)
language sql
stable
set search_path = public
as $$
  select pr.id, pr.title, pr.description, pr.location, pr.budget_min, pr.budget_max,
         pr.owner_id, pr.created_at
  from public.projects pr
  where pr.type = 'service'
    and pr.published
    and (antes_de is null or pr.created_at < antes_de)
    -- La condición de 0014: aunque `published` quedara mal, un pedido con un trabajo ya
    -- adjudicado no se ofrece de nuevo.
    and not exists (
      select 1 from public.jobs j
      where j.project_id = pr.id
        and j.status in ('accepted', 'in_progress', 'completed')
    )
  order by pr.created_at desc
  limit greatest(1, least(coalesce(limite, 50), 100));
$$;
revoke execute on function public.pedidos_abiertos(integer, timestamptz) from public;
grant execute on function public.pedidos_abiertos(integer, timestamptz) to anon, authenticated;

-- ─── 3. Índices que faltaban ─────────────────────────────────────────────────
-- Medidos con volumen: sin ellos, cada visita a un perfil y a la portada ordena reseñas a mano.
create index if not exists idx_reviews_pintor_fecha on public.reviews (target_id, created_at desc);
-- Los testimonios de la portada (`getRecentReviews`): con comentario y 4 estrellas o más.
create index if not exists idx_reviews_testimonios on public.reviews (created_at desc)
  where comment is not null and rating >= 4;
-- El tablero: pedidos publicados, del más nuevo al más viejo.
create index if not exists idx_projects_pedidos_abiertos on public.projects (created_at desc)
  where type = 'service' and published;

-- ─── 4. Reglas que se evaluaban fila por fila ────────────────────────────────
-- Una policy que llama `auth.uid()` (o `es_pintor()`, `es_admin()`) sin envolverla en
-- `(select …)` hace que Postgres la recalcule por cada fila que mira, en vez de una vez por
-- consulta. Es el aviso `auth_rls_initplan` del asesor de Supabase. La lógica de cada policy
-- es EXACTAMENTE la de antes (leída de pg_policies el 29/9): sólo cambia cuándo se evalúa.
-- Revisadas cláusula por cláusula por `seguridad-rls` el 3/10: no se perdió ninguna condición.
-- `jobs_select_participant` NO se envuelve, a propósito (6/10/2026). Envolverla rompía TODAS las
-- cotizaciones: "infinite recursion detected in policy for relation jobs" al insertar como
-- pintor. La policy de cotizar mira `jobs` (no exists) y `projects` (cuya policy mira `jobs`), y
-- cuando la policy de lectura de `jobs` tiene una subconsulta —y `(select auth.uid())` lo es—
-- Postgres revisa recursión al expandirla adentro de otra policy de `jobs`, y la declara. Sin
-- subconsulta no la revisa. Lo encontró `probar-0027.sql` en la base local: los ensayos de 0024
-- y 0026 esperaban errores y aceptaban CUALQUIERA, y nunca probaron una cotización que tenía que
-- entrar. `jobs` es chica (cientos de filas): evaluar auth.uid() por fila no se nota.
alter policy jobs_select_participant on public.jobs
  using ((client_id = auth.uid()) or (painter_id = auth.uid()));

alter policy jobs_update_client on public.jobs
  using (client_id = (select auth.uid()))
  with check (client_id = (select auth.uid()));

alter policy jobs_update_painter on public.jobs
  using (painter_id = (select auth.uid()))
  with check (painter_id = (select auth.uid()));

alter policy jobs_insert_painter_quote on public.jobs
  with check (
    (painter_id = (select auth.uid()))
    and (select public.es_pintor())
    and (client_id <> (select auth.uid()))
    and (status = 'quoted'::job_status)
    and (project_id is not null)
    and (amount is not null) and (amount > 0) and (amount <= 1000000000)
    and (commission_amount is not null)
    and (coalesce(commission_rate, 0.100) = 0.100)
    and (abs((commission_amount)::numeric - round((amount)::numeric * coalesce(commission_rate, 0.100))) <= (1)::numeric)
    and exists (
      select 1 from public.projects pr
      where pr.id = jobs.project_id and pr.type = 'service'::project_type
        and pr.owner_id = jobs.client_id and pr.published
    )
    and not exists (
      select 1 from public.jobs j
      where j.project_id = jobs.project_id
        and j.status = any (array['accepted'::job_status, 'in_progress'::job_status, 'completed'::job_status])
    )
  );

alter policy leads_select_admin on public.leads using ((select public.es_admin()));
alter policy leads_update_admin on public.leads using ((select public.es_admin()));

alter policy profiles_insert_own on public.profiles with check ((select auth.uid()) = id);
alter policy profiles_update_own on public.profiles using ((select auth.uid()) = id);
alter policy profiles_select_publicos_o_con_sesion on public.profiles
  using ((type = any (array['painter'::profile_type, 'company'::profile_type])) or ((select auth.uid()) is not null));

alter policy projects_delete_own on public.projects using (owner_id = (select auth.uid()));
alter policy projects_insert_own on public.projects
  with check ((owner_id = (select auth.uid())) and ((type = 'service'::project_type) or (select public.es_pintor())));
-- `projects_update_own` NO se toca acá: la reescribe 0026 (ya envuelta en `(select …)` y con la
-- regla de que un pedido adjudicado no se edita). Si estuviera en las dos, aplicar 0024 después
-- de 0026 borraría esa regla en silencio (lo marcó `seguridad-rls`, 3/10).
alter policy projects_select_pub_own_o_adjudicado on public.projects
  using (
    published
    or (owner_id = (select auth.uid()))
    or exists (select 1 from public.jobs j where j.project_id = projects.id and j.painter_id = (select auth.uid()))
  );

alter policy reviews_insert_author on public.reviews
  with check (
    (author_id = (select auth.uid()))
    and exists (
      select 1 from public.jobs j
      where j.id = reviews.job_id and j.client_id = (select auth.uid())
        and j.painter_id = reviews.target_id and j.status = 'completed'::job_status
    )
  );

-- ─── 5. La única función sin cerrar ──────────────────────────────────────────
-- `es_service_role()` (0006) quedó con EXECUTE para todos, contra la convención del proyecto
-- (seguridad-rls, 28/9). No filtra nada —lee el claim del propio JWT—, pero es la plantilla que
-- alguien va a copiar. La usan dos funciones `security definer`, que la ejecutan como su dueño.
revoke execute on function public.es_service_role() from public, anon, authenticated;

notify pgrst, 'reload schema';
