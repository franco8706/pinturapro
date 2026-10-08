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
-- Lo que TIENE que seguir andando (6/10/2026). Este ensayo sólo miraba lo que las migraciones
-- frenan, y la 0024 rompía todas las cotizaciones ("infinite recursion detected in policy for
-- relation jobs") sin que nada lo marcara. Un pintor cotiza y el cliente acepta, como en la web.
\echo '--- el ciclo que tiene que seguir andando:'
select id as orden_cliente from public.profiles where full_name = 'Javier Méndez' \gset
select id as orden_pintor from public.profiles where full_name = 'Diego Sosa' \gset
insert into public.projects (id, owner_id, type, title, slug, published)
values ('00000000-0000-0000-0000-0000000000d1', :'orden_cliente', 'service', 'ZZAGENT pedido del ensayo de orden', 'zzagent-orden-d1', true);
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', :'orden_pintor', 'role', 'authenticated')::text, true) \g /dev/null
do $$
begin
  insert into public.jobs (project_id, client_id, painter_id, status, amount, commission_amount)
  values ('00000000-0000-0000-0000-0000000000d1',
          (select owner_id from public.projects where id = '00000000-0000-0000-0000-0000000000d1'),
          auth.uid(), 'quoted', 250000, 25000);
  raise notice 'OK: un pintor cotiza';
exception when others then raise notice '¡FALLÓ!: un pintor no puede cotizar -> % %', sqlstate, sqlerrm;
end $$;
select set_config('request.jwt.claims', json_build_object('sub', :'orden_cliente', 'role', 'authenticated')::text, true) \g /dev/null
do $$
declare n int;
begin
  update public.jobs set status = 'accepted' where project_id = '00000000-0000-0000-0000-0000000000d1';
  get diagnostics n = row_count;
  if n = 1 then raise notice 'OK: el cliente acepta';
  else raise notice '¡FALLÓ!: el cliente no aceptó (% filas)', n; end if;
exception when others then raise notice '¡FALLÓ!: el cliente no puede aceptar -> % %', sqlstate, sqlerrm;
end $$;
reset role;
\echo '=== Fin: rollback ==='
rollback;
