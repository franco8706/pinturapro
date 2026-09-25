-- ═══════════════════════════════════════════════════════════════════════════
-- 0020 · La ubicación del pintor se muestra por zona, como dice la política
-- ═══════════════════════════════════════════════════════════════════════════
-- `/privacidad` promete, desde que se escribió: "Tu ubicación aparece en el mapa a nivel de
-- zona". `pintores_geolocalizados()` devolvía la coordenada tal cual está guardada, con
-- cuatro decimales — unos 11 metros. Eso no es una zona: es una casa.
--
-- Confirmado con la clave anon, sin sesión: la función devolvía -34.5889, -58.4306.
--
-- Hoy no hay ningún pintor real con coordenada real —ningún formulario del sitio las
-- carga, sólo el seed de demostración—, así que nadie quedó expuesto. Pero el día que se
-- geocodifique una dirección de verdad, el que está del otro lado es un trabajador
-- independiente cuya casa suele ser también su taller. Se arregla antes de que exista ese
-- flujo, no después.
--
-- Entre bajar la promesa y subir el producto, se sube el producto: dos decimales son unos
-- 1,1 km, suficiente para ubicar a alguien en su barrio y para que el mapa siga sirviendo
-- para lo que sirve —"¿hay pintores cerca mío?"—, y no alcanza para llegar a una puerta.
--
-- El redondeo se hace en la FUNCIÓN y no en la columna a propósito: el dato exacto puede
-- hacer falta puertas adentro (calcular distancias, ordenar por cercanía) y eso corre del
-- lado del servidor. Lo que sale hacia afuera es la versión redondeada.

create or replace function public.pintores_geolocalizados()
returns table (id uuid, lat double precision, lng double precision)
language sql
stable
security definer
set search_path = public
as $$
  -- 2 decimales ≈ 1,1 km. Ver la nota de arriba antes de cambiar este número.
  select p.id, round(p.lat::numeric, 2)::double precision, round(p.lng::numeric, 2)::double precision
  from public.profiles p
  where p.type = 'painter'
    and p.lat is not null
    and p.lng is not null;
$$;

revoke execute on function public.pintores_geolocalizados() from public, anon;
grant execute on function public.pintores_geolocalizados() to anon, authenticated;

comment on function public.pintores_geolocalizados() is
  'Coordenadas de los pintores para el mapa, redondeadas a 2 decimales (~1,1 km) para que '
  'coincidan con lo que promete /privacidad: ubicación a nivel de zona, no la puerta de la casa.';

-- ── Preventivo: las coordenadas de los proyectos ──
-- `profiles.lat/lng` se sacó del grant por columna en 0013, porque exponía el domicilio de
-- los clientes. `projects` tiene las mismas dos columnas y nunca se tocaron: hoy ningún
-- formulario las escribe, pero si algún día /publicar pide la dirección exacta del trabajo,
-- saldrían públicas por la API sin que nadie lo note. Es el mismo error, en otra tabla.
--
-- OJO con el orden, que es la trampa que este proyecto ya pisó dos veces: un `revoke` por
-- columna NO hace nada mientras exista el grant a nivel TABLA. Hay que revocar la tabla
-- primero y después otorgar columna por columna. Y cada columna nueva que se agregue a
-- `projects` va a quedar fuera de esta lista: si una lectura empieza a fallar sin motivo
-- aparente, es acá.
revoke select on public.projects from anon, authenticated;
grant select (
  id, owner_id, type, title, slug, description, cover_url, images, location,
  budget_min, budget_max, published, created_at, updated_at, category, accent_color
) on public.projects to anon, authenticated;
