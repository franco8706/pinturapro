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
