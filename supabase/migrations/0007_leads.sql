-- 0007_leads.sql
-- Persistencia de los formularios públicos.
--
-- PROBLEMA QUE RESUELVE: /cotizar, /contacto y /registro mostraban un mensaje de éxito
-- ("Te vamos a contactar en menos de 24 horas") y DESCARTABAN los datos. No se guardaba
-- nada ni se enviaba ningún aviso. Cada visitante que pedía presupuesto era un cliente
-- perdido, y el sitio le prometía algo que no iba a pasar.
--
-- Correr en Supabase → SQL Editor, después de 0006.

begin;

do $$ begin
  create type lead_kind as enum ('quote', 'contact', 'painter_application');
exception when duplicate_object then null; end $$;

do $$ begin
  create type lead_status as enum ('new', 'contacted', 'won', 'lost', 'spam');
exception when duplicate_object then null; end $$;

create table if not exists public.leads (
  id          uuid primary key default gen_random_uuid(),
  kind        lead_kind   not null,
  status      lead_status not null default 'new',

  -- Contacto: lo mínimo para poder responder.
  name        text not null check (length(btrim(name)) between 2 and 120),
  email       text        check (email is null or (length(email) <= 200 and position('@' in email) > 1)),
  phone       text        check (phone is null or length(phone) <= 40),
  message     text        check (message is null or length(message) <= 4000),

  -- Campos propios de cada formulario (superficie, ambientes, especialidades…).
  details     jsonb not null default '{}'::jsonb,

  -- Si la persona estaba logueada, queda asociado. Si no, es un lead anónimo.
  user_id     uuid references public.profiles(id) on delete set null,

  -- Trazabilidad mínima para detectar abuso, sin guardar IP.
  source_path text check (source_path is null or length(source_path) <= 200),

  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists idx_leads_kind_created on public.leads (kind, created_at desc);
create index if not exists idx_leads_status       on public.leads (status) where status = 'new';
create index if not exists idx_leads_user         on public.leads (user_id) where user_id is not null;

drop trigger if exists trg_leads_updated on public.leads;
create trigger trg_leads_updated before update on public.leads
  for each row execute function public.set_updated_at();

-- ── RLS ────────────────────────────────────────────────────────────────
-- Cualquiera puede DEJAR un lead (los formularios son públicos, sin login).
-- NADIE puede leerlos salvo la empresa: son datos de contacto de clientes, y una
-- policy de lectura abierta sería una lista de prospectos servida a la competencia.
alter table public.leads enable row level security;

drop policy if exists "leads_insert_any"      on public.leads;
drop policy if exists "leads_select_company"  on public.leads;
drop policy if exists "leads_update_company"  on public.leads;

create policy "leads_insert_any" on public.leads
  for insert with check (
    -- El status siempre arranca en 'new': que nadie inserte un lead ya marcado como atendido.
    status = 'new'
    -- Si dice ser un usuario, tiene que serlo.
    and (user_id is null or user_id = auth.uid())
  );

create policy "leads_select_company" on public.leads
  for select using (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.type = 'company')
  );

create policy "leads_update_company" on public.leads
  for update using (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.type = 'company')
  );

-- Sin policy de DELETE a propósito: un lead no se borra desde la app, se marca 'spam'.

commit;
