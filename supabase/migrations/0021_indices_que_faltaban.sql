-- ═══════════════════════════════════════════════════════════════════════════
-- 0021 · Los dos índices que faltaban
-- ═══════════════════════════════════════════════════════════════════════════
-- Los encontró el agente `integridad-datos` en su primera ronda (27/9/2026), cruzando cada
-- filtro de `apps/web/lib/queries.ts` y de las funciones de la base con los `create index`
-- de las migraciones. Cuatro de seis estaban cubiertos; estos dos no.
--
-- Con 3 pintores y 26 trabajos no se nota nada. Se agrega ahora porque con miles de filas
-- se nota en el peor lugar posible: el momento de aceptar un trabajo.

-- ── jobs.project_id ──
-- Sin índice, y lo usan TRES funciones que corren en CADA cambio de estado de un trabajo:
-- `on_job_accepted` y `on_job_cancelled` (0009) y `una_sola_adjudicacion`, todas con
-- `where project_id = …`. Cada aceptar, cancelar o completar recorría la tabla `jobs` entera.
-- También lo usa `getPedidosDelCliente()` con `.in("project_id", …)`.
create index if not exists idx_jobs_project on public.jobs (project_id);

-- ── profiles.type ──
-- `/pintores` (página pública, la más visitada del directorio) hace
-- `.eq("type", "painter").order("rating", { ascending: false })`. Un índice parcial sobre
-- los pintores, ordenado por calificación, cubre el filtro y el orden de una vez.
create index if not exists idx_profiles_pintores_por_rating
  on public.profiles (rating desc)
  where type = 'painter';
