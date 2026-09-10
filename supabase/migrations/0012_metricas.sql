-- 0012: el panel analítico deja de inventar números.
--
-- /panel mostraba "1.284 trabajos publicados", "$48.2M transados", "$3.85M de comisión" y un
-- gráfico de barras con una serie escrita a mano. Ninguno de esos números salía de la base:
-- eran constantes en el TSX desde que la página era una maqueta. Un panel que dice cifras de
-- negocio inventadas es peor que no tener panel — se toman decisiones con eso.
--
-- Por qué una función y no consultarlo desde la app: la RLS de `jobs` sólo deja ver los
-- trabajos propios, así que ni el admin puede contar los de toda la plataforma con la sesión
-- normal. La alternativa sería usar la service-role desde la página, pero entonces el único
-- guardia sería el `if (isAdmin)` del componente: si alguien lo toca, la página pasa a tener
-- acceso total. Acá el chequeo viaja pegado a los datos — sin `is_admin` no hay filas.

-- ── Los números de arriba ─────────────────────────────────────────────
create or replace function public.metricas_plataforma()
returns table (
  pedidos_publicados   bigint,
  cotizaciones         bigint,
  trabajos_completados bigint,
  volumen              bigint,
  comision             bigint
)
language sql
stable
security definer
set search_path = public
as $$
  select
    (select count(*) from public.projects where type = 'service'),
    (select count(*) from public.jobs),
    (select count(*) from public.jobs where status = 'completed'),
    -- Sólo lo completado cuenta como transado: un trabajo aceptado todavía puede caerse, y
    -- contarlo como volumen sería contar plata que nunca se movió.
    (select coalesce(sum(amount), 0)::bigint from public.jobs where status = 'completed'),
    (select coalesce(sum(commission_amount), 0)::bigint from public.jobs where status = 'completed')
  -- El gate: sin admin no devuelve ninguna fila (y la app muestra el panel vacío).
  where exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin);
$$;

-- ── La serie del gráfico ──────────────────────────────────────────────
-- Doce meses corridos hasta hoy, con cero en los meses sin actividad: si se devolvieran sólo
-- los meses con trabajos, el gráfico dibujaría meses vacíos pegados y mentiría sobre el
-- crecimiento.
create or replace function public.volumen_mensual()
returns table (mes date, total bigint)
language sql
stable
security definer
set search_path = public
as $$
  select
    m.mes::date,
    coalesce((
      select sum(j.amount)
      from public.jobs j
      where j.status = 'completed'
        and date_trunc('month', j.updated_at) = m.mes
    ), 0)::bigint
  from generate_series(
    date_trunc('month', now()) - interval '11 months',
    date_trunc('month', now()),
    interval '1 month'
  ) as m(mes)
  where exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin)
  order by m.mes;
$$;

-- ── La actividad reciente ─────────────────────────────────────────────
-- Reemplaza a `mockJobs`, que llenaba la columna de la derecha con trabajos inventados.
create or replace function public.actividad_reciente(limite int default 6)
returns table (titulo text, creado timestamptz, cotizaciones bigint)
language sql
stable
security definer
set search_path = public
as $$
  select
    pr.title,
    pr.created_at,
    (select count(*) from public.jobs j where j.project_id = pr.id)
  from public.projects pr
  where pr.type = 'service'
    and exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin)
  order by pr.created_at desc
  limit greatest(1, least(coalesce(limite, 6), 50));
$$;

-- Los dos revokes: PUBLIC (default de Postgres) y anon (default privileges de Supabase).
-- Ver la nota larga en 0011 — sacárselo a uno solo deja el otro grant en pie.
revoke execute on function public.metricas_plataforma() from public, anon;
revoke execute on function public.volumen_mensual() from public, anon;
revoke execute on function public.actividad_reciente(int) from public, anon;
grant execute on function public.metricas_plataforma() to authenticated;
grant execute on function public.volumen_mensual() to authenticated;
grant execute on function public.actividad_reciente(int) to authenticated;
