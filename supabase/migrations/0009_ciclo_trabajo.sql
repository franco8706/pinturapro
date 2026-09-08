-- 0009_ciclo_trabajo.sql
-- Cierra el ciclo de vida del trabajo: el dinero deja de ser editable por el cliente, y
-- aceptar una cotización cierra el pedido y descarta las demás.
--
-- Correr en Supabase → SQL Editor, después de 0008.

begin;

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

commit;
