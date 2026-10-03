-- Aplica 0024, 0025 y 0026 en orden adentro de UNA transacción, comprueba lo que tiene que
-- quedar, y deshace todo. Es el ensayo de lo que va a correr el dueño.
begin;
set local statement_timeout = '60s';
\i /workspaces/codespaces-blank/pinturapro/supabase/migrations/0024_escala.sql
\i /workspaces/codespaces-blank/pinturapro/supabase/migrations/0025_contenido_de_marketplace.sql
\i /workspaces/codespaces-blank/pinturapro/supabase/migrations/0026_reglas_que_solo_cumplia_la_web.sql
\echo '--- projects_update_own (tiene que tener el not exists sobre jobs):'
select pg_get_expr(polqual, polrelid) ~ 'NOT \(EXISTS' as protege_adjudicado from pg_policy where polname = 'projects_update_own';
\echo '--- policies que todavía llaman auth.uid() sin (select ...):'
select count(*) as sin_envolver from pg_policies where schemaname = 'public'
  and (coalesce(qual,'') || coalesce(with_check,'')) ~ '(^|[^T] )auth\.uid\(\)';
\echo '--- resumen_publico como anon:'
set local role anon;
select * from public.resumen_publico();
select count(*) as pedidos_en_tablero from public.pedidos_abiertos(50);
reset role;
\echo '--- textos de la base:'
select count(*) as faqs_con_pintamos from public.faqs where answer ~* 'pintamos|organizar el equipo|trabajamos con';
select count(*) as novedad_verificados_publicada from public.news where title = 'Sumamos pintores verificados en Zona Norte' and published;
\echo '=== Fin: rollback ==='
rollback;
