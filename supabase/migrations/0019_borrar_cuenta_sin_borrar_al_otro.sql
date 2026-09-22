-- ═══════════════════════════════════════════════════════════════════════════
-- 0019 · Que alguien pueda borrar su cuenta sin borrar la historia de otro
-- ═══════════════════════════════════════════════════════════════════════════
-- La Ley 25.326 le da a cualquiera el derecho de pedir que se borren sus datos, y el sitio
-- va a tener un botón para hacerlo solo, sin depender de que alguien lea un correo a tiempo.
--
-- El problema: `profiles.id` referencia `auth.users(id) on delete cascade`, y de `profiles`
-- cuelgan en cascada `jobs.client_id` y `reviews.author_id`. Tal como estaba, un cliente que
-- se daba de baja **borraba también**:
--
--   · los trabajos que había contratado — que son el registro de trabajo del PINTOR, su
--     historial y la prueba de lo que acordó y cobró;
--   · las reseñas que había escrito — que son la reputación del pintor. Un cliente enojado
--     podía bajarle el promedio a un pintor borrándose la cuenta.
--
-- El derecho de una persona a borrar SUS datos no incluye borrar los de otra. Lo que
-- corresponde es que el trabajo y la reseña sobrevivan sin nombre: la fila queda, el dato
-- personal se va.
--
-- El disparador `enforce_job_rules` (0006) ya estaba preparado para esto: prohíbe reasignar
-- el cliente o el pintor de un trabajo, pero deja pasar el NULL justamente porque "es lo que
-- hace la FK al borrarse el padre".
--
-- Qué NO cambia, a propósito:
--   · `projects.owner_id` sigue en cascada: las obras y los pedidos son contenido propio.
--   · `reviews.target_id` sigue en cascada: las reseñas SOBRE un pintor que se va se van con
--     él. Dejar reseñas huérfanas de una persona que ya no está no le sirve a nadie.

-- ── Los trabajos sobreviven a la baja del cliente ──
alter table public.jobs alter column client_id drop not null;

alter table public.jobs drop constraint if exists jobs_client_id_fkey;
alter table public.jobs
  add constraint jobs_client_id_fkey
  foreign key (client_id) references public.profiles(id) on delete set null;

-- ── Las reseñas sobreviven a la baja de quien las escribió ──
alter table public.reviews alter column author_id drop not null;

alter table public.reviews drop constraint if exists reviews_author_id_fkey;
alter table public.reviews
  add constraint reviews_author_id_fkey
  foreign key (author_id) references public.profiles(id) on delete set null;

comment on column public.jobs.client_id is
  'NULL = el cliente dio de baja su cuenta. El trabajo queda como registro del pintor.';
comment on column public.reviews.author_id is
  'NULL = quien la escribió dio de baja su cuenta. La reseña y su puntaje quedan.';

-- ── El promedio no puede depender de quién sigue teniendo cuenta ──
-- `recalc_profile_rating` promedia las filas de `reviews`, y las que quedan sin autor siguen
-- ahí, así que el promedio no se mueve cuando alguien se da de baja. Se deja anotado porque
-- es justamente lo que se quería evitar.
comment on function public.recalc_profile_rating(uuid) is
  'Recalcula el promedio del pintor desde reviews. Las reseñas sin autor (cuentas dadas de '
  'baja) siguen contando: darse de baja no puede cambiarle la reputación a otro.';
