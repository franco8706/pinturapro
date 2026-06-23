-- Pintura Pro — esquema inicial (multi-tenant desde el día 1).
-- Ejecutar en Supabase → SQL Editor (pegar y correr) o con `supabase db push`.
-- Modelo: profiles (empresa|pintor|cliente) · projects (portfolio|service) · jobs · reviews.

-- ───────────────────────── Enums ─────────────────────────
create type profile_type as enum ('company', 'painter', 'client');
create type project_type as enum ('portfolio', 'service');
create type job_status   as enum ('draft', 'published', 'quoted', 'accepted', 'in_progress', 'completed', 'cancelled');

-- ───────────────────────── profiles (1-1 con auth.users) ─────────────────────────
create table public.profiles (
  id            uuid primary key references auth.users(id) on delete cascade,
  type          profile_type not null default 'client',
  full_name     text,
  avatar_url    text,
  phone         text,
  bio           text,
  location      text,
  lat           double precision,
  lng           double precision,
  verified      boolean not null default false,
  rating        numeric(2,1) not null default 0,
  rating_count  int not null default 0,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- ───────────────────────── projects (portfolio = obra de muestra; service = trabajo publicado) ─────────────────────────
create table public.projects (
  id           uuid primary key default gen_random_uuid(),
  owner_id     uuid not null references public.profiles(id) on delete cascade,
  type         project_type not null,
  title        text not null,
  slug         text unique,
  description  text,
  cover_url    text,
  images       text[] not null default '{}',
  location     text,
  lat          double precision,
  lng          double precision,
  budget_min   int,
  budget_max   int,
  published    boolean not null default false,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

-- ───────────────────────── jobs (contrato cliente ↔ pintor; comisión del marketplace) ─────────────────────────
create table public.jobs (
  id               uuid primary key default gen_random_uuid(),
  project_id       uuid references public.projects(id) on delete set null,
  client_id        uuid not null references public.profiles(id) on delete cascade,
  painter_id       uuid references public.profiles(id) on delete set null,
  status           job_status not null default 'draft',
  amount           int,                                    -- monto acordado (definir unidad: ARS)
  commission_rate  numeric(4,3) not null default 0.100,    -- 10%
  commission_amount int,
  scheduled_for    date,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

-- ───────────────────────── reviews (reseña de un job) ─────────────────────────
create table public.reviews (
  id          uuid primary key default gen_random_uuid(),
  job_id      uuid not null references public.jobs(id) on delete cascade,
  author_id   uuid not null references public.profiles(id) on delete cascade,
  target_id   uuid not null references public.profiles(id) on delete cascade,
  rating      int not null check (rating between 1 and 5),
  comment     text,
  photos      text[] not null default '{}',
  created_at  timestamptz not null default now(),
  unique (job_id, author_id)
);

-- ───────────────────────── triggers: updated_at + alta de profile al registrarse ─────────────────────────
create or replace function public.set_updated_at() returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end; $$;

create trigger trg_profiles_updated before update on public.profiles for each row execute function public.set_updated_at();
create trigger trg_projects_updated before update on public.projects for each row execute function public.set_updated_at();
create trigger trg_jobs_updated     before update on public.jobs     for each row execute function public.set_updated_at();

-- Crea automáticamente el profile cuando se registra un usuario en Supabase Auth.
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, full_name, type)
  values (
    new.id,
    new.raw_user_meta_data->>'full_name',
    coalesce((new.raw_user_meta_data->>'type')::profile_type, 'client')
  );
  return new;
end; $$;

create trigger on_auth_user_created after insert on auth.users
for each row execute function public.handle_new_user();

-- ───────────────────────── Row Level Security ─────────────────────────
alter table public.profiles enable row level security;
alter table public.projects enable row level security;
alter table public.jobs     enable row level security;
alter table public.reviews  enable row level security;

-- profiles: perfiles públicos (los pintores se muestran); cada uno edita el suyo.
create policy "profiles_select_all"   on public.profiles for select using (true);
create policy "profiles_insert_own"   on public.profiles for insert with check (auth.uid() = id);
create policy "profiles_update_own"   on public.profiles for update using (auth.uid() = id);

-- projects: los publicados son visibles para todos; el dueño ve/gestiona los suyos.
create policy "projects_select_pub_or_own" on public.projects for select using (published or owner_id = auth.uid());
create policy "projects_modify_own"        on public.projects for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());

-- jobs: solo los participantes (cliente o pintor).
create policy "jobs_select_participant" on public.jobs for select using (client_id = auth.uid() or painter_id = auth.uid());
create policy "jobs_insert_client"      on public.jobs for insert with check (client_id = auth.uid());
create policy "jobs_update_participant" on public.jobs for update using (client_id = auth.uid() or painter_id = auth.uid());

-- reviews: lectura pública; la escribe su autor.
create policy "reviews_select_all"    on public.reviews for select using (true);
create policy "reviews_insert_author" on public.reviews for insert with check (author_id = auth.uid());

-- ───────────────────────── Índices ─────────────────────────
create index idx_projects_owner   on public.projects (owner_id);
create index idx_projects_type    on public.projects (type) where published;
create index idx_jobs_client      on public.jobs (client_id);
create index idx_jobs_painter     on public.jobs (painter_id);
create index idx_reviews_target   on public.reviews (target_id);
