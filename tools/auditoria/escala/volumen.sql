-- ═══════════════════════════════════════════════════════════════════════════
-- volumen.sql — Pintura Pro a escala, sin tocar la base de verdad
-- ═══════════════════════════════════════════════════════════════════════════
-- Agente: escala-y-volumen (papel base), ronda 2026-09-28-escala.
--
-- QUÉ HACE: abre una transacción, genera ~300.000 filas sintéticas (pintores,
-- clientes, obras, pedidos, trabajos y reseñas) con generate_series, corre
-- `explain (analyze, buffers)` de las consultas REALES de `apps/web/lib/queries.ts`
-- y de las funciones `security definer` de las migraciones —como `anon` y como
-- `authenticated` con un JWT simulado, para que las policies de RLS se apliquen
-- de verdad— y termina con `rollback`. Nada de esto queda escrito.
--
-- NUNCA HAY UN COMMIT EN ESTE ARCHIVO. Si alguna vez lo editás, no le agregues uno.
--
-- CÓMO LEER LA SALIDA: cada bloque imprime un \echo con lo que mide. Dentro de
-- cada bloque, `pg_temp.explain_it('etiqueta', 'consulta')` imprime el plan real
-- con NOTICE — buscá "Seq Scan", "Sort", el tiempo total ("actual time=…") y
-- "Trigger …: time=…" en las pruebas de triggers. Si una prueba puntual falla,
-- imprime "¡FALLÓ!" y el motivo, y el resto del archivo sigue corriendo: nada
-- de esto aborta la transacción completa gracias a los bloques `do $$ … exception
-- when others …$$`.
--
-- EL PROBLEMA DE FONDO Y CÓMO SE RESUELVE ACÁ:
-- `profiles.id` referencia `auth.users(id)`, y no tenemos alta por GoTrue para
-- crear 3.000 usuarios reales dentro de una transacción de auditoría. La salida
-- (Plan A, lo que este archivo intenta primero) es soltar TEMPORALMENTE la
-- restricción `profiles_id_fkey` con `alter table … drop constraint` — es DDL
-- transaccional: el `rollback` del final la repone sola, tal cual estaba. Con
-- la restricción suelta, se generan ids determinísticos (no aleatorios, para
-- poder referenciarlos después sin tener que volver a consultarlos) y se
-- insertan directo en `profiles`, `projects`, `jobs` y `reviews`.
--
-- Si el rol con el que corre este archivo NO tiene permiso para tocar esa
-- restricción (no debería pasar: es el mismo rol que corrió las migraciones y
-- por lo tanto es dueño de las tablas, pero se prueba y se avisa igual), el
-- Bloque 3 lo nota y el Bloque 4 (Plan B) arma los pedidos/trabajos/reseñas
-- igual, pero reciclando los pocos perfiles REALES que ya existen (los 3
-- pintores demo) en vez de crear 3.000 nuevos. Eso alcanza para medir el
-- tamaño de `jobs`/`reviews`/`projects` a escala, pero NO alcanza para probar
-- el directorio `/pintores` con 3.000 pintores de verdad — esa prueba puntual
-- quedaría pendiente de una carga real (vía la API de Supabase, no SQL directo).
--
-- Mientras se generan los datos, se desactivan los triggers de las 4 tablas
-- grandes (con `alter table … disable trigger all`, también DDL transaccional):
-- sin esto, insertar 100.000 reseñas dispara `recalc_profile_rating` 100.000
-- veces —cada una reagregando las reseñas del pintor hasta ese momento— y el
-- costo total pasa a ser cuadrático. Los triggers se reactivan antes del
-- Bloque 7, que mide a propósito cuánto cuesta CADA UNO ya con el volumen
-- generado (revisá los "Trigger …: time=" en esa sección).
--
-- TAMAÑOS: 3.000 pintores + 4.000 clientes, ~9.000 obras de portfolio,
-- ~50.500 pedidos (uno "estrella" con 500 cotizaciones vivas), ~203.500
-- trabajos/cotizaciones, ~103.000 reseñas (3.000 de ellas sobre un único
-- "pintor estrella", para medir el costo del recálculo de rating al límite).
-- Si tarda demasiado en el plan gratuito, bajá los números de la sección
-- "Parámetros" y volvé a correrlo.
-- ═══════════════════════════════════════════════════════════════════════════

\set ON_ERROR_STOP off
\timing on

-- ───────────────────────── Parámetros (ajustables) ─────────────────────────
-- (antes \set N_PAINTERS 3000: psql no reemplaza variables dentro de $$...$$, el generador está adentro de uno)
-- (antes \set N_CLIENTES 4000: psql no reemplaza variables dentro de $$...$$, el generador está adentro de uno)
-- (antes \set N_OBRAS 9000: psql no reemplaza variables dentro de $$...$$, el generador está adentro de uno)
-- (antes \set N_PEDIDOS 50000: psql no reemplaza variables dentro de $$...$$, el generador está adentro de uno)
-- (antes \set N_TRABAJOS 200000: psql no reemplaza variables dentro de $$...$$, el generador está adentro de uno)
-- (antes \set N_RESENIAS 100000: psql no reemplaza variables dentro de $$...$$, el generador está adentro de uno)

\echo '═══ Arranca la transacción. TODO se deshace con rollback al final. ═══'
begin;
set local statement_timeout = '8min';

-- ═══════════════════════════════════════════════════════════════════════════
\echo ''
\echo '=== Bloque 1: funciones auxiliares (viven sólo en esta sesión, pg_temp) ==='
-- ═══════════════════════════════════════════════════════════════════════════
-- Ids determinísticos por número de fila: evita tener que volver a consultar
-- "¿qué id le tocó al pintor #1?" más adelante — es siempre el mismo cálculo.
-- Un prefijo por tabla para que nunca choquen entre sí ni con datos reales
-- (gen_random_uuid() de la base real casi nunca cae en estos rangos).
create function pg_temp.uid_p(n bigint) returns uuid language sql immutable as
  $$ select ('a0000000-0000-4000-8000-' || lpad(to_hex(n), 12, '0'))::uuid $$;
create function pg_temp.uid_c(n bigint) returns uuid language sql immutable as
  $$ select ('b0000000-0000-4000-8000-' || lpad(to_hex(n), 12, '0'))::uuid $$;
create function pg_temp.uid_o(n bigint) returns uuid language sql immutable as
  $$ select ('c0000000-0000-4000-8000-' || lpad(to_hex(n), 12, '0'))::uuid $$;
create function pg_temp.uid_d(n bigint) returns uuid language sql immutable as
  $$ select ('d0000000-0000-4000-8000-' || lpad(to_hex(n), 12, '0'))::uuid $$;
create function pg_temp.uid_j(n bigint) returns uuid language sql immutable as
  $$ select ('e0000000-0000-4000-8000-' || lpad(to_hex(n), 12, '0'))::uuid $$;
create function pg_temp.uid_r(n bigint) returns uuid language sql immutable as
  $$ select ('f0000000-0000-4000-8000-' || lpad(to_hex(n), 12, '0'))::uuid $$;

-- El helper que hace que todo el resto del archivo sea tolerante a fallos:
-- corre un EXPLAIN (ANALYZE, BUFFERS) y lo imprime línea por línea con NOTICE.
-- Si la consulta de adentro falla (tabla vacía por el plan B, permiso que
-- falta, lo que sea), el error queda anotado y NO aborta la transacción —cada
-- llamada tiene su propio savepoint implícito, que es lo que da PL/pgSQL al
-- entrar a un bloque con EXCEPTION.
create function pg_temp.explain_it(etiqueta text, consulta text) returns void
language plpgsql as $$
declare r record;
begin
  raise notice '----- % -----', etiqueta;
  for r in execute 'explain (analyze, buffers, format text) ' || consulta loop
    raise notice '%', r."QUERY PLAN";
  end loop;
exception when others then
  raise notice '¡FALLÓ! % -> %', etiqueta, sqlerrm;
end;
$$;

-- ═══════════════════════════════════════════════════════════════════════════
\echo ''
\echo '=== Bloque 2: soltar la FK de profiles→auth.users y apagar triggers ==='
\echo '    (los dos son DDL transaccional: el rollback final los repone solos) ==='
-- ═══════════════════════════════════════════════════════════════════════════
do $$
begin
  begin
    alter table public.profiles drop constraint if exists profiles_id_fkey;
    raise notice 'OK: profiles_id_fkey suelta (o no existía). Plan A habilitado.';
  exception when others then
    raise notice '¡FALLÓ! No se pudo soltar profiles_id_fkey (%). Va Plan B en el Bloque 4.', sqlerrm;
  end;

  begin
    alter table public.profiles disable trigger user;
    alter table public.projects disable trigger user;
    alter table public.jobs     disable trigger user;
    alter table public.reviews  disable trigger user;
    raise notice 'OK: triggers desactivados en profiles/projects/jobs/reviews para la carga masiva.';
  exception when others then
    raise notice '¡FALLÓ! No se pudieron desactivar los triggers (%). La carga va a ser más lenta '
                 'y puede chocar con una_sola_adjudicacion/recalc_profile_rating; puede convenir '
                 'bajar los N_* de la cabecera.', sqlerrm;
  end;
end $$;

-- ═══════════════════════════════════════════════════════════════════════════
\echo ''
\echo '=== Bloque 3 (Plan A): generar 3.000 pintores + 4.000 clientes + obras + ==='
\echo '    pedidos + trabajos + reseñas, con ids determinísticos ==='
-- ═══════════════════════════════════════════════════════════════════════════
-- Todo en UN solo bloque: si algo de acá adentro falla, el bloque entero se
-- deshace a su propio savepoint (no deja pintores a medio crear) y el Bloque 4
-- (Plan B) se hace cargo, detectando que esto no corrió.
do $$
begin
  -- Pintores.
  insert into public.profiles
    (id, type, full_name, bio, location, lat, lng, verified, rating, rating_count,
     specialties, onboarded, is_admin, created_at, updated_at)
  select
    pg_temp.uid_p(n), 'painter'::profile_type,
    'ZZAGENT Pintor Sintético ' || n,
    'Bio sintética del pintor #' || n || ' generada para pruebas de escala.',
    (array['CABA','Zona Norte','Zona Sur','Zona Oeste','La Plata'])[1 + (n % 5)],
    -34.9 + random(), -58.9 + random(),
    (n % 4 = 0), round((3 + random() * 2)::numeric, 1), 0,
    array['Interior','Exterior'], true, false,
    now() - (random() * interval '600 days'), now()
  from generate_series(1, 3000) as n;

  -- Clientes.
  insert into public.profiles (id, type, full_name, bio, location, onboarded, created_at, updated_at)
  select
    pg_temp.uid_c(n), 'client'::profile_type,
    'ZZAGENT Cliente Sintético ' || n,
    null,
    (array['CABA','Zona Norte','Zona Sur','Zona Oeste','La Plata'])[1 + (n % 5)],
    true,
    now() - (random() * interval '600 days'), now()
  from generate_series(1, 4000) as n;

  -- El cliente #1 hace doble función: dueño del "pedido estrella" (500
  -- cotizaciones vivas) y admin sintético, para poder medir metricas_plataforma().
  update public.profiles set is_admin = true where id = pg_temp.uid_c(1);

  -- Obras de portfolio, repartidas entre los 3.000 pintores.
  insert into public.projects
    (id, owner_id, type, title, slug, description, images, location, published,
     created_at, updated_at, category, accent_color)
  select
    pg_temp.uid_o(n), pg_temp.uid_p(1 + (n % 3000)), 'portfolio'::project_type,
    'ZZAGENT Obra sintética ' || n, 'zzagent-obra-' || n,
    'Descripción de la obra sintética número ' || n || ' para pruebas de volumen.',
    '{}'::text[],
    (array['CABA','Zona Norte','Zona Sur'])[1 + (n % 3)],
    true,
    now() - (random() * interval '400 days'), now(),
    (array['Residencial','Comercial','Industrial']::project_category[])[1 + (n % 3)],
    (array['#C41E3A','#1E3A8A','#2D5A3D'])[1 + (n % 3)]
  from generate_series(1, 9000) as n;

  -- Pedidos de servicio ("trabajos" que publica un cliente), 80% abiertos.
  insert into public.projects
    (id, owner_id, type, title, slug, description, location, budget_min, budget_max,
     published, created_at, updated_at, category)
  select
    pg_temp.uid_d(n), pg_temp.uid_c(1 + (n % 4000)), 'service'::project_type,
    'ZZAGENT Pedido sintético ' || n, 'zzagent-pedido-' || n,
    'Pedido sintético número ' || n || ' para pruebas de volumen.',
    (array['CABA','Zona Norte','Zona Sur'])[1 + (n % 3)],
    50000 + (n % 20) * 10000, 150000 + (n % 20) * 20000,
    (n % 5 <> 0),
    now() - (random() * interval '300 days'), now(),
    'Residencial'::project_category
  from generate_series(1, 50000) as n;

  -- El "pedido estrella": el que va a recibir 500 cotizaciones vivas.
  insert into public.projects
    (id, owner_id, type, title, slug, description, location, published, created_at, updated_at, category)
  values (
    '00000000-0000-4000-a000-000000000001'::uuid, pg_temp.uid_c(1), 'service',
    'ZZAGENT Pedido estrella (500 cotizaciones)', 'zzagent-pedido-estrella',
    'Pedido usado para medir el costo real de 500 cotizaciones vivas sobre un mismo pedido '
    '(jobs_insert_painter_quote, una_sola_adjudicacion, on_job_accepted).',
    'CABA', true, now() - interval '10 days', now(), 'Residencial'
  );

  -- Trabajos/cotizaciones "normales": mezcla de estados (NO respeta las reglas
  -- de negocio a propósito —los triggers están apagados—, sólo importa el
  -- volumen y la forma de los datos para el plan de consultas).
  insert into public.jobs
    (id, project_id, client_id, painter_id, status, amount, commission_rate,
     commission_amount, note, created_at, updated_at)
  select
    pg_temp.uid_j(n), pg_temp.uid_d(pedido_n), pg_temp.uid_c(1 + (pedido_n % 4000)),
    -- `+ n / 150000`: sin esto la pareja pintor-pedido se repite cada mcm(3000, 50000) =
    -- 150.000 trabajos y choca con uniq_jobs_quote_viva (corregido por el orquestador, 29/9).
    pg_temp.uid_p(1 + ((n + n / 150000) % 3000)),
    (case
       when n % 20 = 0 then 'completed'
       when n % 20 = 1 then 'accepted'
       when n % 20 = 2 then 'in_progress'
       when n % 15 = 0 then 'cancelled'
       else 'quoted'
     end)::job_status,
    50000 + (n % 40) * 15000, 0.100,
    round((50000 + (n % 40) * 15000) * 0.100),
    'ZZAGENT nota de cotización sintética ' || n,
    now() - (random() * interval '250 days'), now()
  from (select n, 1 + (n % 50000) as pedido_n from generate_series(1, 200000) as n) base;

  -- 500 cotizaciones vivas sobre el pedido estrella, cada una de un pintor distinto.
  insert into public.jobs
    (id, project_id, client_id, painter_id, status, amount, commission_rate, commission_amount, note, created_at, updated_at)
  select
    ('00000000-0000-4000-a000-' || lpad(to_hex(100000 + n), 12, '0'))::uuid,
    '00000000-0000-4000-a000-000000000001'::uuid, pg_temp.uid_c(1),
    pg_temp.uid_p(1 + (n % 3000)), 'quoted'::job_status,
    200000, 0.100, 20000,
    'ZZAGENT cotización sobre el pedido estrella ' || n,
    now() - (random() * interval '5 days'), now()
  from generate_series(1, 500) as n;

  -- Reseñas "normales", una por trabajo (mismo n que su job).
  insert into public.reviews (id, job_id, author_id, target_id, rating, comment, created_at)
  select
    pg_temp.uid_r(n), pg_temp.uid_j(n),
    pg_temp.uid_c(1 + ((1 + (n % 50000)) % 4000)),
    pg_temp.uid_p(1 + (n % 3000)),
    1 + (n % 5),
    (case when n % 3 = 0 then 'ZZAGENT Buen trabajo, cumplió los tiempos. Reseña sintética ' || n else null end),
    now() - (random() * interval '200 days')
  from generate_series(1, 100000) as n;

  -- El "pintor estrella": 3.000 trabajos completados y 3.000 reseñas propias,
  -- todas apuntando al mismo pintor (#1), para medir getReviewsForPainter() y
  -- el costo real de recalc_profile_rating con el peor caso de la auditoría.
  insert into public.jobs
    (id, project_id, client_id, painter_id, status, amount, commission_rate, commission_amount, created_at, updated_at)
  select
    ('00000000-0000-4000-b000-' || lpad(to_hex(n), 12, '0'))::uuid,
    pg_temp.uid_d(1 + (n % 50000)), pg_temp.uid_c(1 + (n % 4000)),
    pg_temp.uid_p(1), 'completed'::job_status, 180000, 0.100, 18000,
    now() - (random() * interval '900 days'), now()
  from generate_series(1, 3000) as n;

  insert into public.reviews (id, job_id, author_id, target_id, rating, comment, created_at)
  select
    ('00000000-0000-4000-b000-' || lpad(to_hex(100000 + n), 12, '0'))::uuid,
    ('00000000-0000-4000-b000-' || lpad(to_hex(n), 12, '0'))::uuid,
    pg_temp.uid_c(1 + (n % 4000)), pg_temp.uid_p(1), 1 + (n % 5),
    'ZZAGENT reseña sintética para el pintor estrella ' || n,
    now() - (random() * interval '900 days')
  from generate_series(1, 3000) as n;

  update public.profiles set
    rating = coalesce((select round(avg(rating)::numeric, 1) from public.reviews where target_id = pg_temp.uid_p(1)), 0),
    rating_count = (select count(*) from public.reviews where target_id = pg_temp.uid_p(1))
  where id = pg_temp.uid_p(1);

  raise notice 'OK Plan A: % pintores, % clientes, % obras, % pedidos (+1 estrella), '
               '% trabajos (+500 estrella +3000 pintor-estrella), % reseñas (+3000 pintor-estrella).',
    3000, 4000, 9000, 50000, 200000, 100000;
exception when others then
  raise notice '¡FALLÓ el Plan A completo! Motivo: %. Se deshace todo este bloque '
               'y sigue el Plan B en el Bloque 4.', sqlerrm;
end $$;

-- ═══════════════════════════════════════════════════════════════════════════
\echo ''
\echo '=== Bloque 4 (Plan B, sólo si el 3 falló): reciclar perfiles REALES ==='
\echo '    para poblar projects/jobs/reviews igual, sin poder sumar pintores nuevos ==='
-- ═══════════════════════════════════════════════════════════════════════════
do $$
declare
  ya_esta boolean;
  n_pintores_reales int;
  n_clientes_reales int;
begin
  select exists(select 1 from public.profiles where id = pg_temp.uid_p(1)) into ya_esta;
  if ya_esta then
    raise notice 'Plan A ya generó los datos: el Plan B no hace falta y no corre.';
    return;
  end if;

  raise notice 'Plan A no dejó datos (revisá el motivo en el Bloque 3). Arranca el Plan B: '
               'se reciclan los perfiles reales que ya existen en la base para poblar '
               'projects/jobs/reviews a volumen. El directorio /pintores con 3.000 pintores '
               'de verdad NO se puede probar así — hace falta alta real (API de Supabase).';

  select count(*) into n_pintores_reales from public.profiles where type in ('painter', 'company');
  select count(*) into n_clientes_reales from public.profiles where type = 'client';
  raise notice 'Perfiles reales disponibles para reciclar: % pintores/empresas, % clientes.',
    n_pintores_reales, n_clientes_reales;

  if n_pintores_reales = 0 or n_clientes_reales = 0 then
    raise notice '¡FALLÓ! No hay perfiles reales de algún tipo para reciclar. El Plan B no puede generar nada.';
    return;
  end if;

  create temporary table tmp_pintores_reales as
    select row_number() over () as rn, id from public.profiles where type in ('painter','company');
  create temporary table tmp_clientes_reales as
    select row_number() over () as rn, id from public.profiles where type = 'client';

  insert into public.projects
    (id, owner_id, type, title, slug, description, location, budget_min, budget_max,
     published, created_at, updated_at, category)
  select
    gen_random_uuid(), (select id from tmp_clientes_reales where rn = 1 + (n % n_clientes_reales)),
    'service'::project_type, 'ZZAGENT Pedido sintético (plan B) ' || n, 'zzagent-planb-pedido-' || n,
    'Pedido sintético (plan B) número ' || n || '.',
    (array['CABA','Zona Norte','Zona Sur'])[1 + (n % 3)],
    50000, 150000, (n % 5 <> 0), now() - (random() * interval '300 days'), now(), 'Residencial'
  from generate_series(1, 50000) as n;

  insert into public.jobs
    (id, project_id, client_id, painter_id, status, amount, commission_rate, commission_amount, created_at, updated_at)
  select
    gen_random_uuid(),
    (select id from public.projects where slug = 'zzagent-planb-pedido-' || (1 + (n % 50000))),
    (select id from tmp_clientes_reales where rn = 1 + (n % n_clientes_reales)),
    (select id from tmp_pintores_reales where rn = 1 + (n % n_pintores_reales)),
    (case when n % 20 = 0 then 'completed' when n % 15 = 0 then 'cancelled' else 'quoted' end)::job_status,
    50000 + (n % 40) * 15000, 0.100, round((50000 + (n % 40) * 15000) * 0.100),
    now() - (random() * interval '250 days'), now()
  from generate_series(1, 200000) as n;

  -- Una reseña por trabajo 'completed' ya generado arriba (hasta N_RESENIAS o los que
  -- haya, lo que sea menor). CTE con row_number en vez de OFFSET por fila: la versión
  -- con OFFSET escalaba O(n²) y además no acotaba bien cuando hay menos completados
  -- que N_RESENIAS.
  insert into public.reviews (id, job_id, author_id, target_id, rating, comment, created_at)
  select gen_random_uuid(), job_id, client_id, painter_id, 1 + (rn % 5)::int,
         'ZZAGENT reseña sintética (plan B) ' || rn, now() - (random() * interval '200 days')
  from (
    select j.id as job_id, j.client_id, j.painter_id, row_number() over (order by j.id) as rn
    from public.jobs j
    where j.status = 'completed' and j.note is null
    limit 100000
  ) candidatos;

  raise notice 'OK Plan B: pedidos/trabajos/reseñas generados reciclando % pintores reales.', n_pintores_reales;
exception when others then
  raise notice '¡FALLÓ el Plan B! (%). No queda volumen sintético cargado: las pruebas de '
               'los bloques siguientes van a fallar contra tablas vacías, y eso también es '
               'información (ver los "¡FALLÓ!" de cada una).', sqlerrm;
end $$;

-- ═══════════════════════════════════════════════════════════════════════════
\echo ''
\echo '=== Bloque 5: ANALYZE — sin esto el planificador usa estadísticas viejas ==='
\echo '    (de la base con 3 pintores) y los planes no reflejan el volumen nuevo ==='
-- ═══════════════════════════════════════════════════════════════════════════
analyze public.profiles;
analyze public.projects;
analyze public.jobs;
analyze public.reviews;

-- ═══════════════════════════════════════════════════════════════════════════
\echo ''
\echo '=== Bloque 6: reactivar los triggers (para medir su costo real a continuación) ==='
-- ═══════════════════════════════════════════════════════════════════════════
do $$
begin
  alter table public.profiles enable trigger user;
  alter table public.projects enable trigger user;
  alter table public.jobs     enable trigger user;
  alter table public.reviews  enable trigger user;
  raise notice 'OK: triggers reactivados.';
exception when others then
  raise notice '¡FALLÓ! No se pudieron reactivar los triggers (%). Los bloques 7 y 10 no van a medir nada real.', sqlerrm;
end $$;

-- ═══════════════════════════════════════════════════════════════════════════
\echo ''
\echo '=== Bloque 7: costo REAL de los triggers, ya con el volumen cargado ==='
\echo '    Mirá las líneas "Trigger …: time=" de cada plan.'
-- ═══════════════════════════════════════════════════════════════════════════
-- 7a. recalc_profile_rating: una reseña MÁS sobre el pintor que ya tiene 3.000.
do $$
begin
  insert into public.jobs (id, project_id, client_id, painter_id, status, amount, commission_rate, commission_amount, created_at, updated_at)
  values ('00000000-0000-4000-b000-00000000bb90'::uuid, pg_temp.uid_d(1), pg_temp.uid_c(1),
          pg_temp.uid_p(1), 'completed', 180000, 0.100, 18000, now(), now());
  raise notice 'Trabajo extra creado para la reseña 3.001 del pintor estrella.';
exception when others then
  raise notice '¡FALLÓ! No se pudo crear el trabajo extra para la prueba de recalc_profile_rating: %', sqlerrm;
end $$;

select pg_temp.explain_it(
  'recalc_profile_rating en vivo: INSERT de la reseña 3.001 sobre un pintor con 3.000',
  $q$
    insert into public.reviews (id, job_id, author_id, target_id, rating, comment, created_at)
    values (gen_random_uuid(), '00000000-0000-4000-b000-00000000bb90'::uuid, pg_temp.uid_c(2),
            pg_temp.uid_p(1), 5, 'ZZAGENT reseña 3001, para medir el costo del recálculo', now())
  $q$
);

-- 7b. on_job_accepted: aceptar UNA cotización sobre el pedido con 500 vivas —
-- dispara la cancelación en cascada de las otras ~499 (una_sola_adjudicacion +
-- on_job_accepted + los triggers de esas ~499 filas canceladas).
select pg_temp.explain_it(
  'on_job_accepted en vivo: aceptar 1 cotización de 500 vivas sobre el mismo pedido',
  $q$
    update public.jobs set status = 'accepted'
    where id = ('00000000-0000-4000-a000-' || lpad(to_hex(100001), 12, '0'))::uuid
  $q$
);

-- ═══════════════════════════════════════════════════════════════════════════
\echo ''
\echo '=== Bloque 8: consultas PÚBLICAS, como las ve un visitante sin sesión (anon) ==='
-- ═══════════════════════════════════════════════════════════════════════════
set local role anon;
select set_config('request.jwt.claims', '', true);

select pg_temp.explain_it('getPainters() — directorio /pintores', $q$
  select id, full_name, avatar_url, location, verified, rating, rating_count, specialties
  from public.profiles where type = 'painter' order by rating desc limit 60
$q$);

select pg_temp.explain_it('pintores_geolocalizados() — mapa de /pintores y /mapa', $q$
  select * from public.pintores_geolocalizados()
$q$);

select pg_temp.explain_it('getProjects() — /obras', $q$
  select id, slug, title, description, cover_url, images, location, created_at, category, accent_color
  from public.projects where type = 'portfolio' and published = true order by created_at desc limit 60
$q$);

select pg_temp.explain_it('getProjectBySlug() — /obras/zzagent-obra-1', $q$
  select id, slug, title, description, cover_url, images, location, created_at, category, accent_color
  from public.projects where slug = 'zzagent-obra-1' and published = true
$q$);

select pg_temp.explain_it('getPainterById() — /pintor/[id] del pintor estrella', $q$
  select id, full_name, avatar_url, location, bio, verified, rating, rating_count, specialties
  from public.profiles where id = pg_temp.uid_p(1) and type in ('painter','company')
$q$);

select pg_temp.explain_it('getReviewsForPainter() — pintor estrella, 3.000 reseñas', $q$
  select id, rating, comment, created_at, author_id
  from public.reviews where target_id = pg_temp.uid_p(1) order by created_at desc limit 30
$q$);

select pg_temp.explain_it('pedidos_abiertos(50) — /trabajos, tablero público', $q$
  select * from public.pedidos_abiertos(50)
$q$);

select pg_temp.explain_it('getRecentReviews() — testimonios de la HOME, se corre en cada visita', $q$
  select id, rating, comment, author_id, target_id, created_at
  from public.reviews where comment is not null and rating >= 4 order by created_at desc limit 8
$q$);

select pg_temp.explain_it('getNumerosReales() 1/2 — count exact de obras publicadas (home)', $q$
  select count(*) from public.projects where type = 'portfolio' and published = true
$q$);
select pg_temp.explain_it('getNumerosReales() 2/2 — count exact de trabajos completados (home)', $q$
  select count(*) from public.jobs where status = 'completed'
$q$);

select pg_temp.explain_it('/api/health 1/4 — count exact SIN filtro sobre profiles', $q$
  select count(*) from public.profiles
$q$);
select pg_temp.explain_it('/api/health 2/4 — count exact SIN filtro sobre projects', $q$
  select count(*) from public.projects
$q$);
select pg_temp.explain_it('/api/health 3/4 — count exact SIN filtro sobre jobs', $q$
  select count(*) from public.jobs
$q$);
select pg_temp.explain_it('/api/health 4/4 — count exact SIN filtro sobre reviews', $q$
  select count(*) from public.reviews
$q$);

reset role;

-- ═══════════════════════════════════════════════════════════════════════════
\echo ''
\echo '=== Bloque 9: consultas PRIVADAS con sesión (authenticated + JWT simulado) ==='
-- ═══════════════════════════════════════════════════════════════════════════

\echo '--- Como el pintor estrella (painter_id con 3.000 trabajos) ---'
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', pg_temp.uid_p(1)::text, 'role', 'authenticated')::text, true);

select pg_temp.explain_it('getJobsForPainter() — /dashboard del pintor estrella', $q$
  select id, status, amount, client_id, project_id, created_at
  from public.jobs where painter_id = pg_temp.uid_p(1) order by created_at desc limit 50
$q$);

select pg_temp.explain_it('projects_select_pub_own_o_adjudicado — EXISTS por painter_id en jobs', $q$
  select id, title from public.projects where id = '00000000-0000-4000-a000-000000000001'::uuid
$q$);

select pg_temp.explain_it('Patrón EXISTS/NOT EXISTS de jobs_insert_painter_quote contra el pedido con 500 vivas', $q$
  select
    exists (select 1 from public.projects pr where pr.id = '00000000-0000-4000-a000-000000000001'::uuid
              and pr.type = 'service' and pr.owner_id = pg_temp.uid_c(1) and pr.published) as pedido_ok,
    not exists (select 1 from public.jobs j where j.project_id = '00000000-0000-4000-a000-000000000001'::uuid
                  and j.status in ('accepted','in_progress','completed')) as sigue_libre
$q$);

-- getPedidosYaCotizados (queries.ts) NO tiene .limit(): pide TODOS los jobs del pintor con
-- status in (quoted,accepted,in_progress,completed). El pintor estrella tiene de sobra para
-- superar el corte por defecto de 1.000 filas de la API REST de Supabase/PostgREST (ese
-- corte lo aplica PostgREST, no Postgres: el EXPLAIN de acá corre SQL directo y por eso NO
-- lo va a mostrar — lo que sí muestra es que la consulta real, sin límite, devuelve miles de
-- filas). Por encima de 1.000, /trabajos ofrecería "Cotizar" sobre un pedido que el pintor
-- YA cotizó (la base lo bloquea al enviar, pero la pantalla ya mintió).
select pg_temp.explain_it('getPedidosYaCotizados() — SIN .limit() en queries.ts, pintor estrella', $q$
  select project_id, status from public.jobs
  where painter_id = pg_temp.uid_p(1) and status in ('quoted','accepted','in_progress','completed')
$q$);
do $$
declare v_filas int;
begin
  select count(*) into v_filas from public.jobs
    where painter_id = pg_temp.uid_p(1) and status in ('quoted','accepted','in_progress','completed');
  raise notice 'getPedidosYaCotizados() del pintor estrella devolvería % filas sin límite '
               '(> 1.000 = PostgREST las corta y el resultado queda incompleto).', v_filas;
end $$;

reset role;

\echo '--- Como el cliente dueño del pedido estrella (client_id #1) ---'
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', pg_temp.uid_c(1)::text, 'role', 'authenticated')::text, true);

select pg_temp.explain_it('getJobsForClient() — panel del cliente', $q$
  select id, status, amount, painter_id, project_id, created_at
  from public.jobs where client_id = pg_temp.uid_c(1) order by created_at desc limit 50
$q$);

select pg_temp.explain_it('getQuotesForClient() — cotizaciones recibidas (500 vivas sobre el pedido estrella)', $q$
  select id, amount, note, status, painter_id, project_id, created_at
  from public.jobs where client_id = pg_temp.uid_c(1) and status in ('quoted','accepted')
  order by created_at desc limit 50
$q$);

select pg_temp.explain_it('getPedidosDelCliente() — pedidos publicados por el cliente', $q$
  select id, title, location, budget_min, budget_max, published, created_at
  from public.projects where owner_id = pg_temp.uid_c(1) and type = 'service'
  order by created_at desc limit 50
$q$);

-- getPedidosDelCliente() SÍ pagina los pedidos (.limit(50) arriba), pero la consulta
-- DERIVADA que arma `estado`/`cotizaciones` (queries.ts, "getPedidosDelCliente/jobs") hace
-- `.in("project_id", rows.map(r => r.id))` sobre `jobs` SIN NINGÚN .limit(). Con hasta 50
-- pedidos propios y uno de ellos con 500 cotizaciones vivas (como el pedido estrella), esa
-- sola consulta ya devuelve miles de filas. Por encima de 1.000, PostgREST corta el
-- resultado y el panel calcula `estado`/`cotizaciones` sobre un subconjunto arbitrario: un
-- pedido ya adjudicado puede volver a mostrarse "Cerrado · Sin cotizaciones aún", que es
-- justo la mentira que el comentario de esa función dice que viene a evitar.
select pg_temp.explain_it('getPedidosDelCliente()/jobs — SIN .limit() en queries.ts', $q$
  select project_id, status from public.jobs
  where project_id in (
    select id from public.projects where owner_id = pg_temp.uid_c(1) and type = 'service' limit 50
  )
$q$);
do $$
declare v_filas int;
begin
  select count(*) into v_filas from public.jobs
    where project_id in (
      select id from public.projects where owner_id = pg_temp.uid_c(1) and type = 'service' limit 50
    );
  raise notice 'getPedidosDelCliente()/jobs del cliente #1 devolvería % filas sin límite '
               '(> 1.000 = PostgREST las corta y el estado/cotizaciones de sus pedidos queda mal calculado).', v_filas;
end $$;

reset role;

\echo '--- Como admin (cliente #1 con is_admin=true) — /panel ---'
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', pg_temp.uid_c(1)::text, 'role', 'authenticated')::text, true);

select pg_temp.explain_it('metricas_plataforma() — números de /panel', $q$
  select * from public.metricas_plataforma()
$q$);
select pg_temp.explain_it('volumen_mensual() — gráfico de /panel (12 subconsultas por mes, sin índice en updated_at)', $q$
  select * from public.volumen_mensual()
$q$);
select pg_temp.explain_it('actividad_reciente(6) — columna derecha de /panel', $q$
  select * from public.actividad_reciente(6)
$q$);

reset role;

-- ═══════════════════════════════════════════════════════════════════════════
\echo ''
\echo '=== Bloque 10: auth_rls_initplan — ANTES/DESPUÉS de envolver auth.uid() ==='
\echo '    Reescribe una policy sólo DENTRO de esta transacción (DDL); el rollback la repone.'
-- ═══════════════════════════════════════════════════════════════════════════
\echo '--- ANTES: jobs_select_participant con auth.uid() SIN envolver (como está en 0006) ---'
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', pg_temp.uid_p(1)::text, 'role', 'authenticated')::text, true);
select pg_temp.explain_it('select * from jobs (participante), policy SIN (select …)', $q$
  select * from public.jobs
$q$);
reset role;

do $$
begin
  alter policy jobs_select_participant on public.jobs
    using ((select auth.uid()) = client_id or (select auth.uid()) = painter_id);
  raise notice 'OK: jobs_select_participant reescrita con (select auth.uid()) — SÓLO para esta transacción.';
exception when others then
  raise notice '¡FALLÓ! No se pudo reescribir la policy para comparar (%). El "antes" de arriba sigue valiendo.', sqlerrm;
end $$;

\echo '--- DESPUÉS: la misma consulta, con auth.uid() envuelto en (select …) ---'
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', pg_temp.uid_p(1)::text, 'role', 'authenticated')::text, true);
select pg_temp.explain_it('select * from jobs (participante), policy CON (select …)', $q$
  select * from public.jobs
$q$);
reset role;

-- ═══════════════════════════════════════════════════════════════════════════
\echo ''
\echo '=== Fin. Todo lo generado arriba (filas, triggers, la policy reescrita) se ==='
\echo '    descarta ahora con rollback. Nada de esto queda en la base real. ==='
-- ═══════════════════════════════════════════════════════════════════════════
rollback;
