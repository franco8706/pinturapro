-- 0014: el pintor pierde el título de su trabajo, y hay pedidos terminados en el tablero.
--
-- Los dos salieron del recorrido de QA y tienen la misma raíz: `projects.published` es a la
-- vez el estado del pedido Y la llave de lectura, así que cerrar un pedido también se lo
-- esconde a quien lo está trabajando.

-- ── 1. El pintor tiene que poder leer el pedido que está haciendo ─────
-- `projects_select_pub_or_own` deja ver un proyecto sólo si está publicado o si sos el dueño.
-- Cuando el cliente acepta una cotización, el trigger `on_job_accepted` (0009) pone
-- `published = false` para sacarlo del tablero — y en ese mismo momento el pintor deja de
-- poder leerlo. Efecto: en su panel los trabajos aparecían todos como "Trabajo", sin título,
-- imposibles de distinguir entre sí justo cuando ya los había ganado.
drop policy if exists "projects_select_pub_or_own" on public.projects;
drop policy if exists "projects_select_pub_own_o_adjudicado" on public.projects;
create policy "projects_select_pub_own_o_adjudicado" on public.projects
  for select using (
    published
    or owner_id = auth.uid()
    -- El pintor con un trabajo sobre este pedido lo sigue viendo, aunque ya no esté publicado.
    or exists (
      select 1 from public.jobs j
      where j.project_id = projects.id
        and j.painter_id = auth.uid()
    )
  );

-- ── 2. Un pedido ya adjudicado no vuelve al tablero ───────────────────
-- `getOpenServiceRequests` confía sólo en `published`, así que cualquier desincronización de
-- esa columna republica un trabajo terminado. Pasó de verdad: el seed INSERTA los jobs ya en
-- estado 'completed', y como `on_job_accepted` es un trigger AFTER UPDATE, nunca se disparó
-- para ellos. Resultado: pedidos terminados ofreciéndose para cotizar.
--
-- Se reconcilia el dato existente...
update public.projects pr
set published = false
where pr.type = 'service'
  and pr.published
  and exists (
    select 1 from public.jobs j
    where j.project_id = pr.id
      and j.status in ('accepted', 'in_progress', 'completed')
  );

-- ...y se agrega la red de contención, para que la coherencia no dependa de que el trigger
-- haya corrido: el tablero se arma con esta función, que mira el estado real de los trabajos.
create or replace function public.pedidos_abiertos(limite int default 50)
returns table (
  id uuid,
  title text,
  description text,
  location text,
  budget_min int,
  budget_max int,
  owner_id uuid,
  created_at timestamptz
)
language sql
stable
security invoker  -- respeta la RLS de arriba a propósito: no hay nada que elevar acá
set search_path = public
as $$
  select pr.id, pr.title, pr.description, pr.location, pr.budget_min, pr.budget_max,
         pr.owner_id, pr.created_at
  from public.projects pr
  where pr.type = 'service'
    and pr.published
    -- La condición que faltaba: aunque `published` quedara mal, un pedido con un trabajo ya
    -- adjudicado no se ofrece de nuevo.
    and not exists (
      select 1 from public.jobs j
      where j.project_id = pr.id
        and j.status in ('accepted', 'in_progress', 'completed')
    )
  order by pr.created_at desc
  limit greatest(1, least(coalesce(limite, 50), 100));
$$;

-- Se le da también a `anon` a propósito: /trabajos es una página PÚBLICA — es como un
-- pintor descubre la plataforma antes de registrarse. La función es `security invoker`, así
-- que sigue respetando la RLS: un anónimo ve exactamente los pedidos publicados que ya podía
-- ver con el select directo, ni uno más.
revoke execute on function public.pedidos_abiertos(int) from public;
grant execute on function public.pedidos_abiertos(int) to anon, authenticated;

comment on function public.pedidos_abiertos(int) is
  'El tablero de /trabajos. Filtra por estado real de los jobs, no sólo por projects.published, '
  'que puede quedar desincronizado (el seed inserta jobs completados sin disparar el trigger).';
