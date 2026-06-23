-- 0002 — Normalización y datos derivados consistentes.
-- Ejecutar en Supabase → SQL Editor (después de 0001).

-- ── 1) Especialidades del pintor (faltaban) ──────────────────────────
-- Array de texto: simple y suficiente para una lista corta de oficios.
alter table public.profiles add column if not exists specialties text[] not null default '{}';

-- ── 2) category + accent_color en projects (dejar de derivarlos en código) ──
do $$ begin
  create type project_category as enum ('Residencial', 'Comercial', 'Industrial');
exception when duplicate_object then null; end $$;

alter table public.projects add column if not exists category project_category not null default 'Residencial';
alter table public.projects add column if not exists accent_color text;

-- ── 3) rating / rating_count: CACHÉ mantenida desde reviews ───────────
-- Antes se cargaban a mano y quedaban inconsistentes con las reseñas reales.
-- Ahora la FUENTE DE VERDAD es la tabla reviews y un trigger recalcula el caché.
create or replace function public.recalc_profile_rating(target uuid)
returns void language sql security definer set search_path = public as $$
  update public.profiles p set
    rating = coalesce((select round(avg(r.rating)::numeric, 1) from public.reviews r where r.target_id = target), 0),
    rating_count = (select count(*) from public.reviews r where r.target_id = target)
  where p.id = target;
$$;

create or replace function public.on_review_change()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'DELETE' then
    perform public.recalc_profile_rating(old.target_id);
    return old;
  end if;
  perform public.recalc_profile_rating(new.target_id);
  if tg_op = 'UPDATE' and old.target_id is distinct from new.target_id then
    perform public.recalc_profile_rating(old.target_id);
  end if;
  return new;
end; $$;

drop trigger if exists trg_reviews_rating on public.reviews;
create trigger trg_reviews_rating
after insert or update or delete on public.reviews
for each row execute function public.on_review_change();

-- ── 4) Backfill: recalcular el rating de todos según las reseñas existentes ──
do $$ declare r record; begin
  for r in select id from public.profiles loop
    perform public.recalc_profile_rating(r.id);
  end loop;
end $$;

-- ── 5) Índices de apoyo ──────────────────────────────────────────────
create index if not exists idx_reviews_author on public.reviews (author_id);
create index if not exists idx_jobs_status    on public.jobs (status);
