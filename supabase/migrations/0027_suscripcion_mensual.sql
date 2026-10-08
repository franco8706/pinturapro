-- ═══════════════════════════════════════════════════════════════════════════
-- 0027 · De la comisión por trabajo a la suscripción mensual del pintor
-- ═══════════════════════════════════════════════════════════════════════════
-- ESTADO (6/10/2026): escrita y probada en una base local con 0001-0026 aplicadas
-- (`tools/auditoria/escala/probar-0027.sql`), SIN APLICAR a la base en vivo. Aplicarla lo
-- autoriza el dueño. Al aplicarla, borrar estas líneas y anotarlo en la BITÁCORA.
-- ORDEN: 0024 → 0025 → 0026 → 0027, y la web nueva (que ya no manda comisión) RECIÉN DESPUÉS:
-- la policy de 0024 exige la comisión y rechazaría las cotizaciones de la web nueva. Al revés
-- no rompe nada: esta migración anula la comisión que mande una web o una app vieja.
--
-- Decisión del dueño (6/10/2026): la plataforma no cobra comisión por trabajo —nunca la
-- cobró: se calculaba y se guardaba en `jobs.commission_amount`, pero no había forma de
-- cobrarla, y cualquier precio declarado en la plataforma se puede declarar más bajo—. El
-- pintor paga una suscripción de US$5 por mes, en pesos al dólar oficial del día, por Mercado
-- Pago (débito o QR) o por transferencia. El cliente no le paga nada a la plataforma.
--
-- Lo que hace:
--   1. Las tablas del cobro: ajustes, planes, cotizaciones del dólar, suscripciones, cobros,
--      libro de pagos (sólo se agrega), bandeja de avisos y códigos de transferencia.
--   2. `puede_cotizar()`: la base no deja cotizar a un pintor sin acceso. Es la barrera de
--      verdad: la clave anon viaja en el navegador y en el teléfono.
--   3. La policy de cotizar sin la aritmética de la comisión, y `commission_rate` sin el 10 %
--      por defecto. Las columnas se quedan: son la historia.
--   4. Huecos que encontró la revisión del 6/10 (no cuestan plata, pero sí confianza):
--      H1  una cotización enviada no se edita (el pintor cambiaba el monto por la API y el
--          cliente aceptaba un precio que no vio);
--      H5  queda registrado quién canceló y cuándo (aceptar, ver el teléfono y cancelar era
--          gratis y sin rastro);
--      H8  un pedido adjudicado no se borra;
--      H10 las partes de un trabajo no se pueden borrar a mano.
--
-- Los números son los de `@pinturapro/dominio` (`suscripcion.ts`): si cambian allá, cambian acá.

begin;

-- ═══════════════════════════════════════════════════════════════════════════
-- 1 · Ajustes del cobro (una sola fila)
-- ═══════════════════════════════════════════════════════════════════════════
-- `lanzamiento_hasta` en NULL = el lanzamiento todavía no tiene fecha de fin: cotizar es
-- gratis para todos. El dueño la fija cuando abre el sitio al público (con 30 días de aviso).
-- `exigir_suscripcion` es la palanca de emergencia: si Mercado Pago o los avisos fallan
-- después del corte, se apaga y nadie queda sin cotizar mientras se arregla.
create table public.ajustes_de_cobro (
  id                         boolean primary key default true check (id),
  lanzamiento_hasta          timestamptz,
  exigir_suscripcion         boolean not null default true,
  medios_activos             text[]  not null default array['debito', 'qr', 'transferencia'],
  salto_maximo               numeric(4,3) not null default 0.100 check (salto_maximo > 0),
  diferencia_maxima_fuentes  numeric(4,3) not null default 0.050 check (diferencia_maxima_fuentes > 0),
  -- Un pago hecho con las credenciales de prueba de Mercado Pago (sandbox) NO da acceso real,
  -- salvo en una base de pruebas que lo active (seguridad-rls, 8/10/2026).
  aceptar_pagos_de_prueba    boolean not null default false,
  updated_at                 timestamptz not null default now()
);
insert into public.ajustes_de_cobro (id) values (true);
create trigger trg_ajustes_de_cobro_updated before update on public.ajustes_de_cobro
  for each row execute function public.set_updated_at();

-- ═══════════════════════════════════════════════════════════════════════════
-- 2 · Planes (varios desde el principio; se lanza con uno)
-- ═══════════════════════════════════════════════════════════════════════════
-- El precio está en DÓLARES y se cobra en pesos al dólar del día (`precio_ars()`).
-- `precio_proximo_*`: un cambio de precio se anuncia con 30 días y se aplica solo.
create table public.planes (
  id                    text primary key,
  nombre                text not null,
  descripcion           text,
  precio_usd            numeric(8,2) not null check (precio_usd > 0 and precio_usd <= 1000),
  beneficios            text[] not null default '{}',
  orden                 int not null default 0,
  publico               boolean not null default true,
  activo                boolean not null default true,
  precio_proximo_usd    numeric(8,2) check (precio_proximo_usd > 0 and precio_proximo_usd <= 1000),
  precio_proximo_desde  timestamptz,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);
create trigger trg_planes_updated before update on public.planes
  for each row execute function public.set_updated_at();
insert into public.planes (id, nombre, descripcion, precio_usd, beneficios) values
  ('pintor', 'Plan Pintor', 'Cotizá todos los pedidos que quieras.', 5.00,
   array['Cotizaciones ilimitadas', 'Tu perfil en el directorio de pintores']);

-- ═══════════════════════════════════════════════════════════════════════════
-- 3 · Cotizaciones del dólar
-- ═══════════════════════════════════════════════════════════════════════════
-- Las escribe la tarea programada (`/api/cotizacion/actualizar`, Cloud Scheduler) con la
-- clave de servicio. Se toca plata: una lectura que salta más del 10 % queda "a confirmar"
-- hasta que el dueño la acepte, y una en la que las dos fuentes no coinciden se descarta.
-- Siempre se cobra con la última `vigente`: nunca se frena un cobro por la cotización.
create type public.estado_cotizacion as enum ('vigente', 'a_confirmar', 'descartada');

create table public.cotizaciones_dolar (
  id              bigint generated always as identity primary key,
  fuente          text not null check (fuente in ('bna', 'manual')),
  compra          numeric(12,2) check (compra > 0),
  venta           numeric(12,2) not null check (venta > 0),
  control         numeric(12,2) check (control > 0),   -- lo que dijo la fuente de control (BCRA)
  estado          public.estado_cotizacion not null,
  motivo          text,
  leida_en        timestamptz not null default now(),
  confirmada_por  uuid references public.profiles(id) on delete set null,
  confirmada_en   timestamptz
);
create index idx_cotizaciones_vigentes on public.cotizaciones_dolar (estado, leida_en desc);

-- ═══════════════════════════════════════════════════════════════════════════
-- 4 · Suscripciones: un episodio de acceso por fila
-- ═══════════════════════════════════════════════════════════════════════════
-- Un débito de Mercado Pago, la inscripción al lanzamiento, un acceso manual, o el registro de
-- quien paga mes a mes (QR o transferencia). Lo que decide si alguien cotiza es
-- `acceso_hasta` (o la inscripción al lanzamiento); `estado` es la etiqueta para mostrar.
create type public.proveedor_de_pago  as enum ('mercadopago', 'transferencia', 'lanzamiento', 'manual');
create type public.modalidad_de_pago  as enum ('debito', 'pago_mensual');
create type public.estado_suscripcion as enum ('pendiente', 'activa', 'en_gracia', 'vencida', 'cancelada');

create table public.suscripciones (
  id                uuid primary key default gen_random_uuid(),
  pintor_id         uuid references public.profiles(id) on delete set null,
  plan_id           text references public.planes(id),
  proveedor         public.proveedor_de_pago not null,
  modalidad         public.modalidad_de_pago,
  estado            public.estado_suscripcion not null default 'pendiente',
  acceso_hasta      timestamptz,
  vigente_hasta     timestamptz,
  proximo_cobro     timestamptz,
  monto_ars_actual  int check (monto_ars_actual > 0),
  proveedor_ref     text,          -- el id del débito en el proveedor (preapproval de MP)
  proveedor_estado  text,          -- lo que dice el proveedor, sin interpretar
  modo              text not null default 'produccion' check (modo in ('prueba', 'produccion')),
  cancelada_en      timestamptz,
  cancelada_por     text check (cancelada_por in ('pintor', 'admin', 'proveedor', 'baja_de_cuenta', 'sistema')),
  sincronizada_en   timestamptz,
  nota              text check (char_length(nota) <= 500),   -- la lee el pintor: nada interno del admin
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  unique (proveedor, proveedor_ref)
);
create trigger trg_suscripciones_updated before update on public.suscripciones
  for each row execute function public.set_updated_at();
create unique index una_inscripcion_al_lanzamiento on public.suscripciones (pintor_id)
  where proveedor = 'lanzamiento';
create unique index un_debito_vivo_por_pintor on public.suscripciones (pintor_id)
  where proveedor = 'mercadopago' and modalidad = 'debito' and estado in ('pendiente', 'activa', 'en_gracia');
create index idx_suscripciones_pintor_acceso on public.suscripciones (pintor_id, acceso_hasta desc);
create index idx_suscripciones_conciliar on public.suscripciones (estado, sincronizada_en);

-- El número fijo de cada pintor para el concepto de la transferencia ("PP-0037").
create table public.codigos_de_pago (
  pintor_id  uuid primary key references public.profiles(id) on delete cascade,
  numero     int generated always as identity unique
);

-- ═══════════════════════════════════════════════════════════════════════════
-- 5 · Cobros: lo que se le pide al pintor (QR, link o transferencia del mes)
-- ═══════════════════════════════════════════════════════════════════════════
-- El monto en pesos se fija al generarlo, con la cotización vigente, y vale 3 días. Su `id`
-- es el `external_reference` del QR: cuando el proveedor avisa, se sabe qué se pagó.
create type public.estado_cobro as enum ('pendiente', 'pagado', 'vencido', 'anulado', 'a_revisar');

create table public.cobros (
  id              uuid primary key default gen_random_uuid(),
  pintor_id       uuid references public.profiles(id) on delete set null,
  suscripcion_id  uuid references public.suscripciones(id) on delete set null,
  plan_id         text references public.planes(id),
  medio           text not null check (medio in ('qr', 'link', 'transferencia')),
  monto_usd       numeric(8,2) not null check (monto_usd > 0),
  monto_ars       int not null check (monto_ars > 0),
  cotizacion_id   bigint references public.cotizaciones_dolar(id),
  codigo          text,
  estado          public.estado_cobro not null default 'pendiente',
  proveedor_ref   text,
  datos           jsonb,          -- qr_data / init_point del proveedor; nunca datos de tarjeta
  vence_en        timestamptz not null,
  pagado_en       timestamptz,
  modo            text not null default 'produccion' check (modo in ('prueba', 'produccion')),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create trigger trg_cobros_updated before update on public.cobros
  for each row execute function public.set_updated_at();
create index idx_cobros_pintor on public.cobros (pintor_id, created_at desc);
create index idx_cobros_pendientes on public.cobros (estado, vence_en);

-- ═══════════════════════════════════════════════════════════════════════════
-- 6 · Libro de pagos: sólo se agrega
-- ═══════════════════════════════════════════════════════════════════════════
-- Cada cobro aprobado, rechazo, devolución o contracargo, de cualquier medio. Nadie lo edita
-- ni lo borra (ni la clave de servicio): es lo que se factura y lo que se muestra si alguien
-- reclama. `unique (proveedor, tipo, proveedor_evento_id)`: el mismo aviso dos veces deja una
-- sola fila.
create type public.tipo_movimiento as enum ('cobro', 'rechazo', 'devolucion', 'contracargo');

create table public.pagos_suscripcion (
  id                   uuid primary key default gen_random_uuid(),
  suscripcion_id       uuid references public.suscripciones(id) on delete set null,
  cobro_id             uuid references public.cobros(id) on delete set null,
  pintor_id            uuid references public.profiles(id) on delete set null,
  proveedor            public.proveedor_de_pago not null,
  tipo                 public.tipo_movimiento not null,
  proveedor_evento_id  text not null,
  anula                text,            -- devolución/contracargo: el proveedor_evento_id del cobro
  monto_ars            numeric(12,2) not null,
  neto_ars             numeric(12,2),
  cotizacion_id        bigint references public.cotizaciones_dolar(id),
  fecha                timestamptz not null,
  detalle              text,            -- status_detail del proveedor; nunca datos de tarjeta
  confirmado_por       uuid references public.profiles(id) on delete set null,  -- transferencias
  linea_extracto       text,
  modo                 text not null default 'produccion' check (modo in ('prueba', 'produccion')),
  registrado_en        timestamptz not null default now(),
  unique (proveedor, tipo, proveedor_evento_id)
);
create index idx_pagos_pintor on public.pagos_suscripcion (pintor_id, fecha desc);
create index idx_pagos_fecha on public.pagos_suscripcion (fecha);

create or replace function public.libro_solo_agregar()
returns trigger language plpgsql set search_path = public as $$
begin
  if tg_op = 'DELETE' then
    raise exception 'El libro de pagos no se borra' using errcode = 'P0001';
  end if;
  -- La única modificación posible: una referencia que pasa a NULL porque se borró la fila a la
  -- que apuntaba (la hace la clave foránea, como dueña de la tabla).
  if (new.suscripcion_id is not null and new.suscripcion_id is distinct from old.suscripcion_id)
     or (new.cobro_id is not null and new.cobro_id is distinct from old.cobro_id)
     or (new.pintor_id is not null and new.pintor_id is distinct from old.pintor_id)
     or (new.confirmado_por is not null and new.confirmado_por is distinct from old.confirmado_por)
     or row(new.id, new.proveedor, new.tipo, new.proveedor_evento_id, new.anula, new.monto_ars,
            new.neto_ars, new.cotizacion_id, new.fecha, new.detalle, new.linea_extracto,
            new.modo, new.registrado_en)
        is distinct from
        row(old.id, old.proveedor, old.tipo, old.proveedor_evento_id, old.anula, old.monto_ars,
            old.neto_ars, old.cotizacion_id, old.fecha, old.detalle, old.linea_extracto,
            old.modo, old.registrado_en)
  then
    raise exception 'El libro de pagos no se edita' using errcode = 'P0001';
  end if;
  return new;
end; $$;
revoke execute on function public.libro_solo_agregar() from public, anon, authenticated;
create trigger trg_libro_solo_agregar before update or delete on public.pagos_suscripcion
  for each row execute function public.libro_solo_agregar();

-- ═══════════════════════════════════════════════════════════════════════════
-- 7 · Bandeja de avisos de pago
-- ═══════════════════════════════════════════════════════════════════════════
-- Cada aviso que llega se anota antes de procesarlo: el mismo aviso dos veces no se procesa
-- dos veces, y queda constancia de qué llegó. Se poda a los 180 días.
create table public.eventos_pago (
  proveedor     text not null,
  id            text not null,
  tipo          text,
  recurso_id    text,
  recibido_en   timestamptz not null default now(),
  procesado_en  timestamptz,
  resultado     text,
  primary key (proveedor, id)
);
create index idx_eventos_pago_recibido on public.eventos_pago (recibido_en);

-- ═══════════════════════════════════════════════════════════════════════════
-- 8 · El dólar vigente y el precio en pesos
-- ═══════════════════════════════════════════════════════════════════════════
create or replace function public.cotizacion_vigente()
returns table (id bigint, venta numeric, leida_en timestamptz)
language sql stable security definer set search_path = public as $$
  select c.id, c.venta, c.leida_en
  from public.cotizaciones_dolar c
  where c.estado = 'vigente'
  order by c.leida_en desc
  limit 1;
$$;

-- Mismo cálculo que `precioEnPesos` de dominio: centavos enteros, hacia arriba a la centena.
-- NULL si todavía no hay ninguna cotización vigente.
create or replace function public.precio_ars(plan text default 'pintor')
returns int
language sql stable security definer set search_path = public as $$
  select (ceil(round(p.precio_usd * c.venta * 100) / 10000) * 100)::int
  from public.planes p, public.cotizacion_vigente() c
  where p.id = plan and p.activo;
$$;

-- ═══════════════════════════════════════════════════════════════════════════
-- 9 · Quién puede cotizar
-- ═══════════════════════════════════════════════════════════════════════════
-- Un pintor (o empresa) con acceso: alguna fila con `acceso_hasta` en el futuro, de cualquier
-- medio de pago, o la inscripción al lanzamiento mientras dure. Si la palanca
-- `exigir_suscripcion` está apagada, alcanza con ser pintor.
-- Una cuenta común sólo puede preguntar por sí misma (no se filtra quién paga); la clave de
-- servicio puede preguntar por cualquiera (la usan las pruebas y la conciliación).
create or replace function public.puede_cotizar(uid uuid default null)
returns boolean
language sql stable security definer set search_path = public as $$
  with quien as (
    select case
             when uid is null or uid = auth.uid() then auth.uid()
             when public.es_service_role() then uid
           end as id
  ),
  aj as (select a.exigir_suscripcion, a.lanzamiento_hasta, a.aceptar_pagos_de_prueba from public.ajustes_de_cobro a limit 1)
  select coalesce((
    select exists (select 1 from public.profiles p where p.id = q.id and p.type in ('painter', 'company'))
       and (
         not coalesce((select aj.exigir_suscripcion from aj), true)
         or exists (
           select 1 from public.suscripciones s
           where s.pintor_id = q.id
             and (s.modo = 'produccion' or coalesce((select aj.aceptar_pagos_de_prueba from aj), false))
             and (
               s.acceso_hasta > now()
               or (s.proveedor = 'lanzamiento'
                   and s.estado <> 'cancelada'
                   and coalesce(now() < (select aj.lanzamiento_hasta from aj), true))
             )
         )
       )
    from quien q
  ), false);
$$;
comment on function public.puede_cotizar(uuid) is
  'true si el pintor puede enviar cotizaciones: tiene acceso pago, o el lanzamiento. Lo usan la '
  'policy jobs_insert_painter_quote y la web antes de mostrar el formulario (0027).';

-- ═══════════════════════════════════════════════════════════════════════════
-- 10 · Inscripción al lanzamiento
-- ═══════════════════════════════════════════════════════════════════════════
-- Cada pintor o empresa queda inscripto mientras dure el lanzamiento. La inscripción no lleva
-- fecha propia: `puede_cotizar` lee `lanzamiento_hasta` en el momento, así que todas terminan el
-- mismo día y crear una cuenta nueva no regala tiempo. El dueño puede cancelar la de una cuenta
-- abusiva (estado = 'cancelada').
create or replace function public.inscribir_al_lanzamiento()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.type in ('painter', 'company')
     and (select coalesce(now() < a.lanzamiento_hasta, true) from public.ajustes_de_cobro a limit 1) then
    insert into public.suscripciones (pintor_id, proveedor, estado)
    values (new.id, 'lanzamiento', 'activa')
    on conflict do nothing;
  end if;
  return new;
end; $$;
revoke execute on function public.inscribir_al_lanzamiento() from public, anon, authenticated;
create trigger trg_inscribir_al_lanzamiento
  after insert or update of type on public.profiles
  for each row execute function public.inscribir_al_lanzamiento();

-- Los pintores que ya existen.
insert into public.suscripciones (pintor_id, proveedor, estado)
select p.id, 'lanzamiento', 'activa' from public.profiles p
where p.type in ('painter', 'company')
on conflict do nothing;

-- ═══════════════════════════════════════════════════════════════════════════
-- 11 · Trabajos: sin comisión, con suscripción, y los huecos H1, H5, H8, H10
-- ═══════════════════════════════════════════════════════════════════════════
alter table public.jobs alter column commission_rate drop not null;
alter table public.jobs alter column commission_rate drop default;
alter table public.jobs
  add column aceptado_en   timestamptz,
  add column cancelado_en  timestamptz,
  add column cancelado_por text check (cancelado_por in ('cliente', 'pintor', 'sistema'));

-- Los trabajos que ya se aceptaron antes de esta migración: el rastro de abajo no deja escribir
-- `aceptado_en` nunca más, así que se completa ahora (seguridad-rls, 8/10/2026). La fecha exacta
-- no se guardaba: se usa la última modificación, que es la mejor aproximación que hay. Sin tocar
-- `updated_at` (`volumen_mensual` agrupa por esa columna).
alter table public.jobs disable trigger trg_jobs_updated;
update public.jobs set aceptado_en = coalesce(updated_at, created_at)
 where status in ('accepted', 'in_progress', 'completed') and aceptado_en is null;
alter table public.jobs enable trigger trg_jobs_updated;

-- La policy de cotizar, con TODAS sus condiciones y de dónde viene cada una (la lección de
-- 0018: una policy reescrita a medias pierde condiciones en silencio).
alter policy jobs_insert_painter_quote on public.jobs
  with check (
    (painter_id = (select auth.uid()))                                     -- 0004
    and (select public.es_pintor())                                        -- 0016
    and (select public.puede_cotizar())                                    -- 0027
    and (client_id <> (select auth.uid()))                                 -- 0006
    and (status = 'quoted'::job_status)                                    -- 0004
    and (project_id is not null)                                           -- 0014
    and (amount is not null) and (amount > 0) and (amount <= 1000000000)   -- 0006/0018
    -- 0006/0018: la aritmética de la comisión SE SACÓ a propósito en 0027 (no hay comisión).
    and exists (                                                           -- 0004/0014
      select 1 from public.projects pr
      where pr.id = jobs.project_id and pr.type = 'service'::project_type
        and pr.owner_id = jobs.client_id and pr.published
    )
    and not exists (                                                       -- 0015
      select 1 from public.jobs j
      where j.project_id = jobs.project_id
        and j.status = any (array['accepted'::job_status, 'in_progress'::job_status, 'completed'::job_status])
    )
  );

-- Antes de la policy (los BEFORE corren antes del WITH CHECK): sin esto, un pintor sin
-- suscripción vería el error genérico de permisos (42501) en lugar del motivo. Además anula la
-- comisión que mande una web o una app vieja.
create or replace function public.exigir_suscripcion()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  new.commission_rate := null;
  new.commission_amount := null;
  if public.es_service_role() or auth.uid() is null then
    return new;
  end if;
  if public.es_pintor() and not public.puede_cotizar() then
    raise exception 'Necesitás una suscripción activa para cotizar' using errcode = 'P0001';
  end if;
  return new;
end; $$;
revoke execute on function public.exigir_suscripcion() from public, anon, authenticated;
drop trigger if exists trg_exigir_suscripcion on public.jobs;
create trigger trg_exigir_suscripcion
  before insert on public.jobs
  for each row execute function public.exigir_suscripcion();

-- H5: el rastro de aceptar y cancelar. Lo escribe la base, nunca quien llama: los valores que
-- vengan en el pedido se ignoran.
create or replace function public.rastro_del_trabajo()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    new.aceptado_en := null;
    new.cancelado_en := null;
    new.cancelado_por := null;
    return new;
  end if;
  new.aceptado_en := old.aceptado_en;
  new.cancelado_en := old.cancelado_en;
  new.cancelado_por := old.cancelado_por;
  if new.status = 'accepted' and old.status is distinct from 'accepted' then
    new.aceptado_en := now();
  end if;
  if new.status = 'cancelled' and old.status is distinct from 'cancelled' then
    new.cancelado_en := now();
    new.cancelado_por := case
      when coalesce(current_setting('app.cancelacion_automatica', true), '') = 'on' then 'sistema'
      when auth.uid() is not null and auth.uid() = old.client_id then 'cliente'
      when auth.uid() is not null and auth.uid() = old.painter_id then 'pintor'
      else 'sistema'
    end;
  end if;
  return new;
end; $$;
revoke execute on function public.rastro_del_trabajo() from public, anon, authenticated;
drop trigger if exists trg_jobs_rastro on public.jobs;
create trigger trg_jobs_rastro
  before insert or update on public.jobs
  for each row execute function public.rastro_del_trabajo();

-- Las reglas de un trabajo, reescritas (reemplaza la versión de 0009):
--   · sin comisión: el dinero no lo cambia nadie, nunca;
--   · H1: una cotización enviada no se edita (ni el monto ni la nota);
--   · H10: las partes no se reasignan ni se borran a mano; pasar a NULL sólo vale si la fila a
--     la que apuntaba ya no existe (es lo que hace la clave foránea al borrarse una cuenta);
--   · aceptar exige que el pedido exista (las cotizaciones de un pedido borrado no se aceptan);
--   · las transiciones, iguales a 0009.
create or replace function public.enforce_job_rules()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  actor_is_client  boolean := (auth.uid() = old.client_id);
  actor_is_painter boolean := (auth.uid() = old.painter_id);
begin
  if public.es_service_role() or auth.uid() is null then
    return new;
  end if;

  -- ── H10: quién es parte no cambia ──
  if new.client_id is distinct from old.client_id
     and (new.client_id is not null or exists (select 1 from public.profiles where id = old.client_id)) then
    raise exception 'No se puede cambiar quién es parte del trabajo' using errcode = 'P0001';
  end if;
  if new.painter_id is distinct from old.painter_id
     and (new.painter_id is not null or exists (select 1 from public.profiles where id = old.painter_id)) then
    raise exception 'No se puede cambiar quién es parte del trabajo' using errcode = 'P0001';
  end if;
  if new.project_id is distinct from old.project_id
     and (new.project_id is not null or exists (select 1 from public.projects where id = old.project_id)) then
    raise exception 'No se puede cambiar el pedido de un trabajo' using errcode = 'P0001';
  end if;

  -- ── H1 y dinero: lo enviado no se edita ──
  if (new.amount is distinct from old.amount)
     or (new.commission_amount is distinct from old.commission_amount)
     or (new.commission_rate is distinct from old.commission_rate)
     or (new.note is distinct from old.note) then
    raise exception 'Una cotización enviada no se edita: retirala y mandá otra' using errcode = 'P0001';
  end if;

  -- ── Transiciones (iguales a 0009) ──
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
      if not (
        (old.status = 'quoted'      and new.status = 'cancelled') or
        (old.status = 'accepted'    and new.status in ('in_progress', 'completed', 'cancelled')) or
        (old.status = 'in_progress' and new.status in ('completed', 'cancelled'))
      ) then
        raise exception 'Transición no permitida para el pintor: % -> %', old.status, new.status;
      end if;
    else
      raise exception 'No sos parte de este trabajo';
    end if;
    if new.status = 'accepted' and new.project_id is null then
      raise exception 'Ese pedido ya no está disponible' using errcode = 'P0001';
    end if;
  end if;

  return new;
end; $$;

-- Aceptar cancela las perdedoras: esas cancelaciones las hace el sistema, no el cliente
-- (si no, el rastro de H5 diría que el cliente canceló cinco cotizaciones).
create or replace function public.on_job_accepted()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.status = 'accepted' and old.status is distinct from 'accepted' and new.project_id is not null then
    update public.projects set published = false where id = new.project_id;

    perform set_config('app.cancelacion_automatica', 'on', true);
    update public.jobs
       set status = 'cancelled'
     where project_id = new.project_id
       and id <> new.id
       and status = 'quoted';
    perform set_config('app.cancelacion_automatica', '', true);
  end if;
  return new;
end; $$;

-- El tipo de un proyecto no cambia después de creado (seguridad-rls, 8/10/2026): un pintor dueño
-- de un PEDIDO lo pasaba a "portfolio", y con eso esquivaba H8 (borrarlo con un trabajo aceptado)
-- y la regla de 0026 (no editar un pedido adjudicado), que miran `type = 'service'`.
create or replace function public.tipo_de_proyecto_fijo()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.type is distinct from old.type and not public.es_service_role() and auth.uid() is not null then
    raise exception 'El tipo de una publicación no se cambia' using errcode = 'P0001';
  end if;
  return new;
end; $$;
revoke execute on function public.tipo_de_proyecto_fijo() from public, anon, authenticated;
drop trigger if exists trg_tipo_de_proyecto_fijo on public.projects;
create trigger trg_tipo_de_proyecto_fijo
  before update of type on public.projects
  for each row execute function public.tipo_de_proyecto_fijo();

-- H8: un pedido adjudicado no se borra (0026 ya impide editarlo). Las obras de portfolio sí.
alter policy projects_delete_own on public.projects
  using (
    owner_id = (select auth.uid())
    and (
      type <> 'service'::project_type
      or not exists (
        select 1 from public.jobs j
        where j.project_id = projects.id
          and j.status in ('accepted', 'in_progress', 'completed')
      )
    )
  );

-- ═══════════════════════════════════════════════════════════════════════════
-- 12 · Para el admin
-- ═══════════════════════════════════════════════════════════════════════════
create or replace function public.metricas_suscripciones()
returns table (
  activos bigint, en_gracia bigint, en_lanzamiento bigint, sin_acceso bigint,
  ingreso_mes_ars numeric, devoluciones_mes_ars numeric, transferencias_a_revisar bigint
)
language sql stable security definer set search_path = public as $$
  with pintores as (
    select p.id from public.profiles p where p.type in ('painter', 'company')
  ),
  acceso as (
    select pi.id,
      (select max(s.vigente_hasta) from public.suscripciones s where s.pintor_id = pi.id) as vigente,
      (select max(s.acceso_hasta)  from public.suscripciones s where s.pintor_id = pi.id) as acceso,
      exists (select 1 from public.suscripciones s where s.pintor_id = pi.id and s.proveedor = 'lanzamiento' and s.estado <> 'cancelada') as inscripto
    from pintores pi
  ),
  aj as (select lanzamiento_hasta from public.ajustes_de_cobro limit 1),
  mes as (select date_trunc('month', now() at time zone 'America/Argentina/Buenos_Aires') at time zone 'America/Argentina/Buenos_Aires' as desde)
  select
    count(*) filter (where vigente > now()),
    count(*) filter (where (vigente is null or vigente <= now()) and acceso > now()),
    count(*) filter (where (acceso is null or acceso <= now()) and inscripto and coalesce(now() < (select lanzamiento_hasta from aj), true)),
    count(*) filter (where (acceso is null or acceso <= now()) and not (inscripto and coalesce(now() < (select lanzamiento_hasta from aj), true))),
    (select coalesce(sum(monto_ars), 0) from public.pagos_suscripcion where tipo = 'cobro' and modo = 'produccion' and fecha >= (select desde from mes)),
    (select coalesce(sum(monto_ars), 0) from public.pagos_suscripcion where tipo in ('devolucion', 'contracargo') and modo = 'produccion' and fecha >= (select desde from mes)),
    (select count(*) from public.cobros where medio = 'transferencia' and estado = 'a_revisar')
  from acceso
  -- HAVING y no WHERE: sin GROUP BY, un WHERE falso igual devuelve una fila, con los ingresos
  -- calculados por las subconsultas. HAVING falso no devuelve ninguna.
  having (select public.es_admin());
$$;

-- H5 a la vista: cancelaciones después de aceptar (el teléfono ya se había mostrado).
create or replace function public.cancelaciones_tras_aceptar(limite int default 50)
returns table (job_id uuid, cliente uuid, pintor uuid, monto int, aceptado_en timestamptz, cancelado_en timestamptz, cancelado_por text)
language sql stable security definer set search_path = public as $$
  select j.id, j.client_id, j.painter_id, j.amount, j.aceptado_en, j.cancelado_en, j.cancelado_por
  from public.jobs j
  where (select public.es_admin())
    and j.status = 'cancelled' and j.aceptado_en is not null
  order by j.cancelado_en desc nulls last
  limit least(greatest(limite, 1), 500);
$$;

-- ═══════════════════════════════════════════════════════════════════════════
-- 13 · Permisos
-- ═══════════════════════════════════════════════════════════════════════════
-- Supabase da TODO a anon y authenticated en cada tabla y función nueva: primero se saca todo,
-- después se da lo justo. Sólo la clave de servicio escribe; en el libro, sólo agrega.
revoke all on table public.ajustes_de_cobro, public.planes, public.cotizaciones_dolar,
  public.suscripciones, public.codigos_de_pago, public.cobros, public.pagos_suscripcion,
  public.eventos_pago
  from public, anon, authenticated, service_role;

-- De los ajustes, sólo lo que la pantalla necesita: los umbrales del control del dólar y la
-- llave de los pagos de prueba no son públicos.
grant select (id, lanzamiento_hasta, exigir_suscripcion, medios_activos) on public.ajustes_de_cobro to anon, authenticated;
grant select on table public.planes to anon, authenticated;
grant select on table public.suscripciones, public.codigos_de_pago, public.cobros, public.pagos_suscripcion to authenticated;

grant select, insert, update, delete on table public.ajustes_de_cobro, public.planes,
  public.cotizaciones_dolar, public.suscripciones, public.codigos_de_pago, public.cobros,
  public.eventos_pago to service_role;
grant select, insert on table public.pagos_suscripcion to service_role;

-- Las secuencias de las columnas identity quedaban abiertas a anon y authenticated (el revoke
-- de arriba es sólo de tablas). La clave de servicio no necesita USAGE para insertar en una
-- columna identity.
revoke all on sequence public.cotizaciones_dolar_id_seq, public.codigos_de_pago_numero_seq
  from public, anon, authenticated;

alter table public.ajustes_de_cobro   enable row level security;
alter table public.planes             enable row level security;
alter table public.cotizaciones_dolar enable row level security;
alter table public.suscripciones      enable row level security;
alter table public.codigos_de_pago    enable row level security;
alter table public.cobros             enable row level security;
alter table public.pagos_suscripcion  enable row level security;
alter table public.eventos_pago       enable row level security;

create policy ajustes_de_cobro_lectura on public.ajustes_de_cobro for select using (true);
create policy planes_lectura on public.planes for select using (activo and publico);
create policy suscripciones_propias on public.suscripciones for select using (pintor_id = (select auth.uid()));
create policy codigos_de_pago_propios on public.codigos_de_pago for select using (pintor_id = (select auth.uid()));
create policy cobros_propios on public.cobros for select using (pintor_id = (select auth.uid()));
create policy pagos_propios on public.pagos_suscripcion for select using (pintor_id = (select auth.uid()));
-- cotizaciones_dolar y eventos_pago: sin policies; sólo la clave de servicio (que salta RLS).

revoke execute on function public.cotizacion_vigente() from public;
revoke execute on function public.precio_ars(text) from public;
grant execute on function public.cotizacion_vigente() to anon, authenticated, service_role;
grant execute on function public.precio_ars(text) to anon, authenticated, service_role;

revoke execute on function public.puede_cotizar(uuid) from public, anon;
grant execute on function public.puede_cotizar(uuid) to authenticated, service_role;

revoke execute on function public.metricas_suscripciones() from public, anon;
revoke execute on function public.cancelaciones_tras_aceptar(int) from public, anon;
grant execute on function public.metricas_suscripciones() to authenticated;
grant execute on function public.cancelaciones_tras_aceptar(int) to authenticated;

notify pgrst, 'reload schema';

commit;
