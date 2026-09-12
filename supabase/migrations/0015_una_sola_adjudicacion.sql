-- 0015: un pedido no puede tener dos pintores adjudicados.
--
-- Hallazgo de la auditoría de lógica de negocio, y es el más caro de todos los encontrados:
-- se logró dejar DOS trabajos en `accepted` sobre el mismo pedido. Dos pintores creen que
-- ganaron, los dos organizan su semana, y se devengan dos comisiones por un trabajo que se va
-- a hacer una sola vez.
--
-- Se dio porque nada lo impedía en tres lugares distintos a la vez:
--   · No hay restricción de unicidad sobre "trabajo vivo por pedido".
--   · `jobs_insert_painter_quote` deja cotizar aunque el pedido ya esté adjudicado y
--     despublicado: la perdedora recotizaba y el cliente podía aceptarla también.
--   · `on_job_accepted` cancela las cotizaciones en 'quoted', pero nunca mira si ya había
--     otra aceptada.
--
-- Por qué un trigger y no un índice único parcial: la regla sólo aplica a los pedidos del
-- marketplace (`projects.type = 'service'`). Los de tipo `portfolio` tienen muchos trabajos
-- completados colgando a propósito —así siembra el seed las reseñas de cada pintor— y un
-- índice, que no puede mirar la tabla de al lado, los rompería.

create or replace function public.una_sola_adjudicacion()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  es_service boolean;
  ya_hay int;
begin
  -- Sólo interesa cuando el trabajo ENTRA a un estado vivo.
  if new.status not in ('accepted', 'in_progress', 'completed') then
    return new;
  end if;
  -- Si ya estaba vivo y sigue vivo, no es una adjudicación nueva (ej: accepted → completed).
  if tg_op = 'UPDATE' and old.status in ('accepted', 'in_progress', 'completed') then
    return new;
  end if;
  if new.project_id is null then
    return new;
  end if;

  select (pr.type = 'service') into es_service
  from public.projects pr where pr.id = new.project_id;
  if not coalesce(es_service, false) then
    return new;  -- portfolio: el seed cuelga varios trabajos del mismo proyecto a propósito
  end if;

  select count(*) into ya_hay
  from public.jobs j
  where j.project_id = new.project_id
    and j.id <> new.id
    and j.status in ('accepted', 'in_progress', 'completed');

  if ya_hay > 0 then
    raise exception 'Este pedido ya tiene un pintor asignado.'
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_una_sola_adjudicacion on public.jobs;
create trigger trg_una_sola_adjudicacion
  before insert or update on public.jobs
  for each row execute function public.una_sola_adjudicacion();

-- ── Y que no se pueda ni siquiera cotizar un pedido ya adjudicado ─────
-- Defensa por delante del trigger: sin esto el pintor manda la cotización, la ve aceptada en
-- su panel, y recién al adjudicarse descubre que no valía nada.
drop policy if exists "jobs_insert_painter_quote" on public.jobs;
create policy "jobs_insert_painter_quote" on public.jobs
  for insert with check (
    painter_id = auth.uid()
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

comment on function public.una_sola_adjudicacion() is
  'Impide que un pedido del marketplace tenga más de un trabajo vivo. Se dejó reproducir: dos '
  'pintores aceptados sobre el mismo pedido, con dos comisiones devengadas.';
