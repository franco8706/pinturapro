-- Prueba la migración 0026 SIN tocar la base: la aplica adentro de una transacción, juega los
-- casos con la sesión simulada de un cliente y de un pintor, y termina en rollback.
-- La corre el orquestador (que tiene la contraseña):
--   psql ... -v ON_ERROR_STOP=0 -f tools/auditoria/escala/probar-0026.sql
-- Cada caso imprime OK o ¡FALLÓ!; nada queda guardado.
begin;
set local statement_timeout = '60s';
\i /workspaces/codespaces-blank/pinturapro/supabase/migrations/0026_reglas_que_solo_cumplia_la_web.sql

-- Cuentas demo: un cliente, un pintor, y un pedido abierto de ESE cliente.
select id as cliente from public.profiles where full_name = 'Javier Méndez' \gset
select id as pintor from public.profiles where full_name = 'Diego Sosa' \gset
\echo cliente :cliente · pintor :pintor

create function pg_temp.como(quien uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', quien::text, 'role', 'authenticated')::text, true);
$$;

-- ── 1. Tope de pedidos: 10 entran, el undécimo no ──
set local role authenticated;
select pg_temp.como(:'cliente');
do $$
declare yo uuid := auth.uid(); i int;
begin
  for i in 1..10 loop
    insert into public.projects (owner_id, type, title, slug, published)
    values (yo, 'service', 'ZZAGENT tope ' || i, 'zzagent-tope-0026-' || i, true);
  end loop;
  raise notice 'OK 1a: diez pedidos seguidos entran';
  begin
    insert into public.projects (owner_id, type, title, slug, published)
    values (yo, 'service', 'ZZAGENT tope 11', 'zzagent-tope-0026-11', true);
    raise notice '¡FALLÓ! 1b: el undécimo pedido de la hora entró';
  exception when others then
    raise notice 'OK 1b: el undécimo se rechaza -> %', sqlerrm;
  end;
end $$;
reset role;
select set_config('request.jwt.claims', '', true); -- sin identidad: lo que sigue es preparación

-- ── 2. Piso y tope de cotizaciones ──
set local role authenticated;
select pg_temp.como(:'pintor');
do $$
declare yo uuid := auth.uid(); pedido record; i int := 0; entraron int := 0;
begin
  -- $500 sobre el primer pedido de prueba: no.
  select p.id, p.owner_id into pedido from public.projects p where p.slug = 'zzagent-tope-0026-1';
  begin
    insert into public.jobs (project_id, client_id, painter_id, status, amount, commission_rate, commission_amount)
    values (pedido.id, pedido.owner_id, yo, 'quoted', 500, 0.100, 50);
    raise notice '¡FALLÓ! 2a: una cotización de $500 entró';
  exception when others then
    raise notice 'OK 2a: $500 se rechaza -> %', sqlerrm;
  end;
  -- Una cotización normal sobre cada uno de los 10 pedidos: entran.
  for pedido in select p.id, p.owner_id from public.projects p where p.slug like 'zzagent-tope-0026-%' loop
    insert into public.jobs (project_id, client_id, painter_id, status, amount, commission_rate, commission_amount)
    values (pedido.id, pedido.owner_id, yo, 'quoted', 100000, 0.100, 10000);
    entraron := entraron + 1;
  end loop;
  raise notice 'OK 2b: % cotizaciones normales entran', entraron;
exception when others then
  raise notice '¡FALLÓ! 2b: una cotización normal se rechazó -> %', sqlerrm;
end $$;
reset role;
select set_config('request.jwt.claims', '', true); -- sin identidad: lo que sigue es preparación

-- El tope de 30: se completa hasta 30 con la clave de servicio (sin tope) y se prueba la 31.
do $$
declare pintor uuid := (select id from public.profiles where full_name = 'Diego Sosa');
        cliente uuid := (select id from public.profiles where full_name = 'Javier Méndez');
        hay int;
begin
  select count(*) into hay from public.jobs j where j.painter_id = pintor and j.created_at > now() - interval '1 hour';
  insert into public.jobs (client_id, painter_id, status, amount, commission_rate, commission_amount, note)
  select cliente, pintor, 'cancelled', 100000, 0.100, 10000, 'ZZAGENT relleno ' || n
  from generate_series(1, greatest(0, 30 - hay)) n;
  raise notice 'relleno: el pintor tiene % trabajos en la última hora', (select count(*) from public.jobs j where j.painter_id = pintor and j.created_at > now() - interval '1 hour');
end $$;
insert into public.projects (owner_id, type, title, slug, published)
select id, 'service', 'ZZAGENT pedido 31', 'zzagent-tope-0026-extra', true from public.profiles where full_name = 'Sofía Luna';
set local role authenticated;
select pg_temp.como(:'pintor');
do $$
declare yo uuid := auth.uid(); pedido record;
begin
  select p.id, p.owner_id into pedido from public.projects p where p.slug = 'zzagent-tope-0026-extra';
  insert into public.jobs (project_id, client_id, painter_id, status, amount, commission_rate, commission_amount)
  values (pedido.id, pedido.owner_id, yo, 'quoted', 100000, 0.100, 10000);
  raise notice '¡FALLÓ! 2c: la cotización 31 de la hora entró';
exception when others then
  raise notice 'OK 2c: la cotización 31 se rechaza -> %', sqlerrm;
end $$;
reset role;
select set_config('request.jwt.claims', '', true); -- sin identidad: lo que sigue es preparación

-- ── 3. Un pedido adjudicado no se edita; uno abierto sí; una obra con historial también ──
update public.jobs set status = 'accepted'
where project_id = (select id from public.projects where slug = 'zzagent-tope-0026-1') and status = 'quoted';
set local role authenticated;
select pg_temp.como(:'cliente');
do $$
declare n int;
begin
  update public.projects set title = 'ZZAGENT cambiado después de aceptar', published = true where slug = 'zzagent-tope-0026-1';
  get diagnostics n = row_count;
  if n = 0 then raise notice 'OK 3a: el pedido adjudicado no se puede editar (0 filas)';
  else raise notice '¡FALLÓ! 3a: se editó un pedido con un trabajo aceptado (% filas)', n; end if;
  update public.projects set title = 'ZZAGENT editado, sigue abierto' where slug = 'zzagent-tope-0026-2';
  get diagnostics n = row_count;
  if n = 1 then raise notice 'OK 3b: un pedido abierto se sigue pudiendo editar';
  else raise notice '¡FALLÓ! 3b: no se pudo editar un pedido abierto (% filas)', n; end if;
end $$;
reset role;
select set_config('request.jwt.claims', '', true); -- sin identidad: lo que sigue es preparación
-- Una obra de portfolio con trabajos terminados colgando (el historial del seed): su dueño la edita.
select p.owner_id as duenio_obra, p.id as obra from public.projects p
where p.type = 'portfolio' and exists (select 1 from public.jobs j where j.project_id = p.id and j.status = 'completed') limit 1 \gset
set local role authenticated;
select pg_temp.como(:'duenio_obra');
do $$
declare n int;
begin
  update public.projects set description = description where type = 'portfolio' and owner_id = auth.uid()
    and exists (select 1 from public.jobs j where j.project_id = projects.id and j.status = 'completed');
  get diagnostics n = row_count;
  if n >= 1 then raise notice 'OK 3c: una obra de portfolio con historial se sigue pudiendo editar (% filas)', n;
  else raise notice '¡FALLÓ! 3c: el dueño no pudo editar su obra de portfolio'; end if;
end $$;
reset role;
select set_config('request.jwt.claims', '', true); -- sin identidad: lo que sigue es preparación

-- ── 4. Los triggers de 0009 siguen cerrando y reabriendo el pedido ──
select 'publicado después de aceptar: ' || published from public.projects where slug = 'zzagent-tope-0026-1';

\echo '=== Fin de probar-0026: rollback ==='
rollback;
