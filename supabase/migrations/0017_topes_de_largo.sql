-- ═══════════════════════════════════════════════════════════════════════════
-- 0017 · Topes de largo en los textos que se muestran en páginas públicas
-- ═══════════════════════════════════════════════════════════════════════════
-- Medido en el navegador: se publicó un pedido con un título de 10.000 caracteres
-- sin espacios y /trabajos —que es PÚBLICA— quedó de 254.443 px de ancho, con
-- scroll horizontal, para cualquiera que entrara. /panel quedó en 110.117 px.
-- Una sola fila rompe la pantalla de todos, no sólo la de quien la escribió.
--
-- La validación en la acción del servidor no alcanza como barrera: la clave anon
-- viaja en el navegador y cualquiera puede escribir en la tabla directamente por
-- la API de PostgREST, saltándose la acción. El tope tiene que estar acá.
--
-- Los números salen de para qué sirve cada campo, no de un límite técnico:
--   · título: un renglón y medio en un celular
--   · descripción: unos cuatro párrafos
--   · ubicación: "Villa Crespo, CABA" y variantes
--   · bio del perfil: media pantalla
-- Son holgados: el pedido más largo de la base hoy tiene 46 caracteres de título.

-- Nada de esto puede romper datos que ya existen, pero si algún día los hubiera,
-- `not valid` evitaría el error al crear la restricción. Se verifica primero que
-- no haya nada fuera de rango; si lo hubiera, la migración falla a propósito.
do $$
declare
  fuera int;
begin
  select count(*) into fuera from public.projects
  where length(title) > 120 or length(coalesce(description, '')) > 2000 or length(coalesce(location, '')) > 120;
  if fuera > 0 then
    raise exception 'Hay % filas en projects que superan los topes. Revisalas antes de aplicar 0017.', fuera;
  end if;
end $$;

alter table public.projects
  drop constraint if exists projects_title_largo,
  drop constraint if exists projects_description_largo,
  drop constraint if exists projects_location_largo;

alter table public.projects
  add constraint projects_title_largo check (length(title) between 3 and 120),
  add constraint projects_description_largo check (description is null or length(description) <= 2000),
  add constraint projects_location_largo check (location is null or length(location) <= 120);

-- Perfiles: la bio y la zona se muestran en /pintores y /pintor/[id], también públicas.
do $$
declare
  fuera int;
begin
  select count(*) into fuera from public.profiles
  where length(coalesce(bio, '')) > 1200 or length(coalesce(location, '')) > 120 or length(coalesce(full_name, '')) > 120;
  if fuera > 0 then
    raise exception 'Hay % filas en profiles que superan los topes. Revisalas antes de aplicar 0017.', fuera;
  end if;
end $$;

alter table public.profiles
  drop constraint if exists profiles_bio_largo,
  drop constraint if exists profiles_location_largo,
  drop constraint if exists profiles_full_name_largo;

alter table public.profiles
  add constraint profiles_bio_largo check (bio is null or length(bio) <= 1200),
  add constraint profiles_location_largo check (location is null or length(location) <= 120),
  add constraint profiles_full_name_largo check (full_name is null or length(full_name) <= 120);

-- Cotizaciones: la nota la lee el cliente en su panel.
do $$
declare
  fuera int;
begin
  select count(*) into fuera from public.jobs where length(coalesce(note, '')) > 1200;
  if fuera > 0 then
    raise exception 'Hay % filas en jobs con notas demasiado largas.', fuera;
  end if;
end $$;

alter table public.jobs drop constraint if exists jobs_note_largo;
alter table public.jobs add constraint jobs_note_largo check (note is null or length(note) <= 1200);

-- Reseñas: se muestran en el perfil público del pintor.
do $$
declare
  fuera int;
begin
  select count(*) into fuera from public.reviews where length(coalesce(comment, '')) > 1200;
  if fuera > 0 then
    raise exception 'Hay % reseñas con comentarios demasiado largos.', fuera;
  end if;
end $$;

alter table public.reviews drop constraint if exists reviews_comment_largo;
alter table public.reviews add constraint reviews_comment_largo check (comment is null or length(comment) <= 1200);

-- Consultas (leads): las lee el dueño en /admin, que también se rompe.
do $$
declare
  fuera int;
begin
  select count(*) into fuera from public.leads
  where length(coalesce(name, '')) > 120 or length(coalesce(email, '')) > 200
     or length(coalesce(phone, '')) > 40 or length(coalesce(message, '')) > 4000;
  if fuera > 0 then
    raise exception 'Hay % consultas que superan los topes.', fuera;
  end if;
end $$;

alter table public.leads
  drop constraint if exists leads_name_largo,
  drop constraint if exists leads_email_largo,
  drop constraint if exists leads_phone_largo,
  drop constraint if exists leads_message_largo;

alter table public.leads
  add constraint leads_name_largo check (name is null or length(name) <= 120),
  add constraint leads_email_largo check (email is null or length(email) <= 200),
  add constraint leads_phone_largo check (phone is null or length(phone) <= 40),
  add constraint leads_message_largo check (message is null or length(message) <= 4000);
