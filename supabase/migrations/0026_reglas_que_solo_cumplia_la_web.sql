-- ═══════════════════════════════════════════════════════════════════════════
-- 0026 · Las reglas que sólo cumplía la web
-- ═══════════════════════════════════════════════════════════════════════════
-- ESTADO (3/10/2026): escrita y probada dentro de una transacción que se deshace
-- (`tools/auditoria/escala/probar-0026.sql`), SIN APLICAR a la base en vivo. Aplicarla lo
-- autoriza el dueño. Al aplicarla, borrar estas líneas y anotarlo en la BITÁCORA.
-- ORDEN: después de 0024 (ver la nota sobre `projects_update_own` al final).
--
-- El agente `abuso-marketplace` (2/10/2026) le habló directo a la API con la sesión de una
-- cuenta común, sin pasar por la web, y encontró tres reglas que vivían sólo en las acciones
-- del sitio:
--   · el tope de pedidos y de cotizaciones por hora (`POST /rest/v1/projects` y `/jobs` → 201);
--   · el piso de una cotización (se puede cotizar $1, que es ganar el pedido para arreglar
--     otro precio por fuera);
--   · que un pedido YA ADJUDICADO no se toca: `projects_update_own` no miraba si había un
--     trabajo aceptado, y con un PATCH se le cambió el título, la zona y el presupuesto y se
--     lo volvió a publicar con otros datos que los que el pintor aceptó.
-- Ninguna es un agujero de seguridad —cada cuenta sólo crea y edita lo suyo— pero una regla
-- que se saltea con un `curl` no es una regla. La app móvil también le habla directo a la base.
--
-- La primera versión de esta migración la revisó `seguridad-rls` (3/10) y encontró tres
-- formas de esquivarla, todas corregidas acá:
--   · `created_at` lo escribe quien inserta: con una fecha de 2020 la fila no se contaba en
--     "la última hora". Ahora la fecha la pone la base, y no se puede cambiar después.
--   · Borrar los pedidos propios y volver a publicar reseteaba el tope: se contaba sobre la
--     tabla. Ahora se cuenta en un registro aparte que borrar un pedido no toca.
--   · El piso de $1.000 era sólo al insertar: se cotizaba $1.000 y después un PATCH lo bajaba
--     a $1 (el trigger de 0009 deja corregir el monto mientras la cotización está pendiente).
--     Ahora el piso vale también al cambiar el monto.
--
-- Los números son los de `@pinturapro/dominio` (TOPE_POR_HORA, COTIZACION_MINIMA): si cambian
-- allá, cambian acá. Los mensajes de error son los que traduce `mensajeDeError`.

-- ─── 0. La fecha de alta la pone la base ─────────────────────────────────────
-- Sin esto, cualquier tope "por hora" se esquiva poniendo una fecha vieja.
create or replace function public.fecha_de_alta_fija()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- La clave de servicio (el seed, las pruebas, una carga a mano) puede poner fechas.
  if public.es_service_role() or auth.uid() is null then
    return new;
  end if;
  if tg_op = 'INSERT' then
    new.created_at := now();
  else
    new.created_at := old.created_at;
  end if;
  return new;
end;
$$;
revoke execute on function public.fecha_de_alta_fija() from public, anon, authenticated;

drop trigger if exists trg_fecha_de_alta_fija on public.projects;
create trigger trg_fecha_de_alta_fija
  before insert or update of created_at on public.projects
  for each row execute function public.fecha_de_alta_fija();

drop trigger if exists trg_fecha_de_alta_fija on public.jobs;
create trigger trg_fecha_de_alta_fija
  before insert or update of created_at on public.jobs
  for each row execute function public.fecha_de_alta_fija();

-- ─── 1. Tope de pedidos por hora ─────────────────────────────────────────────
-- Se cuenta en un registro propio, no en `projects`: un pedido borrado sigue contando. Guarda
-- sólo quién y cuándo, y se poda solo a las 24 horas.
create table if not exists public.registro_de_pedidos (
  owner_id uuid not null references public.profiles (id) on delete cascade,
  creado timestamptz not null default now()
);
create index if not exists idx_registro_de_pedidos on public.registro_de_pedidos (owner_id, creado desc);
alter table public.registro_de_pedidos enable row level security;
-- Sin policies: nadie lo lee ni lo escribe por la API. Sólo el trigger, que es security definer.
revoke all on public.registro_de_pedidos from public, anon, authenticated;

create or replace function public.tope_de_pedidos()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.es_service_role() or auth.uid() is null or new.type <> 'service' then
    return new;
  end if;
  delete from public.registro_de_pedidos
  where owner_id = new.owner_id and creado < now() - interval '1 day';
  if (
    select count(*) from public.registro_de_pedidos r
    where r.owner_id = new.owner_id and r.creado > now() - interval '1 hour'
  ) >= 10 then
    raise exception 'Publicaste muchos pedidos en poco tiempo' using errcode = 'P0001';
  end if;
  insert into public.registro_de_pedidos (owner_id) values (new.owner_id);
  return new;
end;
$$;
revoke execute on function public.tope_de_pedidos() from public, anon, authenticated;

drop trigger if exists trg_tope_de_pedidos on public.projects;
create trigger trg_tope_de_pedidos
  before insert on public.projects
  for each row execute function public.tope_de_pedidos();

-- ─── 2. Tope de cotizaciones por hora y piso del monto ───────────────────────
-- Los trabajos no se pueden borrar por la API (no hay policy de DELETE en `jobs`), así que
-- acá alcanza con contar la tabla, ahora que la fecha la pone la base.
create or replace function public.limites_de_cotizacion()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.es_service_role() or auth.uid() is null then
    return new;
  end if;
  -- El piso, al crear Y al corregir el monto.
  if new.amount is not null and new.amount < 1000
     and (tg_op = 'INSERT' or new.amount is distinct from old.amount) then
    raise exception 'El monto mínimo de una cotización es $1.000' using errcode = 'P0001';
  end if;
  if tg_op = 'INSERT' and (
    select count(*) from public.jobs j
    where j.painter_id = new.painter_id and j.created_at > now() - interval '1 hour'
  ) >= 30 then
    raise exception 'Enviaste muchas cotizaciones en poco tiempo' using errcode = 'P0001';
  end if;
  return new;
end;
$$;
revoke execute on function public.limites_de_cotizacion() from public, anon, authenticated;

drop trigger if exists trg_limites_de_cotizacion on public.jobs;
create trigger trg_limites_de_cotizacion
  before insert or update of amount on public.jobs
  for each row execute function public.limites_de_cotizacion();

-- Para que contar "las de la última hora" no recorra toda la historia de un pintor activo.
create index if not exists idx_jobs_pintor_fecha on public.jobs (painter_id, created_at desc);

-- ─── 3. Un pedido adjudicado no se edita ─────────────────────────────────────
-- Misma policy de 0016, con una condición más en `using`: si el PEDIDO ya tiene un trabajo
-- aceptado, en curso o terminado, su dueño no lo puede modificar (ni volver a publicar, ni
-- cambiarle el tipo: `using` mira la fila como estaba). Cerrar y reabrir el pedido cuando se
-- acepta o se cancela un trabajo lo hacen los triggers de 0009, que corren con los permisos de
-- su dueño y no pasan por esta policy.
--
-- OJO, ORDEN: esta policy la reescribió también una versión anterior de 0024. 0024 ya no la
-- toca (3/10): esta es la única definición vigente, y ya trae `(select auth.uid())`. Si alguna
-- vez se vuelve a escribir `projects_update_own`, tiene que conservar el `not exists`.
-- Comprobar después de aplicar: `select pg_get_expr(polqual, polrelid) from pg_policy where
-- polname = 'projects_update_own'` tiene que mostrar el `not exists` sobre `jobs`.
alter policy projects_update_own on public.projects
  using (
    owner_id = (select auth.uid())
    -- Sólo los PEDIDOS: una obra de portfolio puede tener trabajos terminados colgando de ella
    -- (es el historial del pintor) y su dueño tiene que poder seguir editándola.
    and (
      type <> 'service'::project_type
      or not exists (
        select 1 from public.jobs j
        where j.project_id = projects.id
          and j.status in ('accepted', 'in_progress', 'completed')
      )
    )
  )
  with check (
    (owner_id = (select auth.uid()))
    and ((type = 'service'::project_type) or (select public.es_pintor()))
  );

notify pgrst, 'reload schema';
