-- 0003_onboarding.sql
-- Soporte para login social (Google/Microsoft/Facebook) + selección de rol.
--
-- Problema: cuando alguien entra con OAuth, Supabase no sabe si es cliente, pintor
-- o empresa. El trigger handle_new_user crea el profile con type 'client' por defecto,
-- pero eso no distingue "eligió cliente" de "todavía no eligió".
--
-- Solución: una columna `onboarded`. El que se registra con el formulario (manda su rol)
-- queda onboarded=true; el que entra por OAuth queda onboarded=false y la app lo manda
-- a /bienvenida a elegir su rol.

alter table public.profiles
  add column if not exists onboarded boolean not null default false;

-- Recreamos el trigger: marca onboarded según si vino el rol en el alta.
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, full_name, type, onboarded)
  values (
    new.id,
    new.raw_user_meta_data->>'full_name',
    coalesce((new.raw_user_meta_data->>'type')::profile_type, 'client'),
    -- true si el alta trajo rol (signup con formulario); false si fue OAuth (sin rol)
    (new.raw_user_meta_data->>'type') is not null
  );
  return new;
end; $$;

-- Los usuarios que ya existen (sembrados / con rol real) quedan onboarded.
update public.profiles set onboarded = true where onboarded = false;
