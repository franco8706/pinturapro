-- Prueba una migración CON volumen, sin tocar la base: se corre DESPUÉS del cuerpo de
-- volumen.sql (todo menos su `rollback;` final), dentro de la misma transacción, y termina
-- en rollback. Uso (el orquestador, que tiene la contraseña):
--   { head -n -1 volumen.sql; cat probar-0024.sql; } > /tmp/x.sql && psql ... -f /tmp/x.sql
-- Creado el 29/9 para medir 0024 antes de aplicarla a la base real.
reset role;
\echo ''
\echo '=== 0024 aplicada ADENTRO de la transacción ==='
\i /workspaces/codespaces-blank/pinturapro/supabase/migrations/0024_escala.sql
analyze public.reviews; analyze public.projects;

set local role anon;
select set_config('request.jwt.claims', '', true);
select pg_temp.explain_it('DESPUÉS 0024 · getProjects() — /obras (anon)', $q$
  select id, slug, title, description, cover_url, images, location, created_at, category, accent_color
  from public.projects where type = 'portfolio' and published = true order by created_at desc limit 60
$q$);
select pg_temp.explain_it('DESPUÉS 0024 · resumen_publico() — portada (anon)', $q$
  select * from public.resumen_publico()
$q$);
select pg_temp.explain_it('DESPUÉS 0024 · pedidos_abiertos(50) — tablero (anon)', $q$
  select * from public.pedidos_abiertos(50)
$q$);
select pg_temp.explain_it('DESPUÉS 0024 · pedidos_abiertos(50, hace 100 días) — página siguiente', $q$
  select * from public.pedidos_abiertos(50, now() - interval '100 days')
$q$);
select pg_temp.explain_it('DESPUÉS 0024 · testimonios de la portada (anon)', $q$
  select id, rating, comment, author_id, target_id, created_at from public.reviews
  where comment is not null and rating >= 4 order by created_at desc limit 8
$q$);
select pg_temp.explain_it('DESPUÉS 0024 · reseñas del pintor estrella (anon)', $q$
  select id, rating, comment, created_at, author_id from public.reviews
  where target_id = pg_temp.uid_p(1) order by created_at desc limit 30
$q$);
reset role;
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', pg_temp.uid_p(1)::text, 'role', 'authenticated')::text, true);
select pg_temp.explain_it('DESPUÉS 0024 · getProjects() — /obras (con sesión de pintor)', $q$
  select id, slug, title, description, cover_url, images, location, created_at, category, accent_color
  from public.projects where type = 'portfolio' and published = true order by created_at desc limit 60
$q$);
select pg_temp.explain_it('DESPUÉS 0024 · jobs del participante', $q$
  select * from public.jobs where painter_id = pg_temp.uid_p(1) order by created_at desc limit 50
$q$);
reset role;
\echo '=== Fin de probar-0024: rollback ==='
rollback;
