-- 0004_marketplace.sql
-- Marketplace: el cliente publica un pedido de trabajo (projects type='service')
-- y los pintores envían cotizaciones (jobs status='quoted').

-- Mensaje de la cotización del pintor.
alter table public.jobs add column if not exists note text;

-- El pintor puede crear una cotización para sí mismo, en estado 'quoted', sobre un
-- pedido de servicio real cuyo dueño sea el client_id que declara. (Las policies INSERT
-- permissive se combinan con OR, así que esto convive con jobs_insert_client.)
drop policy if exists "jobs_insert_painter_quote" on public.jobs;
create policy "jobs_insert_painter_quote" on public.jobs
  for insert with check (
    painter_id = auth.uid()
    and status = 'quoted'
    and project_id is not null
    and exists (
      select 1 from public.projects p
      where p.id = project_id and p.type = 'service' and p.owner_id = client_id
    )
  );

create index if not exists idx_jobs_painter on public.jobs (painter_id);
create index if not exists idx_jobs_client  on public.jobs (client_id);
create index if not exists idx_projects_service on public.projects (type) where type = 'service' and published;
