-- 0008_admin.sql
-- Separa "empresa" (rol de negocio) de "administrador" (privilegio de plataforma).
--
-- PROBLEMA QUE RESUELVE: `profiles.type = 'company'` significaba las dos cosas a la vez.
-- Y "Empresa" es una opción del formulario público de alta (/crear-cuenta) y del selector
-- de rol (/bienvenida), donde el valor viaja en raw_user_meta_data y `handle_new_user` lo
-- escribe tal cual. O sea: cualquiera se registraba eligiendo "Empresa" en un <select> y
-- entraba a /admin a leer nombre, email y teléfono de TODOS los prospectos — la lista que
-- 0007 dice explícitamente que no hay que servirle a la competencia.
--
-- Ahora el acceso de administración depende de una columna que el usuario no puede escribir.
--
-- Correr en Supabase → SQL Editor, después de 0007.

begin;

alter table public.profiles add column if not exists is_admin boolean not null default false;

comment on column public.profiles.is_admin is
  'Acceso al panel de administración. Sólo se puede activar con service-role (SQL Editor); '
  'el trigger freeze_profile_trust_fields lo congela para cualquier escritura del usuario.';

-- ── El usuario no puede auto-otorgarse admin ──────────────────────────
-- Se suma is_admin a los campos que el trigger revierte. Sin esto, `profiles_update_own`
-- (que permite escribir cualquier columna de la fila propia) haría inútil toda la columna.
create or replace function public.freeze_profile_trust_fields()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if public.es_service_role() then
    return new;
  end if;
  -- Recálculo legítimo del rating disparado por una reseña.
  if coalesce(current_setting('app.rating_recalc', true), 'off') = 'on' then
    return new;
  end if;
  if auth.uid() is null then
    return new;  -- contexto sin JWT (SQL Editor, migraciones)
  end if;

  new.verified     := old.verified;
  new.rating       := old.rating;
  new.rating_count := old.rating_count;
  new.is_admin     := old.is_admin;   -- el privilegio de plataforma nunca se auto-otorga

  -- El rol se elige UNA vez, en el onboarding. Después queda fijo, y `onboarded` no puede
  -- volver atrás: si se pudiera, alcanzaría con apagarlo para reabrir el cambio de rol.
  if old.onboarded then
    new.type      := old.type;
    new.onboarded := true;
  end if;

  return new;
end; $$;

-- ── Los leads pasan a depender de is_admin, no del rol de negocio ─────
drop policy if exists "leads_select_company" on public.leads;
drop policy if exists "leads_update_company" on public.leads;

create policy "leads_select_admin" on public.leads
  for select using (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin)
  );

create policy "leads_update_admin" on public.leads
  for update using (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin)
  );

-- ── Alta del primer administrador ─────────────────────────────────────
-- Si ya existe un perfil de empresa (el de la propia Pintura Pro, sembrado por
-- scripts/seed_supabase.py como empresa@pinturapro.demo), se lo marca como admin para no
-- quedar sin acceso al panel después de esta migración.
update public.profiles
   set is_admin = true
 where type = 'company'
   and id in (select id from public.profiles where type = 'company' order by created_at asc limit 1);

-- Para dar de alta otro administrador más adelante, desde el SQL Editor:
--   update public.profiles set is_admin = true where id = '<uuid del usuario>';

commit;
