-- ═══════════════════════════════════════════════════════════════════════════
-- setup-completo.sql — Pintura Pro
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Las 15 migraciones en un solo archivo, en orden y RE-EJECUTABLE.
--
-- Para qué: poner en marcha la base de cero (proyecto Supabase nuevo, o uno
-- restaurado) sin tener que pegar 15 archivos uno por uno. Correr esto deja el
-- esquema completo: tablas, RLS, triggers, contenido inicial, leads, el rol
-- is_admin, el ciclo de vida de los trabajos (congelar el monto, reabrir el
-- pedido al cancelar), el intercambio de teléfono entre las partes y las
-- métricas del panel analítico.
--
-- CÓMO: Supabase → SQL Editor → pegar todo → Run.
--
-- Se puede correr más de una vez sin romper nada: los enums, tablas, índices,
-- policies y triggers de 0001 se reescribieron acá con guardas de idempotencia
-- (el archivo original de 0001 falla si se corre dos veces).
--
-- DESPUÉS de esto, sembrar los datos demo:
--   SUPABASE_URL=https://<ref>.supabase.co \
--   SUPABASE_SECRET=<service_role_key> \
--   python3 scripts/seed_supabase.py
-- ═══════════════════════════════════════════════════════════════════════════



-- ╔══════════════════════════════════════════════════════════════════════╗
-- ║  0001_init.sql                                                     ║
-- ╚══════════════════════════════════════════════════════════════════════╝

-- Pintura Pro — esquema inicial (multi-tenant desde el día 1).
-- Ejecutar en Supabase → SQL Editor (pegar y correr) o con `supabase db push`.
-- Modelo: profiles (empresa|pintor|cliente) · projects (portfolio|service) · jobs · reviews.

-- ───────────────────────── Enums ─────────────────────────
do $$ begin
  create type profile_type as enum ('company', 'painter', 'client');
exception when duplicate_object then null; end $$;
do $$ begin
  create type project_type as enum ('portfolio', 'service');
exception when duplicate_object then null; end $$;
do $$ begin
  create type job_status   as enum ('draft', 'published', 'quoted', 'accepted', 'in_progress', 'completed', 'cancelled');
exception when duplicate_object then null; end $$;

-- ───────────────────────── profiles (1-1 con auth.users) ─────────────────────────
create table if not exists public.profiles (
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
create table if not exists public.projects (
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
create table if not exists public.jobs (
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
create table if not exists public.reviews (
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

drop trigger if exists trg_profiles_updated on public.profiles;
create trigger trg_profiles_updated before update on public.profiles for each row execute function public.set_updated_at();
drop trigger if exists trg_projects_updated on public.projects;
create trigger trg_projects_updated before update on public.projects for each row execute function public.set_updated_at();
drop trigger if exists trg_jobs_updated on public.jobs;
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

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
for each row execute function public.handle_new_user();

-- ───────────────────────── Row Level Security ─────────────────────────
alter table public.profiles enable row level security;
alter table public.projects enable row level security;
alter table public.jobs     enable row level security;
alter table public.reviews  enable row level security;

-- profiles: perfiles públicos (los pintores se muestran); cada uno edita el suyo.
drop policy if exists "profiles_select_all" on public.profiles;
create policy "profiles_select_all"   on public.profiles for select using (true);
drop policy if exists "profiles_insert_own" on public.profiles;
create policy "profiles_insert_own"   on public.profiles for insert with check (auth.uid() = id);
drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own"   on public.profiles for update using (auth.uid() = id);

-- projects: los publicados son visibles para todos; el dueño ve/gestiona los suyos.
drop policy if exists "projects_select_pub_or_own" on public.projects;
create policy "projects_select_pub_or_own" on public.projects for select using (published or owner_id = auth.uid());
drop policy if exists "projects_modify_own" on public.projects;
create policy "projects_modify_own"        on public.projects for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());

-- jobs: solo los participantes (cliente o pintor).
drop policy if exists "jobs_select_participant" on public.jobs;
create policy "jobs_select_participant" on public.jobs for select using (client_id = auth.uid() or painter_id = auth.uid());
drop policy if exists "jobs_insert_client" on public.jobs;
create policy "jobs_insert_client"      on public.jobs for insert with check (client_id = auth.uid());
drop policy if exists "jobs_update_participant" on public.jobs;
create policy "jobs_update_participant" on public.jobs for update using (client_id = auth.uid() or painter_id = auth.uid());

-- reviews: lectura pública; la escribe su autor.
drop policy if exists "reviews_select_all" on public.reviews;
create policy "reviews_select_all"    on public.reviews for select using (true);
drop policy if exists "reviews_insert_author" on public.reviews;
create policy "reviews_insert_author" on public.reviews for insert with check (author_id = auth.uid());

-- ───────────────────────── Índices ─────────────────────────
create index if not exists idx_projects_owner   on public.projects (owner_id);
create index if not exists idx_projects_type    on public.projects (type) where published;
create index if not exists idx_jobs_client      on public.jobs (client_id);
create index if not exists idx_jobs_painter     on public.jobs (painter_id);
create index if not exists idx_reviews_target   on public.reviews (target_id);


-- ╔══════════════════════════════════════════════════════════════════════╗
-- ║  0002_normalize.sql                                                ║
-- ╚══════════════════════════════════════════════════════════════════════╝

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


-- ╔══════════════════════════════════════════════════════════════════════╗
-- ║  0003_onboarding.sql                                               ║
-- ╚══════════════════════════════════════════════════════════════════════╝

-- 0003_onboarding.sql
-- Soporte para login social (Google/Microsoft/Facebook) + selección de rol.
--
-- Problema: cuando alguien entra con OAuth, Supabase no sabe si es cliente, pintor
-- o empresa. El trigger handle_new_user crea el profile con type 'client' por defecto,
-- pero eso no distingue "eligió cliente" de "todavía no eligió".
--
-- Solución: una columna `onboarded`. El que se registra con el formulario (manda su rol)
-- queda onboarded=true; el que entra por OAuth queda onboarded=false y la app lo manda
-- a /bienvenida a elegir su rol.

alter table public.profiles
  add column if not exists onboarded boolean not null default false;

-- Recreamos el trigger: marca onboarded según si vino el rol en el alta.
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, full_name, type, onboarded)
  values (
    new.id,
    new.raw_user_meta_data->>'full_name',
    coalesce((new.raw_user_meta_data->>'type')::profile_type, 'client'),
    -- true si el alta trajo rol (signup con formulario); false si fue OAuth (sin rol)
    (new.raw_user_meta_data->>'type') is not null
  );
  return new;
end; $$;

-- Los usuarios que ya existen (sembrados / con rol real) quedan onboarded.
update public.profiles set onboarded = true where onboarded = false;


-- ╔══════════════════════════════════════════════════════════════════════╗
-- ║  0004_marketplace.sql                                              ║
-- ╚══════════════════════════════════════════════════════════════════════╝

-- 0004_marketplace.sql
-- Marketplace: el cliente publica un pedido de trabajo (projects type='service')
-- y los pintores envían cotizaciones (jobs status='quoted').

-- Mensaje de la cotización del pintor.
alter table public.jobs add column if not exists note text;

-- El pintor puede crear una cotización para sí mismo, en estado 'quoted', sobre un
-- pedido de servicio real cuyo dueño sea el client_id que declara. (Las policies INSERT
-- permissive se combinan con OR, así que esto convive con jobs_insert_client.)
drop policy if exists "jobs_insert_painter_quote" on public.jobs;
create policy "jobs_insert_painter_quote" on public.jobs
  for insert with check (
    painter_id = auth.uid()
    and status = 'quoted'
    and project_id is not null
    and exists (
      select 1 from public.projects p
      where p.id = project_id and p.type = 'service' and p.owner_id = client_id
    )
  );

create index if not exists idx_jobs_painter on public.jobs (painter_id);
create index if not exists idx_jobs_client  on public.jobs (client_id);
create index if not exists idx_projects_service on public.projects (type) where type = 'service' and published;


-- ╔══════════════════════════════════════════════════════════════════════╗
-- ║  0005_content.sql                                                  ║
-- ╚══════════════════════════════════════════════════════════════════════╝

-- 0005_content.sql
-- Contenido dinámico del sitio + atributos del pintor.
--   profiles.pros / profiles.cons : puntos a favor / a considerar del pintor
--   faqs       : preguntas básicas antes de un presupuesto
--   resources  : guías del pintor, videos instructivos, cursos y asesoramiento
--   news       : noticias para el carrusel
-- RLS: lectura pública de lo publicado; la escritura es solo por service-role (sin policies de write).

-- ── Pintor: puntos a favor / a considerar ──────────────────────────────
alter table public.profiles add column if not exists pros text[] not null default '{}';
alter table public.profiles add column if not exists cons text[] not null default '{}';

-- ── FAQs (preguntas antes de pedir presupuesto) ────────────────────────
create table if not exists public.faqs (
  id          uuid primary key default gen_random_uuid(),
  question    text not null unique,
  answer      text not null,
  sort_order  int  not null default 0,
  published   boolean not null default true,
  created_at  timestamptz not null default now()
);

-- ── Recursos (guías / videos / cursos / asesoramiento) ─────────────────
create table if not exists public.resources (
  id          uuid primary key default gen_random_uuid(),
  kind        text not null check (kind in ('guide','video','course','advice')),
  title       text not null unique,
  summary     text,
  body        text,
  media_url   text,            -- link a video / recurso externo
  cover_url   text,
  level       text,            -- ej: Principiante / Intermedio
  duration    text,            -- ej: "8 min" / "4 clases"
  sort_order  int  not null default 0,
  published   boolean not null default true,
  created_at  timestamptz not null default now()
);

-- ── Noticias (carrusel) ────────────────────────────────────────────────
create table if not exists public.news (
  id            uuid primary key default gen_random_uuid(),
  title         text not null unique,
  excerpt       text,
  cover_url     text,
  url           text,
  published_at  timestamptz not null default now(),
  published     boolean not null default true
);

-- ── RLS ────────────────────────────────────────────────────────────────
alter table public.faqs      enable row level security;
alter table public.resources enable row level security;
alter table public.news      enable row level security;

drop policy if exists "faqs_select_pub"      on public.faqs;
drop policy if exists "resources_select_pub" on public.resources;
drop policy if exists "news_select_pub"      on public.news;
create policy "faqs_select_pub"      on public.faqs      for select using (published);
create policy "resources_select_pub" on public.resources for select using (published);
create policy "news_select_pub"      on public.news      for select using (published);

create index if not exists idx_resources_kind on public.resources (kind) where published;
create index if not exists idx_news_pub on public.news (published_at desc) where published;

-- ── Seed (idempotente vía unique + on conflict) ────────────────────────
insert into public.faqs (question, answer, sort_order) values
  ('¿El trabajo es interior, exterior o ambos?', 'Definí si pintamos ambientes internos, frentes/medianeras o una obra completa. Cambia mucho el material y la preparación.', 1),
  ('¿Qué superficie aproximada en m² hay que pintar?', 'No hace falta exactitud: una estimación (por ambiente o total) ya nos permite acercar un número. Si no sabés, contamos las paredes principales.', 2),
  ('¿En qué estado están las paredes?', 'Contanos si son nuevas, están descascaradas, tienen humedad, hongos o grietas. La preparación es la mitad del trabajo.', 3),
  ('¿Incluye reparaciones (enduido, grietas, humedad)?', 'Si hay que reparar antes de pintar, conviene aclararlo: impacta en tiempo y costo, y evita sorpresas a mitad de obra.', 4),
  ('¿Ya tenés color y marca, o necesitás asesoramiento?', 'Podés traer tu paleta o pedirnos una recomendación según el ambiente, la luz y el uso. Trabajamos con primeras marcas.', 5),
  ('¿El espacio va a estar habitado o amoblado durante el trabajo?', 'Saber si hay muebles, mascotas o gente viviendo nos ayuda a planificar la protección y los tiempos.', 6),
  ('¿Para cuándo lo necesitás?', 'Una fecha objetivo (o si es urgente) nos permite organizar el equipo y darte un plazo realista.', 7)
on conflict (question) do nothing;

insert into public.resources (kind, title, summary, body, media_url, level, duration, sort_order) values
  ('guide', 'Armá un perfil que consiga más trabajos', 'Foto, bio, zona y especialidades: cómo presentarte para que los clientes te elijan.', 'Un perfil completo recibe muchas más solicitudes. Subí una foto clara, escribí una bio corta con tu experiencia, marcá tus especialidades y tu zona. Sumá tus mejores obras al portfolio con fotos antes/después.', null, 'Principiante', '6 min', 1),
  ('guide', 'Cómo cotizar de forma profesional', 'Estructura una cotización clara: materiales, mano de obra, plazos y qué incluye.', 'Una buena cotización detalla superficie, preparación, manos de pintura, materiales (marca/tipo), plazos y qué NO incluye. La claridad genera confianza y reduce idas y vueltas.', null, 'Principiante', '8 min', 2),
  ('guide', 'Qué materiales llevar a cada obra', 'Checklist de herramientas y materiales para no frenar el trabajo.', 'Rodillos y pinceles según terminación, bandejas, cinta de papel, lonas de protección, enduido, lija, fijador, y la pintura calculada con 10% de margen. Llevar todo evita viajes y demoras.', null, 'Principiante', '5 min', 3),
  ('video', 'Técnica de rodillo sin marcas', 'El método de la "W" y el repaso para una terminación pareja.', null, 'https://www.youtube.com/results?search_query=tecnica+rodillo+sin+marcas', 'Principiante', '7 min', 1),
  ('video', 'Cómo tratar una pared con humedad', 'Diagnóstico, secado, fijador y pintura antihumedad paso a paso.', null, 'https://www.youtube.com/results?search_query=pared+con+humedad+como+pintar', 'Intermedio', '10 min', 2),
  ('course', 'Terminaciones premium', 'Esmaltes, veladuras y texturas para diferenciarte y cobrar mejor.', 'Curso práctico de 4 clases sobre terminaciones de alto valor: esmalte al agua, veladuras, microcemento y texturas decorativas.', null, 'Intermedio', '4 clases', 1),
  ('course', 'Gestión de obra y presupuestos', 'Organizá tiempos, equipo y números para que cada obra sea rentable.', 'Aprendé a presupuestar, planificar etapas, coordinar ayudantes y controlar costos. Incluye plantillas de cotización.', null, 'Intermedio', '5 clases', 2),
  ('advice', 'Elegí la pintura según el ambiente', 'Cocina, baño, exterior o dormitorio: cada uno pide un tipo distinto.', 'Lavable y antihongos para cocina/baño, látex mate para dormitorios, esmalte al agua para aberturas, y membrana o impermeabilizante para exteriores. Elegir bien evita repintar antes de tiempo.', null, null, null, 1),
  ('advice', '¿Cuánta pintura necesito?', 'Calculá el rendimiento real para no comprar de más ni de menos.', 'Regla práctica: 1 litro rinde ~10 m² por mano. Multiplicá la superficie por la cantidad de manos (normalmente 2) y dividí por 10. Sumá 10% de margen.', null, null, null, 2)
on conflict (title) do nothing;

insert into public.news (title, excerpt, url, published_at) values
  ('Tendencias de color 2026 para interiores', 'Tonos tierra, verdes profundos y neutros cálidos lideran la temporada. Mirá la paleta sugerida.', '/colores', now() - interval '2 days'),
  ('Sumamos pintores verificados en Zona Norte', 'Ampliamos la cobertura del marketplace: más profesionales con reseñas reales cerca tuyo.', '/pintores', now() - interval '9 days'),
  ('Esmaltes al agua: por qué conviene el cambio', 'Bajo olor, secado rápido y limpieza con agua. Te contamos cuándo usarlos.', '/aprender', now() - interval '16 days'),
  ('Cómo proteger tu obra del calor en verano', 'Horarios, materiales y cuidados para pintar bien con altas temperaturas.', '/aprender', now() - interval '25 days')
on conflict (title) do nothing;


-- ╔══════════════════════════════════════════════════════════════════════╗
-- ║  0006_security.sql                                                 ║
-- ╚══════════════════════════════════════════════════════════════════════╝

-- 0006_security.sql
-- Cierra los huecos de autorización de la auditoría.
--
-- CONTEXTO: la `anon key` viaja en el bundle del navegador — es pública por diseño.
-- Cualquiera con sesión puede pegarle directo a PostgREST y saltear TODAS las Server
-- Actions. Las validaciones en actions.ts son UX, no seguridad. El límite real es esto.
--
-- Correr en Supabase → SQL Editor, después de 0005. Es idempotente.
--
-- NOTA DE REVISIÓN: una primera versión de este archivo no se podía aplicar (el índice
-- único chocaba con los datos del seed y hacía rollback de todo) y tenía varios arreglos
-- incompletos. Cada corrección quedó comentada abajo, en su bloque.

-- ═══════════════════════════════════════════════════════════════════════════
-- Helper: ¿la escritura viene del backend con service-role?
-- ═══════════════════════════════════════════════════════════════════════════
-- Usamos auth.role() de Supabase y NO current_setting('request.jwt.claim.role').
-- Esa GUC por-claim quedó deprecada en PostgREST 9 y removida después: PostgREST
-- moderno sólo setea `request.jwt.claims` (JSON con todos los claims). Con la forma
-- vieja la guarda era código muerto y el service-role pasaba sólo por accidente.
create or replace function public.es_service_role() returns boolean
language sql stable as $$
  select coalesce(
    nullif(current_setting('request.jwt.claim.role', true), ''),
    (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role'),
    ''
  ) = 'service_role';
$$;


-- ═══════════════════════════════════════════════════════════════════════════
-- S1 · Reseñas: sólo el cliente de un trabajo COMPLETADO reseña a SU pintor
-- ═══════════════════════════════════════════════════════════════════════════
-- Antes la policy sólo pedía author_id = auth.uid(): cualquiera reseñaba a cualquiera.
--
-- CORRECCIÓN: validar el job no alcanzaba. `jobs_insert_client` (0001) deja al cliente
-- insertar un job con CUALQUIER status, así que el atacante se fabricaba un job ya en
-- 'completed' y pasaba el check igual. Hay que cerrar las dos puntas.
drop policy if exists "reviews_insert_author" on public.reviews;
create policy "reviews_insert_author" on public.reviews
  for insert with check (
    author_id = auth.uid()
    and exists (
      select 1 from public.jobs j
      where j.id = job_id
        and j.client_id = auth.uid()     -- el trabajo es tuyo, como cliente
        and j.painter_id = target_id     -- y reseñás al pintor que lo hizo
        and j.status = 'completed'       -- y el trabajo terminó
    )
  );

-- La otra punta: un cliente ya no puede fabricarse jobs. Ningún código de la app inserta
-- jobs como cliente (verificado en app/(marketplace)/actions.ts y apps/mobile/lib/mutations.ts:
-- el único INSERT es `cotizar`, con painter_id = auth.uid()). El seed usa service-role,
-- que no pasa por RLS. Así que esta policy se puede cerrar del todo sin romper nada.
drop policy if exists "jobs_insert_client" on public.jobs;

-- Sin policy de UPDATE/DELETE en reviews a propósito: si se pudieran editar, se esquivaría
-- el check de arriba cambiando el rating después de insertarlo.


-- ═══════════════════════════════════════════════════════════════════════════
-- S2 · Perfiles: los campos de confianza dejan de ser escribibles
-- ═══════════════════════════════════════════════════════════════════════════
-- `profiles_update_own` permite escribir CUALQUIER columna de la fila propia. Un pintor
-- hacía `set verified = true, rating = 5.0` y quedaba nivel "Master" y primero en /pintores.
-- Postgres no tiene RLS por columna, así que se congelan con un trigger.
--
-- CORRECCIÓN: `type` se congelaba sólo `if old.onboarded`, pero `onboarded` no se congelaba.
-- El bypass eran dos requests: apagás onboarded, después te cambiás a 'company' y entrás
-- a /admin y /panel. Ahora `onboarded` sólo puede ir de false a true.

-- El recálculo del rating (trigger de reviews, 0002) escribe rating/rating_count con el JWT
-- del usuario que reseñó. Sin esta marca el congelamiento lo revertiría y los ratings
-- quedarían clavados para siempre.
create or replace function public.recalc_profile_rating(target uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  perform set_config('app.rating_recalc', 'on', true);  -- true = sólo esta transacción
  update public.profiles p set
    rating = coalesce((select round(avg(r.rating)::numeric, 1) from public.reviews r where r.target_id = target), 0),
    rating_count = (select count(*) from public.reviews r where r.target_id = target)
  where p.id = target;
  perform set_config('app.rating_recalc', 'off', true);
end; $$;

create or replace function public.freeze_profile_trust_fields()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if public.es_service_role() then
    return new;
  end if;
  -- Recálculo legítimo disparado por una reseña.
  if coalesce(current_setting('app.rating_recalc', true), 'off') = 'on' then
    return new;
  end if;
  if auth.uid() is null then
    return new;  -- contexto sin JWT (SQL Editor, migraciones)
  end if;

  new.verified     := old.verified;
  new.rating       := old.rating;       -- caché que mantiene el trigger de reviews
  new.rating_count := old.rating_count;

  -- El rol se elige UNA vez, en el onboarding (/bienvenida, para perfiles que llegan por
  -- OAuth sin rol). Después queda fijo, y `onboarded` no puede volver atrás: si se pudiera,
  -- alcanzaría con apagarlo para reabrir el cambio de rol.
  if old.onboarded then
    new.type      := old.type;
    new.onboarded := true;
  end if;

  return new;
end; $$;

drop trigger if exists trg_profiles_freeze_trust on public.profiles;
create trigger trg_profiles_freeze_trust
  before update on public.profiles
  for each row execute function public.freeze_profile_trust_fields();


-- ═══════════════════════════════════════════════════════════════════════════
-- S3 · Trabajos: la máquina de estados y el dinero se aplican en la base
-- ═══════════════════════════════════════════════════════════════════════════
-- `jobs_update_participant` sólo pedía ser participante, sin WITH CHECK ni restricción de
-- columnas: el pintor aceptaba su propia cotización, subía el monto, o ponía la comisión en cero.

drop policy if exists "jobs_update_participant" on public.jobs;

drop policy if exists "jobs_update_client" on public.jobs;
create policy "jobs_update_client" on public.jobs
  for update using (client_id = auth.uid()) with check (client_id = auth.uid());

drop policy if exists "jobs_update_painter" on public.jobs;
create policy "jobs_update_painter" on public.jobs
  for update using (painter_id = auth.uid()) with check (painter_id = auth.uid());

-- CORRECCIÓN: el dinero tampoco se validaba al NACER. `jobs_insert_painter_quote` (0004) no
-- miraba amount ni commission_amount, así que el pintor cotizaba con comisión cero desde el
-- INSERT. Se valida acá, donde nace.
drop policy if exists "jobs_insert_painter_quote" on public.jobs;
create policy "jobs_insert_painter_quote" on public.jobs
  for insert with check (
    painter_id = auth.uid()
    and client_id <> auth.uid()          -- no podés cotizarte a vos mismo
    and status = 'quoted'
    and project_id is not null
    and amount is not null and amount > 0 and amount <= 1000000000
    -- La comisión tiene que ser la que corresponde (10%), con 1 peso de tolerancia por redondeo.
    and commission_amount is not null
    and abs(commission_amount - round(amount * coalesce(commission_rate, 0.100))) <= 1
    and coalesce(commission_rate, 0.100) = 0.100
    and exists (
      select 1 from public.projects p
      where p.id = project_id and p.type = 'service' and p.owner_id = client_id
    )
  );

-- CORRECCIÓN: la versión anterior hacía `new.client_id := old.client_id` (etc.) de forma
-- incondicional. Eso REVERTÍA el `on delete set null` de las FK: al borrar un project o un
-- profile, Postgres ponía NULL y el trigger lo devolvía al valor viejo, dejando foreign keys
-- colgadas apuntando a filas inexistentes. Ahora se lanza excepción ante una reasignación
-- real, y se permite explícitamente el único cambio legítimo: old → NULL por cascada.
create or replace function public.enforce_job_rules()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  actor_is_client  boolean := (auth.uid() = old.client_id);
  actor_is_painter boolean := (auth.uid() = old.painter_id);
begin
  if public.es_service_role() or auth.uid() is null then
    return new;
  end if;

  -- Las partes no se reasignan. Pasar a NULL sí se permite: es lo que hace la FK al
  -- borrarse el padre, y bloquearlo dejaría la base inconsistente.
  if new.client_id is distinct from old.client_id and new.client_id is not null then
    raise exception 'No se puede reasignar el cliente del trabajo';
  end if;
  if new.painter_id is distinct from old.painter_id and new.painter_id is not null then
    raise exception 'No se puede reasignar el pintor del trabajo';
  end if;
  if new.project_id is distinct from old.project_id and new.project_id is not null then
    raise exception 'No se puede reasignar el pedido del trabajo';
  end if;

  -- El dinero se congela apenas la cotización deja de estar en 'quoted'.
  if old.status <> 'quoted' then
    new.amount            := old.amount;
    new.commission_amount := old.commission_amount;
    new.commission_rate   := old.commission_rate;
  end if;

  -- Transiciones permitidas.
  -- CORRECCIÓN: antes 'in_progress' era un estado terminal — el pintor podía entrar pero
  -- ninguna rama lo dejaba salir, y el trabajo quedaba tapiado sin poder completarse ni
  -- cancelarse. Ahora el ciclo cierra por los dos lados.
  if new.status is distinct from old.status then
    if actor_is_client then
      if not (
        (old.status = 'quoted'      and new.status in ('accepted', 'cancelled')) or
        (old.status = 'accepted'    and new.status = 'cancelled') or
        (old.status = 'in_progress' and new.status = 'cancelled')
      ) then
        raise exception 'Transición no permitida para el cliente: % -> %', old.status, new.status;
      end if;
    elsif actor_is_painter then
      -- El pintor NO acepta su propia cotización: eso lo decide el cliente.
      if not (
        (old.status = 'quoted'      and new.status = 'cancelled') or   -- retirar la cotización
        (old.status = 'accepted'    and new.status in ('in_progress', 'completed', 'cancelled')) or
        (old.status = 'in_progress' and new.status in ('completed', 'cancelled'))
      ) then
        raise exception 'Transición no permitida para el pintor: % -> %', old.status, new.status;
      end if;
    else
      raise exception 'No sos parte de este trabajo';
    end if;
  end if;

  return new;
end; $$;

drop trigger if exists trg_jobs_rules on public.jobs;
create trigger trg_jobs_rules
  before update on public.jobs
  for each row execute function public.enforce_job_rules();


-- ═══════════════════════════════════════════════════════════════════════════
-- S4 · Una cotización VIVA por pintor y pedido
-- ═══════════════════════════════════════════════════════════════════════════
-- CORRECCIÓN CRÍTICA: la versión anterior indexaba (project_id, painter_id) para TODOS los
-- jobs. El seed genera un job por cada reseña, todos con el mismo project_id del pintor
-- (scripts/seed_supabase.py: `proj_by_owner.get(painter)` dentro del loop), así que había
-- hasta 9 duplicados y el CREATE INDEX fallaba — haciendo rollback de TODA la migración.
-- Acotado a status='quoted' se crea limpio y sigue impidiendo lo que importa: que un pintor
-- cotice el mismo pedido muchas veces y le dispare un email al cliente en cada intento.
drop index if exists public.uniq_jobs_quote_por_pintor;
create unique index if not exists uniq_jobs_quote_viva
  on public.jobs (project_id, painter_id)
  where status = 'quoted' and painter_id is not null and project_id is not null;


-- ═══════════════════════════════════════════════════════════════════════════
-- S10 · El teléfono deja de ser legible por cualquiera
-- ═══════════════════════════════════════════════════════════════════════════
-- `profiles_select_all using (true)` expone TODOS los perfiles a cualquier anónimo, con
-- teléfono incluido. La policy de FILAS no se toca: los pintores necesitan leer el nombre
-- del cliente que publicó un pedido (getOpenServiceRequests), y restringirla rompería
-- /trabajos.
--
-- CORRECCIÓN: `revoke select (phone)` a secas no hacía NADA. En Postgres los privilegios de
-- tabla y de columna son ACLs separadas y basta con que UNA conceda; Supabase corre
-- `grant all on all tables in schema public to anon, authenticated`, así que el permiso de
-- tabla seguía ganando. Para que el privilegio por columna signifique algo hay que sacar
-- primero el de tabla y devolver las columnas una por una.
--
-- MANTENIMIENTO: al agregar una columna nueva a `profiles` hay que sumarla acá, o no se
-- va a poder leer desde la app. Ninguna query usa select("*") sobre profiles (verificado),
-- así que este esquema es seguro hoy.
revoke select on public.profiles from anon, authenticated;
grant select (
  id, type, full_name, avatar_url, bio, location, lat, lng,
  verified, rating, rating_count, specialties, onboarded, pros, cons,
  created_at, updated_at
) on public.profiles to anon, authenticated;

-- El backend sigue viendo todo (incluido el teléfono) para poder contactar a las partes.
grant select on public.profiles to service_role;

-- OPCIONAL — decisión de producto, no de seguridad.
-- Hoy cualquier anónimo lista los pedidos de los clientes con zona y presupuesto. Si querés
-- exigir login para ver el tablero de trabajos, descomentá. Ojo: cambia el embudo de
-- /trabajos (hoy el visitante ve los pedidos y recién al cotizar se le pide cuenta).
-- El portfolio público (/obras) sigue abierto en los dos casos.
--
-- drop policy if exists "projects_select_pub_or_own" on public.projects;
-- create policy "projects_select_pub_or_own" on public.projects
--   for select using (
--     owner_id = auth.uid()
--     or (published and (type = 'portfolio' or auth.uid() is not null))
--   );


-- ╔══════════════════════════════════════════════════════════════════════╗
-- ║  0007_leads.sql                                                    ║
-- ╚══════════════════════════════════════════════════════════════════════╝

-- 0007_leads.sql
-- Persistencia de los formularios públicos.
--
-- PROBLEMA QUE RESUELVE: /cotizar, /contacto y /registro mostraban un mensaje de éxito
-- ("Te vamos a contactar en menos de 24 horas") y DESCARTABAN los datos. No se guardaba
-- nada ni se enviaba ningún aviso. Cada visitante que pedía presupuesto era un cliente
-- perdido, y el sitio le prometía algo que no iba a pasar.
--
-- Correr en Supabase → SQL Editor, después de 0006.

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


-- ╔══════════════════════════════════════════════════════════════════════╗
-- ║  0008_admin.sql                                                     ║
-- ╚══════════════════════════════════════════════════════════════════════╝

-- 0008_admin.sql
-- Separa "empresa" (rol de negocio) de "administrador" (privilegio de plataforma).
--
-- PROBLEMA QUE RESUELVE: `profiles.type = 'company'` significaba las dos cosas a la vez.
-- Y "Empresa" es una opción del formulario público de alta (/crear-cuenta) y del selector
-- de rol (/bienvenida), donde el valor viaja en raw_user_meta_data y `handle_new_user` lo
-- escribe tal cual. O sea: cualquiera se registraba eligiendo "Empresa" en un <select> y
-- entraba a /admin a leer nombre, email y teléfono de TODOS los prospectos — la lista que
-- 0007 dice explícitamente que no hay que servirle a la competencia.
--
-- Ahora el acceso de administración depende de una columna que el usuario no puede escribir.
--
-- Correr en Supabase → SQL Editor, después de 0007.


alter table public.profiles add column if not exists is_admin boolean not null default false;

comment on column public.profiles.is_admin is
  'Acceso al panel de administración. Sólo se puede activar con service-role (SQL Editor); '
  'el trigger freeze_profile_trust_fields lo congela para cualquier escritura del usuario.';

-- ── El usuario no puede auto-otorgarse admin ──────────────────────────
-- Se suma is_admin a los campos que el trigger revierte. Sin esto, `profiles_update_own`
-- (que permite escribir cualquier columna de la fila propia) haría inútil toda la columna.
create or replace function public.freeze_profile_trust_fields()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if public.es_service_role() then
    return new;
  end if;
  -- Recálculo legítimo del rating disparado por una reseña.
  if coalesce(current_setting('app.rating_recalc', true), 'off') = 'on' then
    return new;
  end if;
  if auth.uid() is null then
    return new;  -- contexto sin JWT (SQL Editor, migraciones)
  end if;

  new.verified     := old.verified;
  new.rating       := old.rating;
  new.rating_count := old.rating_count;
  new.is_admin     := old.is_admin;   -- el privilegio de plataforma nunca se auto-otorga

  -- El rol se elige UNA vez, en el onboarding. Después queda fijo, y `onboarded` no puede
  -- volver atrás: si se pudiera, alcanzaría con apagarlo para reabrir el cambio de rol.
  if old.onboarded then
    new.type      := old.type;
    new.onboarded := true;
  end if;

  return new;
end; $$;

-- ── Los leads pasan a depender de is_admin, no del rol de negocio ─────
drop policy if exists "leads_select_company" on public.leads;
drop policy if exists "leads_update_company" on public.leads;
drop policy if exists "leads_select_admin" on public.leads;
drop policy if exists "leads_update_admin" on public.leads;

create policy "leads_select_admin" on public.leads
  for select using (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin)
  );

create policy "leads_update_admin" on public.leads
  for update using (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin)
  );

-- ── Alta del primer administrador ─────────────────────────────────────
-- Si ya existe un perfil de empresa (el de la propia Pintura Pro, sembrado por
-- scripts/seed_supabase.py como empresa@pinturapro.demo), se lo marca como admin para no
-- quedar sin acceso al panel después de esta migración.
update public.profiles
   set is_admin = true
 where type = 'company'
   and id in (select id from public.profiles where type = 'company' order by created_at asc limit 1);

-- Para dar de alta otro administrador más adelante, desde el SQL Editor:
--   update public.profiles set is_admin = true where id = '<uuid del usuario>';



-- ╔══════════════════════════════════════════════════════════════════════╗
-- ║  0009_ciclo_trabajo.sql                                            ║
-- ╚══════════════════════════════════════════════════════════════════════╝

-- 0009_ciclo_trabajo.sql
-- Cierra el ciclo de vida del trabajo: el dinero deja de ser editable por el cliente, y
-- aceptar una cotización cierra el pedido y descarta las demás.
--
-- Correr en Supabase → SQL Editor, después de 0008.


-- ═══════════════════════════════════════════════════════════════════════════
-- 1 · El cliente no toca la plata, nunca
-- ═══════════════════════════════════════════════════════════════════════════
-- 0006 congelaba amount/commission_* sólo `if old.status <> 'quoted'`, y la validación de
-- montos vivía sólo en la policy de INSERT. Mientras la cotización estaba en 'quoted' el
-- cliente podía mandar un PATCH con {"amount":1,"commission_amount":0,"status":"accepted"}:
-- old.status era 'quoted' (no congelaba), la transición quoted→accepted le está permitida,
-- y quedaba registrado un trabajo de $1 con comisión $0.
--
-- Regla nueva: el dinero lo fija el PINTOR al cotizar y sólo él puede corregirlo mientras
-- siga en 'quoted'. El cliente no lo escribe en ningún estado.
create or replace function public.enforce_job_rules()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  actor_is_client  boolean := (auth.uid() = old.client_id);
  actor_is_painter boolean := (auth.uid() = old.painter_id);
  dinero_cambia    boolean := (new.amount            is distinct from old.amount)
                           or (new.commission_amount is distinct from old.commission_amount)
                           or (new.commission_rate   is distinct from old.commission_rate);
begin
  if public.es_service_role() or auth.uid() is null then
    return new;
  end if;

  -- Las partes no se reasignan. Pasar a NULL sí: es lo que hace la FK al borrarse el padre.
  if new.client_id is distinct from old.client_id and new.client_id is not null then
    raise exception 'No se puede reasignar el cliente del trabajo';
  end if;
  if new.painter_id is distinct from old.painter_id and new.painter_id is not null then
    raise exception 'No se puede reasignar el pintor del trabajo';
  end if;
  if new.project_id is distinct from old.project_id and new.project_id is not null then
    raise exception 'No se puede reasignar el pedido del trabajo';
  end if;

  -- ── Dinero ──
  if dinero_cambia then
    if actor_is_client then
      raise exception 'El cliente no puede modificar el monto ni la comisión';
    end if;
    if old.status <> 'quoted' then
      raise exception 'El monto ya no se puede cambiar: la cotización dejó de estar pendiente';
    end if;
    -- El pintor corrige su propia cotización: se revalida la aritmética de la comisión.
    if new.amount is null or new.amount <= 0 or new.amount > 1000000000 then
      raise exception 'Monto fuera de rango';
    end if;
    if coalesce(new.commission_rate, 0.100) <> 0.100
       or new.commission_amount is null
       or abs(new.commission_amount - round(new.amount * coalesce(new.commission_rate, 0.100))) > 1 then
      raise exception 'La comisión no corresponde al monto';
    end if;
  end if;

  -- ── Transiciones ──
  if new.status is distinct from old.status then
    if actor_is_client then
      if not (
        (old.status = 'quoted'      and new.status in ('accepted', 'cancelled')) or
        (old.status = 'accepted'    and new.status = 'cancelled') or
        (old.status = 'in_progress' and new.status = 'cancelled')
      ) then
        raise exception 'Transición no permitida para el cliente: % -> %', old.status, new.status;
      end if;
    elsif actor_is_painter then
      -- El pintor NO acepta su propia cotización: eso lo decide el cliente.
      if not (
        (old.status = 'quoted'      and new.status = 'cancelled') or   -- retirar la cotización
        (old.status = 'accepted'    and new.status in ('in_progress', 'completed', 'cancelled')) or
        (old.status = 'in_progress' and new.status in ('completed', 'cancelled'))
      ) then
        raise exception 'Transición no permitida para el pintor: % -> %', old.status, new.status;
      end if;
    else
      raise exception 'No sos parte de este trabajo';
    end if;
  end if;

  return new;
end; $$;


-- ═══════════════════════════════════════════════════════════════════════════
-- 2 · Aceptar cierra el pedido y descarta las cotizaciones perdedoras
-- ═══════════════════════════════════════════════════════════════════════════
-- Sin esto el pedido seguía publicado para siempre: pintores nuevos cotizaban un trabajo ya
-- adjudicado (y terminado), el cliente recibía emails de algo que ya pintó, y /trabajos se
-- llenaba de pedidos zombis. Las cotizaciones perdedoras además quedaban en 'quoted' para
-- siempre, sin que el pintor se enterara nunca de que perdió.
create or replace function public.on_job_accepted()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.status = 'accepted' and old.status is distinct from 'accepted' and new.project_id is not null then
    -- El pedido sale del tablero.
    update public.projects set published = false where id = new.project_id;

    -- Las demás cotizaciones del mismo pedido se cancelan.
    update public.jobs
       set status = 'cancelled'
     where project_id = new.project_id
       and id <> new.id
       and status = 'quoted';
  end if;
  return new;
end; $$;

drop trigger if exists trg_job_accepted on public.jobs;
create trigger trg_job_accepted
  after update on public.jobs
  for each row execute function public.on_job_accepted();


-- ═══════════════════════════════════════════════════════════════════════════
-- 3 · Reabrir el pedido si el trabajo se cancela
-- ═══════════════════════════════════════════════════════════════════════════
-- Si el pintor abandona y el cliente cancela, el pedido tiene que volver al tablero para
-- que pueda contratar a otro. Sin esto, cancelar dejaba al cliente igual de trabado.
create or replace function public.on_job_cancelled()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.status = 'cancelled' and old.status in ('accepted', 'in_progress') and new.project_id is not null then
    -- Sólo se reabre si no quedó otro trabajo vivo sobre el mismo pedido.
    if not exists (
      select 1 from public.jobs j
      where j.project_id = new.project_id
        and j.id <> new.id
        and j.status in ('accepted', 'in_progress', 'completed')
    ) then
      update public.projects set published = true where id = new.project_id;
    end if;
  end if;
  return new;
end; $$;

drop trigger if exists trg_job_cancelled on public.jobs;
create trigger trg_job_cancelled
  after update on public.jobs
  for each row execute function public.on_job_cancelled();



-- ╔══════════════════════════════════════════════════════════════════════╗
-- ║  0010_fix_leads_admin_grant.sql                                    ║
-- ╚══════════════════════════════════════════════════════════════════════╝

-- 0010: is_admin quedó sin GRANT de columna, así que ninguna policy que lo lea podía correr.
--
-- 0008_admin.sql agregó `profiles.is_admin` y reescribió las policies de `leads` para
-- depender de él (`exists (select ... where p.id = auth.uid() and p.is_admin)`), pero
-- 0006_security.sql ya había revocado el SELECT de tabla en `profiles` y sólo re-otorgó una
-- lista fija de columnas — lista armada antes de que `is_admin` existiera. Postgres exige
-- privilegio de columna sobre TODO lo que una policy de RLS toca, sin importar si la fila
-- termina pasando el filtro. Resultado: cualquier lectura de `leads` (admin, no-admin, o
-- anon) tiraba "permission denied for table profiles" en vez de filtrar como corresponde —
-- el propio admin quedaba tan bloqueado como cualquiera. `getLeads()` lo tragaba y
-- devolvía `[]` en silencio, así que /admin mostraba "sin leads" siempre.
--
-- `is_admin` es un booleano de bajo riesgo (indica "esta cuenta es la operadora de la
-- plataforma", no una credencial) — se lo otorga también a `anon` para que una lectura sin
-- sesión de /leads devuelva una lista vacía limpia en vez de un error de permisos.
grant select (is_admin) on public.profiles to anon, authenticated;


-- ╔══════════════════════════════════════════════════════════════════════╗
-- ║  0011_contacto.sql                                                 ║
-- ╚══════════════════════════════════════════════════════════════════════╝

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


-- ╔══════════════════════════════════════════════════════════════════════╗
-- ║  0012_metricas.sql                                                 ║
-- ╚══════════════════════════════════════════════════════════════════════╝

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


-- ╔══════════════════════════════════════════════════════════════════════╗
-- ║  0013_privacidad_clientes.sql                                      ║
-- ╚══════════════════════════════════════════════════════════════════════╝

-- 0013: dejar de publicar el domicilio de los clientes.
--
-- Hallazgo de la auditoría: sin ninguna sesión, con la anon key que viaja en el bundle del
-- navegador, cualquiera se bajaba el padrón completo de clientes con nombre, barrio y
-- coordenadas:
--
--   curl "$URL/rest/v1/profiles?select=full_name,lat,lng&type=eq.client" -H "apikey: $ANON"
--   → [{"full_name":"Carolina Ruiz","lat":-34.6395,"lng":-58.3795}, ...]
--
-- Eso es la casa de una persona con ~11 metros de precisión. Los pintores en el mapa son
-- deliberadamente públicos; los clientes nunca tuvieron que estarlo, y de hecho NINGÚN
-- formulario de la app escribe lat/lng — a los clientes les llegó sólo por el seed.
--
-- Se arregla en dos capas independientes, porque una sola no alcanza:

-- ── Capa 1: las coordenadas salen del alcance público ─────────────────
-- Un grant de columna no distingue filas, así que mientras `lat`/`lng` estén otorgadas se
-- pueden leer de CUALQUIER perfil. Se las sacamos a todos y el mapa pasa a servirse por una
-- función que sólo devuelve pintores. Así la fuga no puede volver por un cambio de policy.
revoke select (lat, lng) on public.profiles from anon, authenticated;

-- Limpieza del dato que nunca debió estar: coordenadas de quien no es pintor.
update public.profiles set lat = null, lng = null where type <> 'painter';

-- El mapa de /mapa y /pintores. Es público a propósito: un pintor se publica para que lo
-- encuentren. Devuelve SÓLO pintores, así que no hay forma de pedirle un cliente.
create or replace function public.pintores_geolocalizados()
returns table (id uuid, lat double precision, lng double precision)
language sql
stable
security definer
set search_path = public
as $$
  select p.id, p.lat, p.lng
  from public.profiles p
  where p.type = 'painter'
    and p.lat is not null
    and p.lng is not null;
$$;

-- PUBLIC (default de Postgres) y anon (default privileges de Supabase) — hacen falta los dos
-- revokes, ver la nota en 0011. Acá sí se lo devolvemos a anon: el mapa se ve sin login.
revoke execute on function public.pintores_geolocalizados() from public, anon;
grant execute on function public.pintores_geolocalizados() to anon, authenticated;

-- ── Capa 2: el padrón deja de ser enumerable sin sesión ───────────────
-- `profiles_select_all using (true)` dejaba listar a todo el mundo. Ahora, sin sesión sólo se
-- ven los perfiles que existen para ser vistos (pintores y empresas).
--
-- Con sesión se sigue viendo todo, y es a propósito: hay pantallas legítimas que necesitan el
-- nombre de un cliente —el pintor mirando los pedidos abiertos de /trabajos, el autor de una
-- reseña en el perfil público, los testimonios de la home— y restringirlas rompería el
-- producto sin ganar mucho: cualquiera puede crearse una cuenta. Lo que esta capa corta es el
-- scrapeo masivo y anónimo con la llave que ya está publicada en el bundle. El dato sensible
-- de verdad (teléfono, coordenadas, is_admin) ya no se puede leer por columna, sin importar
-- la fila.
drop policy if exists "profiles_select_all" on public.profiles;
drop policy if exists "profiles_select_publicos_o_con_sesion" on public.profiles;
create policy "profiles_select_publicos_o_con_sesion" on public.profiles
  for select using (
    type in ('painter', 'company')   -- el directorio, visible para cualquiera
    or auth.uid() is not null        -- con sesión, el resto de la app funciona igual
  );

comment on function public.pintores_geolocalizados() is
  'Coordenadas para el mapa. Existe porque lat/lng dejó de estar en el grant de columna de '
  'profiles: era la casa de cada cliente, legible por cualquiera con la anon key.';


-- ╔══════════════════════════════════════════════════════════════════════╗
-- ║  0014_pedidos_coherentes.sql                                       ║
-- ╚══════════════════════════════════════════════════════════════════════╝

-- 0014: el pintor pierde el título de su trabajo, y hay pedidos terminados en el tablero.
--
-- Los dos salieron del recorrido de QA y tienen la misma raíz: `projects.published` es a la
-- vez el estado del pedido Y la llave de lectura, así que cerrar un pedido también se lo
-- esconde a quien lo está trabajando.

-- ── 1. El pintor tiene que poder leer el pedido que está haciendo ─────
-- `projects_select_pub_or_own` deja ver un proyecto sólo si está publicado o si sos el dueño.
-- Cuando el cliente acepta una cotización, el trigger `on_job_accepted` (0009) pone
-- `published = false` para sacarlo del tablero — y en ese mismo momento el pintor deja de
-- poder leerlo. Efecto: en su panel los trabajos aparecían todos como "Trabajo", sin título,
-- imposibles de distinguir entre sí justo cuando ya los había ganado.
drop policy if exists "projects_select_pub_or_own" on public.projects;
drop policy if exists "projects_select_pub_own_o_adjudicado" on public.projects;
create policy "projects_select_pub_own_o_adjudicado" on public.projects
  for select using (
    published
    or owner_id = auth.uid()
    -- El pintor con un trabajo sobre este pedido lo sigue viendo, aunque ya no esté publicado.
    or exists (
      select 1 from public.jobs j
      where j.project_id = projects.id
        and j.painter_id = auth.uid()
    )
  );

-- ── 2. Un pedido ya adjudicado no vuelve al tablero ───────────────────
-- `getOpenServiceRequests` confía sólo en `published`, así que cualquier desincronización de
-- esa columna republica un trabajo terminado. Pasó de verdad: el seed INSERTA los jobs ya en
-- estado 'completed', y como `on_job_accepted` es un trigger AFTER UPDATE, nunca se disparó
-- para ellos. Resultado: pedidos terminados ofreciéndose para cotizar.
--
-- Se reconcilia el dato existente...
update public.projects pr
set published = false
where pr.type = 'service'
  and pr.published
  and exists (
    select 1 from public.jobs j
    where j.project_id = pr.id
      and j.status in ('accepted', 'in_progress', 'completed')
  );

-- ...y se agrega la red de contención, para que la coherencia no dependa de que el trigger
-- haya corrido: el tablero se arma con esta función, que mira el estado real de los trabajos.
create or replace function public.pedidos_abiertos(limite int default 50)
returns table (
  id uuid,
  title text,
  description text,
  location text,
  budget_min int,
  budget_max int,
  owner_id uuid,
  created_at timestamptz
)
language sql
stable
security invoker  -- respeta la RLS de arriba a propósito: no hay nada que elevar acá
set search_path = public
as $$
  select pr.id, pr.title, pr.description, pr.location, pr.budget_min, pr.budget_max,
         pr.owner_id, pr.created_at
  from public.projects pr
  where pr.type = 'service'
    and pr.published
    -- La condición que faltaba: aunque `published` quedara mal, un pedido con un trabajo ya
    -- adjudicado no se ofrece de nuevo.
    and not exists (
      select 1 from public.jobs j
      where j.project_id = pr.id
        and j.status in ('accepted', 'in_progress', 'completed')
    )
  order by pr.created_at desc
  limit greatest(1, least(coalesce(limite, 50), 100));
$$;

-- Se le da también a `anon` a propósito: /trabajos es una página PÚBLICA — es como un
-- pintor descubre la plataforma antes de registrarse. La función es `security invoker`, así
-- que sigue respetando la RLS: un anónimo ve exactamente los pedidos publicados que ya podía
-- ver con el select directo, ni uno más.
revoke execute on function public.pedidos_abiertos(int) from public;
grant execute on function public.pedidos_abiertos(int) to anon, authenticated;

comment on function public.pedidos_abiertos(int) is
  'El tablero de /trabajos. Filtra por estado real de los jobs, no sólo por projects.published, '
  'que puede quedar desincronizado (el seed inserta jobs completados sin disparar el trigger).';




-- ╔══════════════════════════════════════════════════════════════════════╗
-- ║  0015_una_sola_adjudicacion.sql                                    ║
-- ╚══════════════════════════════════════════════════════════════════════╝

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
