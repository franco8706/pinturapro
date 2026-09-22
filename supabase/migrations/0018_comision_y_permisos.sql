-- ═══════════════════════════════════════════════════════════════════════════
-- 0018 · Vuelve la validación de la comisión, y una función deja de ser pública
-- ═══════════════════════════════════════════════════════════════════════════
-- Dos cosas, las dos confirmadas contra la base con una sesión simulada.
--
-- ── 1. La comisión se podía poner en cero ──
-- La migración 0006 había agregado la aritmética a `jobs_insert_painter_quote`, con su
-- propio comentario explicando por qué: "el pintor cotizaba con comisión cero desde el
-- INSERT". La 0015 reescribió la misma policy para sumarle la regla de una sola
-- adjudicación y, al reescribirla entera, dejó sólo `commission_amount >= 0`. La 0016
-- volvió a reescribirla para exigir `es_pintor()` y heredó esa versión: la aritmética
-- nunca volvió. Ningún trigger la tapa, porque `enforce_job_rules` corre `before update`,
-- nunca en el alta.
--
-- Confirmado: un pintor demo insertó una cotización de $500.000 con comisión 0 y la base
-- la aceptó. Hoy no hay cobros reales (falta Stripe Connect), pero ya ensucia
-- `metricas_plataforma()` y quedaría lista para perder ingresos el día que se conecten.
--
-- La lección, para que no pase de nuevo: cuando se reescribe una policy entera hay que
-- traer TODAS sus condiciones anteriores, no las que uno recuerda. Por eso esta versión
-- lista cada condición con el número de migración que la trajo.
--
-- ── 2. `recalc_profile_rating` la podía ejecutar cualquiera ──
-- Es `security definer` y viene de 0002, antes de que el proyecto adoptara la costumbre de
-- revocarle EXECUTE a `public` y `anon` (0011 en adelante). Confirmado: `anon` puede
-- llamarla. No corrompe datos —recalcula desde `reviews`, que tiene su propia RLS— pero
-- permite que alguien sin cuenta dispare una escritura en `profiles`.

drop policy if exists "jobs_insert_painter_quote" on public.jobs;
create policy "jobs_insert_painter_quote" on public.jobs
  for insert with check (
    -- (0004) la cotización es de quien la manda
    painter_id = auth.uid()
    -- (0016) y quien la manda tiene que ser pintor o empresa
    and public.es_pintor()
    -- (0006) nadie se cotiza a sí mismo
    and client_id <> auth.uid()
    -- (0004) nace como cotización, no como trabajo adjudicado
    and status = 'quoted'
    and project_id is not null
    -- (0006) el monto es un monto
    and amount is not null
    and amount > 0
    and amount <= 1000000000
    -- (0006) y la comisión es la que corresponde: 10%, con un peso de tolerancia por
    -- redondeo. Esto es lo que se había perdido.
    and commission_amount is not null
    and coalesce(commission_rate, 0.100) = 0.100
    and abs(commission_amount - round(amount * coalesce(commission_rate, 0.100))) <= 1
    -- (0015) el pedido existe, es del marketplace, es de ese cliente y sigue abierto
    and exists (
      select 1 from public.projects pr
      where pr.id = project_id
        and pr.type = 'service'
        and pr.owner_id = client_id
        and pr.published
    )
    -- (0015) y todavía no tiene un pintor adjudicado
    and not exists (
      select 1 from public.jobs j
      where j.project_id = jobs.project_id
        and j.status in ('accepted', 'in_progress', 'completed')
    )
  );

-- Postgres le da EXECUTE a PUBLIC en cada función, y Supabase se lo da a anon por
-- privilegios por defecto. El recálculo lo dispara el trigger de `reviews`, que corre con
-- los privilegios del que reseñó: nadie necesita llamarla a mano desde afuera.
revoke execute on function public.recalc_profile_rating(uuid) from public, anon;
grant execute on function public.recalc_profile_rating(uuid) to authenticated;

-- Preventivo: `slug` viaja en la URL de cada obra y hoy lo arma el servidor, pero la API
-- acepta cualquier valor. La 0017 puso topes a title, description y location y se olvidó de
-- éste.
do $$
declare fuera int;
begin
  select count(*) into fuera from public.projects where length(coalesce(slug, '')) > 120;
  if fuera > 0 then
    raise exception 'Hay % filas con slug demasiado largo.', fuera;
  end if;
end $$;

alter table public.projects drop constraint if exists projects_slug_largo;
alter table public.projects add constraint projects_slug_largo
  check (slug is null or length(slug) between 1 and 120);
