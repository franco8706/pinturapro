-- 0006_security.sql
-- Cierra los huecos de autorización de la auditoría.
--
-- CONTEXTO: la `anon key` viaja en el bundle del navegador — es pública por diseño.
-- Cualquiera con sesión puede pegarle directo a PostgREST y saltear TODAS las Server
-- Actions. Las validaciones en actions.ts son UX, no seguridad. El límite real es esto.
--
-- Correr en Supabase → SQL Editor, después de 0005. Es idempotente.
--
-- NOTA DE REVISIÓN: una primera versión de este archivo no se podía aplicar (el índice
-- único chocaba con los datos del seed y hacía rollback de todo) y tenía varios arreglos
-- incompletos. Cada corrección quedó comentada abajo, en su bloque.

begin;

-- ═══════════════════════════════════════════════════════════════════════════
-- Helper: ¿la escritura viene del backend con service-role?
-- ═══════════════════════════════════════════════════════════════════════════
-- Usamos auth.role() de Supabase y NO current_setting('request.jwt.claim.role').
-- Esa GUC por-claim quedó deprecada en PostgREST 9 y removida después: PostgREST
-- moderno sólo setea `request.jwt.claims` (JSON con todos los claims). Con la forma
-- vieja la guarda era código muerto y el service-role pasaba sólo por accidente.
create or replace function public.es_service_role() returns boolean
language sql stable as $$
  select coalesce(
    nullif(current_setting('request.jwt.claim.role', true), ''),
    (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role'),
    ''
  ) = 'service_role';
$$;


-- ═══════════════════════════════════════════════════════════════════════════
-- S1 · Reseñas: sólo el cliente de un trabajo COMPLETADO reseña a SU pintor
-- ═══════════════════════════════════════════════════════════════════════════
-- Antes la policy sólo pedía author_id = auth.uid(): cualquiera reseñaba a cualquiera.
--
-- CORRECCIÓN: validar el job no alcanzaba. `jobs_insert_client` (0001) deja al cliente
-- insertar un job con CUALQUIER status, así que el atacante se fabricaba un job ya en
-- 'completed' y pasaba el check igual. Hay que cerrar las dos puntas.
drop policy if exists "reviews_insert_author" on public.reviews;
create policy "reviews_insert_author" on public.reviews
  for insert with check (
    author_id = auth.uid()
    and exists (
      select 1 from public.jobs j
      where j.id = job_id
        and j.client_id = auth.uid()     -- el trabajo es tuyo, como cliente
        and j.painter_id = target_id     -- y reseñás al pintor que lo hizo
        and j.status = 'completed'       -- y el trabajo terminó
    )
  );

-- La otra punta: un cliente ya no puede fabricarse jobs. Ningún código de la app inserta
-- jobs como cliente (verificado en app/(marketplace)/actions.ts y apps/mobile/lib/mutations.ts:
-- el único INSERT es `cotizar`, con painter_id = auth.uid()). El seed usa service-role,
-- que no pasa por RLS. Así que esta policy se puede cerrar del todo sin romper nada.
drop policy if exists "jobs_insert_client" on public.jobs;

-- Sin policy de UPDATE/DELETE en reviews a propósito: si se pudieran editar, se esquivaría
-- el check de arriba cambiando el rating después de insertarlo.


-- ═══════════════════════════════════════════════════════════════════════════
-- S2 · Perfiles: los campos de confianza dejan de ser escribibles
-- ═══════════════════════════════════════════════════════════════════════════
-- `profiles_update_own` permite escribir CUALQUIER columna de la fila propia. Un pintor
-- hacía `set verified = true, rating = 5.0` y quedaba nivel "Master" y primero en /pintores.
-- Postgres no tiene RLS por columna, así que se congelan con un trigger.
--
-- CORRECCIÓN: `type` se congelaba sólo `if old.onboarded`, pero `onboarded` no se congelaba.
-- El bypass eran dos requests: apagás onboarded, después te cambiás a 'company' y entrás
-- a /admin y /panel. Ahora `onboarded` sólo puede ir de false a true.

-- El recálculo del rating (trigger de reviews, 0002) escribe rating/rating_count con el JWT
-- del usuario que reseñó. Sin esta marca el congelamiento lo revertiría y los ratings
-- quedarían clavados para siempre.
create or replace function public.recalc_profile_rating(target uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  perform set_config('app.rating_recalc', 'on', true);  -- true = sólo esta transacción
  update public.profiles p set
    rating = coalesce((select round(avg(r.rating)::numeric, 1) from public.reviews r where r.target_id = target), 0),
    rating_count = (select count(*) from public.reviews r where r.target_id = target)
  where p.id = target;
  perform set_config('app.rating_recalc', 'off', true);
end; $$;

create or replace function public.freeze_profile_trust_fields()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if public.es_service_role() then
    return new;
  end if;
  -- Recálculo legítimo disparado por una reseña.
  if coalesce(current_setting('app.rating_recalc', true), 'off') = 'on' then
    return new;
  end if;
  if auth.uid() is null then
    return new;  -- contexto sin JWT (SQL Editor, migraciones)
  end if;

  new.verified     := old.verified;
  new.rating       := old.rating;       -- caché que mantiene el trigger de reviews
  new.rating_count := old.rating_count;

  -- El rol se elige UNA vez, en el onboarding (/bienvenida, para perfiles que llegan por
  -- OAuth sin rol). Después queda fijo, y `onboarded` no puede volver atrás: si se pudiera,
  -- alcanzaría con apagarlo para reabrir el cambio de rol.
  if old.onboarded then
    new.type      := old.type;
    new.onboarded := true;
  end if;

  return new;
end; $$;

drop trigger if exists trg_profiles_freeze_trust on public.profiles;
create trigger trg_profiles_freeze_trust
  before update on public.profiles
  for each row execute function public.freeze_profile_trust_fields();


-- ═══════════════════════════════════════════════════════════════════════════
-- S3 · Trabajos: la máquina de estados y el dinero se aplican en la base
-- ═══════════════════════════════════════════════════════════════════════════
-- `jobs_update_participant` sólo pedía ser participante, sin WITH CHECK ni restricción de
-- columnas: el pintor aceptaba su propia cotización, subía el monto, o ponía la comisión en cero.

drop policy if exists "jobs_update_participant" on public.jobs;

create policy "jobs_update_client" on public.jobs
  for update using (client_id = auth.uid()) with check (client_id = auth.uid());

create policy "jobs_update_painter" on public.jobs
  for update using (painter_id = auth.uid()) with check (painter_id = auth.uid());

-- CORRECCIÓN: el dinero tampoco se validaba al NACER. `jobs_insert_painter_quote` (0004) no
-- miraba amount ni commission_amount, así que el pintor cotizaba con comisión cero desde el
-- INSERT. Se valida acá, donde nace.
drop policy if exists "jobs_insert_painter_quote" on public.jobs;
create policy "jobs_insert_painter_quote" on public.jobs
  for insert with check (
    painter_id = auth.uid()
    and client_id <> auth.uid()          -- no podés cotizarte a vos mismo
    and status = 'quoted'
    and project_id is not null
    and amount is not null and amount > 0 and amount <= 1000000000
    -- La comisión tiene que ser la que corresponde (10%), con 1 peso de tolerancia por redondeo.
    and commission_amount is not null
    and abs(commission_amount - round(amount * coalesce(commission_rate, 0.100))) <= 1
    and coalesce(commission_rate, 0.100) = 0.100
    and exists (
      select 1 from public.projects p
      where p.id = project_id and p.type = 'service' and p.owner_id = client_id
    )
  );

-- CORRECCIÓN: la versión anterior hacía `new.client_id := old.client_id` (etc.) de forma
-- incondicional. Eso REVERTÍA el `on delete set null` de las FK: al borrar un project o un
-- profile, Postgres ponía NULL y el trigger lo devolvía al valor viejo, dejando foreign keys
-- colgadas apuntando a filas inexistentes. Ahora se lanza excepción ante una reasignación
-- real, y se permite explícitamente el único cambio legítimo: old → NULL por cascada.
create or replace function public.enforce_job_rules()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  actor_is_client  boolean := (auth.uid() = old.client_id);
  actor_is_painter boolean := (auth.uid() = old.painter_id);
begin
  if public.es_service_role() or auth.uid() is null then
    return new;
  end if;

  -- Las partes no se reasignan. Pasar a NULL sí se permite: es lo que hace la FK al
  -- borrarse el padre, y bloquearlo dejaría la base inconsistente.
  if new.client_id is distinct from old.client_id and new.client_id is not null then
    raise exception 'No se puede reasignar el cliente del trabajo';
  end if;
  if new.painter_id is distinct from old.painter_id and new.painter_id is not null then
    raise exception 'No se puede reasignar el pintor del trabajo';
  end if;
  if new.project_id is distinct from old.project_id and new.project_id is not null then
    raise exception 'No se puede reasignar el pedido del trabajo';
  end if;

  -- El dinero se congela apenas la cotización deja de estar en 'quoted'.
  if old.status <> 'quoted' then
    new.amount            := old.amount;
    new.commission_amount := old.commission_amount;
    new.commission_rate   := old.commission_rate;
  end if;

  -- Transiciones permitidas.
  -- CORRECCIÓN: antes 'in_progress' era un estado terminal — el pintor podía entrar pero
  -- ninguna rama lo dejaba salir, y el trabajo quedaba tapiado sin poder completarse ni
  -- cancelarse. Ahora el ciclo cierra por los dos lados.
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

drop trigger if exists trg_jobs_rules on public.jobs;
create trigger trg_jobs_rules
  before update on public.jobs
  for each row execute function public.enforce_job_rules();


-- ═══════════════════════════════════════════════════════════════════════════
-- S4 · Una cotización VIVA por pintor y pedido
-- ═══════════════════════════════════════════════════════════════════════════
-- CORRECCIÓN CRÍTICA: la versión anterior indexaba (project_id, painter_id) para TODOS los
-- jobs. El seed genera un job por cada reseña, todos con el mismo project_id del pintor
-- (scripts/seed_supabase.py: `proj_by_owner.get(painter)` dentro del loop), así que había
-- hasta 9 duplicados y el CREATE INDEX fallaba — haciendo rollback de TODA la migración.
-- Acotado a status='quoted' se crea limpio y sigue impidiendo lo que importa: que un pintor
-- cotice el mismo pedido muchas veces y le dispare un email al cliente en cada intento.
drop index if exists public.uniq_jobs_quote_por_pintor;
create unique index if not exists uniq_jobs_quote_viva
  on public.jobs (project_id, painter_id)
  where status = 'quoted' and painter_id is not null and project_id is not null;


-- ═══════════════════════════════════════════════════════════════════════════
-- S10 · El teléfono deja de ser legible por cualquiera
-- ═══════════════════════════════════════════════════════════════════════════
-- `profiles_select_all using (true)` expone TODOS los perfiles a cualquier anónimo, con
-- teléfono incluido. La policy de FILAS no se toca: los pintores necesitan leer el nombre
-- del cliente que publicó un pedido (getOpenServiceRequests), y restringirla rompería
-- /trabajos.
--
-- CORRECCIÓN: `revoke select (phone)` a secas no hacía NADA. En Postgres los privilegios de
-- tabla y de columna son ACLs separadas y basta con que UNA conceda; Supabase corre
-- `grant all on all tables in schema public to anon, authenticated`, así que el permiso de
-- tabla seguía ganando. Para que el privilegio por columna signifique algo hay que sacar
-- primero el de tabla y devolver las columnas una por una.
--
-- MANTENIMIENTO: al agregar una columna nueva a `profiles` hay que sumarla acá, o no se
-- va a poder leer desde la app. Ninguna query usa select("*") sobre profiles (verificado),
-- así que este esquema es seguro hoy.
revoke select on public.profiles from anon, authenticated;
grant select (
  id, type, full_name, avatar_url, bio, location, lat, lng,
  verified, rating, rating_count, specialties, onboarded, pros, cons,
  created_at, updated_at
) on public.profiles to anon, authenticated;

-- El backend sigue viendo todo (incluido el teléfono) para poder contactar a las partes.
grant select on public.profiles to service_role;

-- OPCIONAL — decisión de producto, no de seguridad.
-- Hoy cualquier anónimo lista los pedidos de los clientes con zona y presupuesto. Si querés
-- exigir login para ver el tablero de trabajos, descomentá. Ojo: cambia el embudo de
-- /trabajos (hoy el visitante ve los pedidos y recién al cotizar se le pide cuenta).
-- El portfolio público (/obras) sigue abierto en los dos casos.
--
-- drop policy if exists "projects_select_pub_or_own" on public.projects;
-- create policy "projects_select_pub_or_own" on public.projects
--   for select using (
--     owner_id = auth.uid()
--     or (published and (type = 'portfolio' or auth.uid() is not null))
--   );

commit;
