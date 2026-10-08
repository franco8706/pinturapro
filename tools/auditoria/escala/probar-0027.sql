-- Prueba la migración 0027 (suscripción mensual) SIN dejar nada: la aplica adentro de una
-- transacción, juega los casos con la sesión simulada de un cliente, de dos pintores, del admin y
-- de la clave de servicio, y termina en rollback.
--
-- Contra la base LOCAL (tools/auditoria/base-local/levantar.sh 0026), que no necesita
-- contraseña de nadie:
--   psql postgresql://postgres:postgres@127.0.0.1:54322/postgres -v ON_ERROR_STOP=0 \
--        -f tools/auditoria/escala/probar-0027.sql 2>&1 | grep -E "OK|FALLÓ|ERROR"
-- Contra la base en vivo la corre el dueño (o el orquestador con su contraseña), igual.
-- Cada caso imprime OK o ¡FALLÓ!. Un ERROR suelto también es una falla.
-- La migración trae su propio begin/commit (para aplicarse entera o nada). Acá se carga una
-- copia SIN ellos: si no, su `commit` dejaría la migración aplicada y el rollback del final
-- sólo desharía las pruebas.
\! sed -e '/^begin;$/d' -e '/^commit;$/d' /workspaces/codespaces-blank/pinturapro/supabase/migrations/0027_suscripcion_mensual.sql > /tmp/probar-0027-migracion.sql
begin;
set local statement_timeout = '60s';
\i /tmp/probar-0027-migracion.sql

select id as cliente from public.profiles where full_name = 'Javier Méndez' \gset
select id as cliente2 from public.profiles where full_name = 'Sofía Luna' \gset
select id as pintor from public.profiles where full_name = 'Diego Sosa' \gset
select id as pintor2 from public.profiles where full_name = 'Lucía Fernández' \gset
select id as admin from public.profiles where full_name = 'Pintura Pro' \gset
\echo cliente :cliente · pintor :pintor · pintor2 :pintor2 · admin :admin

create function pg_temp.como(quien uuid, rol text default 'authenticated') returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', quien::text, 'role', rol)::text, true);
$$;
create function pg_temp.sin_identidad() returns void language sql as $$
  select set_config('request.jwt.claims', '', true);
$$;

-- ── 1. La inscripción al lanzamiento ──
do $$
declare n int;
begin
  select count(*) into n from public.suscripciones where proveedor = 'lanzamiento';
  if n = (select count(*) from public.profiles where type in ('painter', 'company'))
  then raise notice 'OK 1a: los % pintores y empresas existentes quedaron inscriptos al lanzamiento', n;
  else raise notice '¡FALLÓ! 1a: % inscripciones para % pintores', n, (select count(*) from public.profiles where type in ('painter', 'company'));
  end if;
  if exists (select 1 from public.suscripciones s join public.profiles p on p.id = s.pintor_id where p.type = 'client')
  then raise notice '¡FALLÓ! 1b: un cliente quedó inscripto';
  else raise notice 'OK 1b: ningún cliente inscripto';
  end if;
end $$;

-- ── 2. puede_cotizar, mientras corre el lanzamiento (sin fecha de fin) ──
set local role authenticated;
select pg_temp.como(:'pintor');
select case when public.puede_cotizar() then 'OK 2a: un pintor inscripto cotiza durante el lanzamiento'
            else '¡FALLÓ! 2a: un pintor inscripto no puede cotizar en el lanzamiento' end as resultado \gset
\echo :resultado
select pg_temp.como(:'cliente');
select case when not public.puede_cotizar() then 'OK 2b: un cliente nunca cotiza'
            else '¡FALLÓ! 2b: un cliente puede cotizar' end as resultado \gset
\echo :resultado
reset role;

-- Termina el lanzamiento: ayer.
update public.ajustes_de_cobro set lanzamiento_hasta = now() - interval '1 day';

set local role authenticated;
select pg_temp.como(:'pintor');
select case when not public.puede_cotizar() then 'OK 2c: terminado el lanzamiento, sin pago no cotiza'
            else '¡FALLÓ! 2c: terminado el lanzamiento, sigue cotizando sin pagar' end as resultado \gset
\echo :resultado
reset role;

-- Un acceso pago (manual) de una hora para pintor2.
insert into public.suscripciones (pintor_id, proveedor, estado, acceso_hasta, vigente_hasta)
values (:'pintor2', 'manual', 'activa', now() + interval '1 hour', now() + interval '1 hour');

set local role authenticated;
select pg_temp.como(:'pintor2');
select case when public.puede_cotizar() then 'OK 2d: con acceso pago cotiza'
            else '¡FALLÓ! 2d: con acceso pago no puede cotizar' end as resultado \gset
\echo :resultado
-- pintor (sin acceso) pregunta por pintor2 (con acceso): la respuesta es sobre sí mismo.
select pg_temp.como(:'pintor');
select case when not public.puede_cotizar(:'pintor2'::uuid) then 'OK 2e: una cuenta común no puede averiguar si otro pintor paga'
            else '¡FALLÓ! 2e: preguntar por otro pintor revela si paga' end as resultado \gset
\echo :resultado
reset role;

set local role service_role;
select pg_temp.como(:'pintor', 'service_role');
select case when public.puede_cotizar(:'pintor2'::uuid) and not public.puede_cotizar(:'pintor'::uuid)
            then 'OK 2f: la clave de servicio pregunta por cualquiera'
            else '¡FALLÓ! 2f: la clave de servicio no responde por otro pintor' end as resultado \gset
\echo :resultado
reset role;
select pg_temp.sin_identidad();

-- La palanca de emergencia.
update public.ajustes_de_cobro set exigir_suscripcion = false;
set local role authenticated;
select pg_temp.como(:'pintor');
select case when public.puede_cotizar() then 'OK 2g: con la palanca apagada, cualquier pintor cotiza'
            else '¡FALLÓ! 2g: la palanca apagada no libera' end as resultado \gset
\echo :resultado
reset role;
update public.ajustes_de_cobro set exigir_suscripcion = true;

-- ── 3. Cotizar sin suscripción, por la API, como el propio pintor ──
-- Un pedido abierto del cliente.
insert into public.projects (id, owner_id, type, title, slug, published)
values ('00000000-0000-0000-0000-00000000a027', :'cliente', 'service', 'ZZAGENT 0027 pedido', 'zzagent-0027-pedido', true);

set local role authenticated;
select pg_temp.como(:'pintor');
do $$
begin
  insert into public.jobs (project_id, client_id, painter_id, status, amount, commission_amount)
  values ('00000000-0000-0000-0000-00000000a027',
          (select owner_id from public.projects where id = '00000000-0000-0000-0000-00000000a027'),
          auth.uid(), 'quoted', 250000, 25000);
  raise notice '¡FALLÓ! 3a: un pintor sin suscripción cotizó';
exception when others then
  if sqlerrm like '%suscripción%' and sqlstate = 'P0001'
  then raise notice 'OK 3a: sin suscripción no cotiza, y el motivo se entiende -> %', sqlerrm;
  else raise notice '¡FALLÓ! 3a: lo frenó, pero con otro motivo (%): %', sqlstate, sqlerrm;
  end if;
end $$;
reset role;

-- La policy sola (sin el trigger que da el motivo) también lo frena.
alter table public.jobs disable trigger trg_exigir_suscripcion;
set local role authenticated;
select pg_temp.como(:'pintor');
do $$
begin
  insert into public.jobs (project_id, client_id, painter_id, status, amount)
  values ('00000000-0000-0000-0000-00000000a027',
          (select owner_id from public.projects where id = '00000000-0000-0000-0000-00000000a027'),
          auth.uid(), 'quoted', 250000);
  raise notice '¡FALLÓ! 3b: sin el trigger, la policy dejó cotizar sin suscripción';
exception when insufficient_privilege then
  raise notice 'OK 3b: la policy sola también lo frena (42501)';
when others then
  raise notice '¡FALLÓ! 3b: otro error: % %', sqlstate, sqlerrm;
end $$;
reset role;
alter table public.jobs enable trigger trg_exigir_suscripcion;

-- Con acceso: entra, y la comisión que manda una app vieja queda en NULL.
set local role authenticated;
select pg_temp.como(:'pintor2');
do $$
declare j public.jobs;
begin
  insert into public.jobs (project_id, client_id, painter_id, status, amount, commission_amount, commission_rate)
  values ('00000000-0000-0000-0000-00000000a027',
          (select owner_id from public.projects where id = '00000000-0000-0000-0000-00000000a027'),
          auth.uid(), 'quoted', 250000, 25000, 0.100)
  returning * into j;
  if j.commission_amount is null and j.commission_rate is null
  then raise notice 'OK 3c: con acceso cotiza, y la comisión de una app vieja queda en NULL';
  else raise notice '¡FALLÓ! 3c: la comisión quedó guardada: % / %', j.commission_amount, j.commission_rate;
  end if;
exception when others then
  raise notice '¡FALLÓ! 3c: con acceso no pudo cotizar: % %', sqlstate, sqlerrm;
end $$;
reset role;

-- Una cuenta común no se fabrica acceso.
set local role authenticated;
select pg_temp.como(:'pintor');
do $$
begin
  insert into public.suscripciones (pintor_id, proveedor, estado, acceso_hasta)
  values (auth.uid(), 'manual', 'activa', '2099-01-01');
  raise notice '¡FALLÓ! 3d: un pintor se insertó un acceso hasta 2099';
exception when insufficient_privilege then raise notice 'OK 3d: un pintor no se puede fabricar una suscripción';
end $$;
do $$
begin
  insert into public.pagos_suscripcion (pintor_id, proveedor, tipo, proveedor_evento_id, monto_ars, fecha)
  values (auth.uid(), 'transferencia', 'cobro', 'falso-1', 7700, now());
  raise notice '¡FALLÓ! 3e: un pintor se anotó un pago';
exception when insufficient_privilege then raise notice 'OK 3e: un pintor no se puede anotar un pago';
end $$;
do $$
declare n int;
begin
  update public.suscripciones set acceso_hasta = '2099-01-01' where pintor_id = auth.uid();
  get diagnostics n = row_count;
  raise notice '¡FALLÓ! 3f: un pintor estiró su propia suscripción (% filas)', n;
exception when insufficient_privilege then raise notice 'OK 3f: un pintor no puede estirar su suscripción';
end $$;
reset role;

-- ── 4. H1: una cotización enviada no se edita ──
set local role authenticated;
select pg_temp.como(:'pintor2');
do $$
begin
  update public.jobs set amount = 1500 where project_id = '00000000-0000-0000-0000-00000000a027' and painter_id = auth.uid();
  raise notice '¡FALLÓ! 4a: el pintor cambió el monto de una cotización enviada';
exception when others then raise notice 'OK 4a: el monto enviado no se cambia -> %', sqlerrm;
end $$;
do $$
begin
  update public.jobs set note = 'llamame al 1144445555' where project_id = '00000000-0000-0000-0000-00000000a027' and painter_id = auth.uid();
  raise notice '¡FALLÓ! 4b: el pintor reescribió la nota después de enviarla';
exception when others then raise notice 'OK 4b: la nota enviada no se cambia -> %', sqlerrm;
end $$;
reset role;

-- ── 5. H10: nadie borra a la otra parte ──
set local role authenticated;
select pg_temp.como(:'cliente');
do $$
begin
  update public.jobs set painter_id = null where project_id = '00000000-0000-0000-0000-00000000a027';
  raise notice '¡FALLÓ! 5a: el cliente borró al pintor del trabajo';
exception when others then raise notice 'OK 5a: el cliente no borra al pintor -> %', sqlerrm;
end $$;
reset role;
set local role authenticated;
select pg_temp.como(:'pintor2');
do $$
begin
  update public.jobs set client_id = null where project_id = '00000000-0000-0000-0000-00000000a027' and painter_id = auth.uid();
  raise notice '¡FALLÓ! 5b: el pintor borró al cliente del trabajo';
exception when others then raise notice 'OK 5b: el pintor no borra al cliente -> %', sqlerrm;
end $$;
do $$
begin
  update public.jobs set project_id = null where project_id = '00000000-0000-0000-0000-00000000a027' and painter_id = auth.uid();
  raise notice '¡FALLÓ! 5c: el pintor desenganchó el trabajo del pedido';
exception when others then raise notice 'OK 5c: el pedido no se desengancha -> %', sqlerrm;
end $$;
reset role;

-- ── 6. H5: el rastro de aceptar y cancelar ──
-- Una segunda cotización (de pintor, con acceso de una hora) para ver a la perdedora.
insert into public.suscripciones (pintor_id, proveedor, estado, acceso_hasta)
values (:'pintor', 'manual', 'activa', now() + interval '1 hour');
set local role authenticated;
select pg_temp.como(:'pintor');
insert into public.jobs (project_id, client_id, painter_id, status, amount)
values ('00000000-0000-0000-0000-00000000a027', :'cliente', :'pintor', 'quoted', 300000);
reset role;

set local role authenticated;
select pg_temp.como(:'cliente');
update public.jobs set status = 'accepted'
 where project_id = '00000000-0000-0000-0000-00000000a027' and painter_id = :'pintor2';
reset role;
do $$
declare g public.jobs; p public.jobs;
begin
  select * into g from public.jobs where project_id = '00000000-0000-0000-0000-00000000a027' and status = 'accepted';
  select * into p from public.jobs where project_id = '00000000-0000-0000-0000-00000000a027' and status = 'cancelled';
  if g.aceptado_en is not null then raise notice 'OK 6a: aceptar deja la fecha';
  else raise notice '¡FALLÓ! 6a: aceptar no dejó rastro'; end if;
  if p.cancelado_por = 'sistema' and p.cancelado_en is not null then raise notice 'OK 6b: la perdedora la canceló el sistema, no el cliente';
  else raise notice '¡FALLÓ! 6b: la perdedora quedó con cancelado_por = %', p.cancelado_por; end if;
end $$;

-- Escribir el rastro a mano no sirve.
set local role authenticated;
select pg_temp.como(:'cliente');
update public.jobs set aceptado_en = '2020-01-01', cancelado_por = 'pintor'
 where project_id = '00000000-0000-0000-0000-00000000a027' and status = 'accepted';
reset role;
do $$
declare g public.jobs;
begin
  select * into g from public.jobs where project_id = '00000000-0000-0000-0000-00000000a027' and status = 'accepted';
  if g.aceptado_en > '2021-01-01' and g.cancelado_por is null then raise notice 'OK 6c: el rastro no se escribe a mano';
  else raise notice '¡FALLÓ! 6c: el rastro se pisó: % / %', g.aceptado_en, g.cancelado_por; end if;
end $$;

-- ── 7. H8: el pedido adjudicado no se borra ──
set local role authenticated;
select pg_temp.como(:'cliente');
delete from public.projects where id = '00000000-0000-0000-0000-00000000a027';
reset role;
do $$
begin
  if exists (select 1 from public.projects where id = '00000000-0000-0000-0000-00000000a027')
  then raise notice 'OK 7a: el pedido adjudicado sigue ahí después del DELETE';
  else raise notice '¡FALLÓ! 7a: el cliente borró un pedido adjudicado'; end if;
end $$;

-- El cliente cancela el trabajo aceptado: queda como "cliente".
set local role authenticated;
select pg_temp.como(:'cliente');
update public.jobs set status = 'cancelled'
 where project_id = '00000000-0000-0000-0000-00000000a027' and status = 'accepted';
reset role;
do $$
declare g public.jobs;
begin
  select * into g from public.jobs where project_id = '00000000-0000-0000-0000-00000000a027' and painter_id = (select id from public.profiles where full_name = 'Lucía Fernández');
  if g.cancelado_por = 'cliente' and g.aceptado_en is not null then raise notice 'OK 7b: cancelar después de aceptar deja quién y cuándo';
  else raise notice '¡FALLÓ! 7b: cancelado_por = %', g.cancelado_por; end if;
end $$;

-- Un pedido SIN adjudicar sí se borra, y sus cotizaciones huérfanas no se pueden aceptar.
insert into public.projects (id, owner_id, type, title, slug, published)
values ('00000000-0000-0000-0000-00000000b027', :'cliente', 'service', 'ZZAGENT 0027 borrable', 'zzagent-0027-borrable', true);
set local role authenticated;
select pg_temp.como(:'pintor');
insert into public.jobs (project_id, client_id, painter_id, status, amount)
values ('00000000-0000-0000-0000-00000000b027', :'cliente', :'pintor', 'quoted', 200000);
reset role;
set local role authenticated;
select pg_temp.como(:'cliente');
delete from public.projects where id = '00000000-0000-0000-0000-00000000b027';
reset role;
do $$
begin
  if not exists (select 1 from public.projects where id = '00000000-0000-0000-0000-00000000b027')
     and exists (select 1 from public.jobs where project_id is null and amount = 200000 and status = 'quoted')
  then raise notice 'OK 7c: un pedido sin adjudicar se borra (la clave foránea deja la cotización sin pedido)';
  else raise notice '¡FALLÓ! 7c: el pedido sin adjudicar no se borró, o se llevó la cotización'; end if;
end $$;
set local role authenticated;
select pg_temp.como(:'cliente');
do $$
begin
  update public.jobs set status = 'accepted' where project_id is null and amount = 200000 and status = 'quoted' and client_id = auth.uid();
  if exists (select 1 from public.jobs where project_id is null and amount = 200000 and status = 'accepted')
  then raise notice '¡FALLÓ! 7d: se aceptó una cotización de un pedido borrado';
  else raise notice '¡FALLÓ! 7d: no dio error pero tampoco aceptó'; end if;
exception when others then raise notice 'OK 7d: la cotización de un pedido borrado no se acepta -> %', sqlerrm;
end $$;
reset role;

-- ── 8. El dólar y el precio en pesos ──
select case when public.precio_ars('pintor') is null then 'OK 8a: sin cotización vigente, no hay precio (no se inventa)'
            else '¡FALLÓ! 8a: hay precio sin cotización' end as resultado \gset
\echo :resultado
insert into public.cotizaciones_dolar (fuente, venta, control, estado) values ('bna', 1540, 1520, 'vigente');
select case when public.precio_ars('pintor') = 7700 then 'OK 8b: US$5 al 1540 son $7.700'
            else '¡FALLÓ! 8b: precio = ' || coalesce(public.precio_ars('pintor')::text, 'null') end as resultado \gset
\echo :resultado
insert into public.cotizaciones_dolar (fuente, venta, estado, leida_en) values ('bna', 1725, 'a_confirmar', now() + interval '1 minute');
select case when public.precio_ars('pintor') = 7700 then 'OK 8c: una cotización a confirmar no cambia el precio'
            else '¡FALLÓ! 8c: precio = ' || public.precio_ars('pintor') end as resultado \gset
\echo :resultado
insert into public.cotizaciones_dolar (fuente, venta, estado, leida_en) values ('bna', 1540.5, 'vigente', now() + interval '2 minutes');
select case when public.precio_ars('pintor') = 7800 then 'OK 8d: con 1540,50 sube a $7.800 (hacia arriba a la centena)'
            else '¡FALLÓ! 8d: precio = ' || public.precio_ars('pintor') end as resultado \gset
\echo :resultado
set local role anon;
select case when public.precio_ars('pintor') = 7800 then 'OK 8e: el precio en pesos se lee sin cuenta'
            else '¡FALLÓ! 8e: anon no lee el precio' end as resultado \gset
\echo :resultado
do $$
begin
  perform 1 from public.cotizaciones_dolar limit 1;
  raise notice '¡FALLÓ! 8f: anon lee la tabla de cotizaciones directo';
exception when insufficient_privilege then raise notice 'OK 8f: la tabla de cotizaciones no se lee directo';
end $$;
reset role;

-- ── 9. El libro de pagos sólo agrega ──
set local role service_role;
select pg_temp.como(:'admin', 'service_role');
insert into public.pagos_suscripcion (pintor_id, proveedor, tipo, proveedor_evento_id, monto_ars, fecha)
values (:'pintor2', 'mercadopago', 'cobro', 'mp-0027-1', 7700, now());
do $$
begin
  insert into public.pagos_suscripcion (pintor_id, proveedor, tipo, proveedor_evento_id, monto_ars, fecha)
  values ((select id from public.profiles where full_name = 'Lucía Fernández'), 'mercadopago', 'cobro', 'mp-0027-1', 7700, now());
  raise notice '¡FALLÓ! 9a: el mismo cobro entró dos veces';
exception when unique_violation then raise notice 'OK 9a: el mismo aviso dos veces deja una sola fila';
end $$;
do $$
begin
  update public.pagos_suscripcion set monto_ars = 1 where proveedor_evento_id = 'mp-0027-1';
  raise notice '¡FALLÓ! 9b: la clave de servicio editó el libro';
exception when others then raise notice 'OK 9b: el libro no se edita, ni con la clave de servicio -> %', sqlstate;
end $$;
do $$
begin
  delete from public.pagos_suscripcion where proveedor_evento_id = 'mp-0027-1';
  raise notice '¡FALLÓ! 9c: la clave de servicio borró del libro';
exception when others then raise notice 'OK 9c: el libro no se borra, ni con la clave de servicio -> %', sqlstate;
end $$;
reset role;
select pg_temp.sin_identidad();

-- El pintor ve su pago; otro pintor no.
set local role authenticated;
select pg_temp.como(:'pintor2');
select case when (select count(*) from public.pagos_suscripcion) = 1 then 'OK 9d: el pintor ve su pago'
            else '¡FALLÓ! 9d: el pintor ve ' || (select count(*) from public.pagos_suscripcion) || ' pagos' end as resultado \gset
\echo :resultado
select pg_temp.como(:'pintor');
select case when (select count(*) from public.pagos_suscripcion) = 0 and (select count(*) from public.suscripciones where pintor_id <> auth.uid()) = 0
            then 'OK 9e: un pintor no ve pagos ni suscripciones de otro'
            else '¡FALLÓ! 9e: un pintor ve lo de otro' end as resultado \gset
\echo :resultado
reset role;

-- Borrar la cuenta deja el pago en el libro, sin nombre (la clave foránea pasa a NULL).
select pg_temp.sin_identidad();
delete from auth.users where id = :'pintor2';
do $$
begin
  if exists (select 1 from public.pagos_suscripcion where proveedor_evento_id = 'mp-0027-1' and pintor_id is null)
  then raise notice 'OK 9f: borrar la cuenta deja el pago en el libro, sin nombre';
  else raise notice '¡FALLÓ! 9f: el pago desapareció o conserva el pintor'; end if;
end $$;

-- ── 10. Para el admin ──
set local role authenticated;
select pg_temp.como(:'pintor');
select case when (select count(*) from public.metricas_suscripciones()) = 0 then 'OK 10a: un pintor no ve las métricas de cobro'
            else '¡FALLÓ! 10a: un pintor ve las métricas de cobro' end as resultado \gset
\echo :resultado
select case when (select count(*) from public.cancelaciones_tras_aceptar()) = 0 then 'OK 10b: un pintor no ve las cancelaciones'
            else '¡FALLÓ! 10b: un pintor ve las cancelaciones' end as resultado \gset
\echo :resultado
select pg_temp.como(:'admin');
select case when (select count(*) from public.metricas_suscripciones()) = 1
             and (select count(*) from public.cancelaciones_tras_aceptar()) >= 1
            then 'OK 10c: el admin ve métricas y cancelaciones después de aceptar'
            else '¡FALLÓ! 10c: el admin no ve lo suyo' end as resultado \gset
\echo :resultado
reset role;

-- ── 11. Lo que no se tiene que perder ──
do $$
declare q text; u text;
begin
  select pg_get_expr(polwithcheck, polrelid) into q from pg_policy where polname = 'jobs_insert_painter_quote';
  if q like '%puede_cotizar%' and q like '%published%' and q like '%es_pintor%' and q not like '%commission%'
  then raise notice 'OK 11a: la policy de cotizar tiene suscripción, pedido publicado y pintor, y no la comisión';
  else raise notice '¡FALLÓ! 11a: policy = %', q; end if;
  select pg_get_expr(polqual, polrelid) into u from pg_policy where polname = 'projects_update_own';
  if u like '%NOT (EXISTS%' or u like '%not exists%' or u like '%NOT EXISTS%'
  then raise notice 'OK 11b: projects_update_own conserva lo de 0026 (pedido adjudicado no se edita)';
  else raise notice '¡FALLÓ! 11b: projects_update_own = %', u; end if;
  if (select count(*) from pg_policies
      where tablename in ('suscripciones', 'cobros', 'pagos_suscripcion', 'codigos_de_pago')
        and qual like '%auth.uid()%' and qual not like '%SELECT auth.uid()%') = 0
  then raise notice 'OK 11c: las policies nuevas evalúan auth.uid() una vez por consulta';
  else raise notice '¡FALLÓ! 11c: hay policies nuevas con auth.uid() sin envolver'; end if;
  if exists (select 1 from information_schema.columns where table_name = 'jobs' and column_name = 'commission_rate' and is_nullable = 'YES' and column_default is null)
  then raise notice 'OK 11d: commission_rate ya no dice 10 %% por defecto';
  else raise notice '¡FALLÓ! 11d: commission_rate sigue con default o not null'; end if;
end $$;

rollback;
\echo '— fin: todo deshecho —'
