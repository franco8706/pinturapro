-- 0013: dejar de publicar el domicilio de los clientes.
--
-- Hallazgo de la auditoría: sin ninguna sesión, con la anon key que viaja en el bundle del
-- navegador, cualquiera se bajaba el padrón completo de clientes con nombre, barrio y
-- coordenadas:
--
--   curl "$URL/rest/v1/profiles?select=full_name,lat,lng&type=eq.client" -H "apikey: $ANON"
--   → [{"full_name":"Carolina Ruiz","lat":-34.6395,"lng":-58.3795}, ...]
--
-- Eso es la casa de una persona con ~11 metros de precisión. Los pintores en el mapa son
-- deliberadamente públicos; los clientes nunca tuvieron que estarlo, y de hecho NINGÚN
-- formulario de la app escribe lat/lng — a los clientes les llegó sólo por el seed.
--
-- Se arregla en dos capas independientes, porque una sola no alcanza:

-- ── Capa 1: las coordenadas salen del alcance público ─────────────────
-- Un grant de columna no distingue filas, así que mientras `lat`/`lng` estén otorgadas se
-- pueden leer de CUALQUIER perfil. Se las sacamos a todos y el mapa pasa a servirse por una
-- función que sólo devuelve pintores. Así la fuga no puede volver por un cambio de policy.
revoke select (lat, lng) on public.profiles from anon, authenticated;

-- Limpieza del dato que nunca debió estar: coordenadas de quien no es pintor.
update public.profiles set lat = null, lng = null where type <> 'painter';

-- El mapa de /mapa y /pintores. Es público a propósito: un pintor se publica para que lo
-- encuentren. Devuelve SÓLO pintores, así que no hay forma de pedirle un cliente.
create or replace function public.pintores_geolocalizados()
returns table (id uuid, lat double precision, lng double precision)
language sql
stable
security definer
set search_path = public
as $$
  select p.id, p.lat, p.lng
  from public.profiles p
  where p.type = 'painter'
    and p.lat is not null
    and p.lng is not null;
$$;

-- PUBLIC (default de Postgres) y anon (default privileges de Supabase) — hacen falta los dos
-- revokes, ver la nota en 0011. Acá sí se lo devolvemos a anon: el mapa se ve sin login.
revoke execute on function public.pintores_geolocalizados() from public, anon;
grant execute on function public.pintores_geolocalizados() to anon, authenticated;

-- ── Capa 2: el padrón deja de ser enumerable sin sesión ───────────────
-- `profiles_select_all using (true)` dejaba listar a todo el mundo. Ahora, sin sesión sólo se
-- ven los perfiles que existen para ser vistos (pintores y empresas).
--
-- Con sesión se sigue viendo todo, y es a propósito: hay pantallas legítimas que necesitan el
-- nombre de un cliente —el pintor mirando los pedidos abiertos de /trabajos, el autor de una
-- reseña en el perfil público, los testimonios de la home— y restringirlas rompería el
-- producto sin ganar mucho: cualquiera puede crearse una cuenta. Lo que esta capa corta es el
-- scrapeo masivo y anónimo con la llave que ya está publicada en el bundle. El dato sensible
-- de verdad (teléfono, coordenadas, is_admin) ya no se puede leer por columna, sin importar
-- la fila.
drop policy if exists "profiles_select_all" on public.profiles;
drop policy if exists "profiles_select_publicos_o_con_sesion" on public.profiles;
create policy "profiles_select_publicos_o_con_sesion" on public.profiles
  for select using (
    type in ('painter', 'company')   -- el directorio, visible para cualquiera
    or auth.uid() is not null        -- con sesión, el resto de la app funciona igual
  );

comment on function public.pintores_geolocalizados() is
  'Coordenadas para el mapa. Existe porque lat/lng dejó de estar en el grant de columna de '
  'profiles: era la casa de cada cliente, legible por cualquiera con la anon key.';
