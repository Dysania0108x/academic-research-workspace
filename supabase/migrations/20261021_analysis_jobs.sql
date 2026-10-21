-- Execute in the existing Supabase project's SQL Editor.
create table if not exists public.analysis_jobs (
  id uuid primary key,
  owner_id uuid not null references auth.users(id) on delete cascade,
  paper_id uuid not null,
  cache_key text not null,
  snapshot jsonb not null,
  updated_at timestamptz not null default now()
);
create index if not exists analysis_jobs_owner_context_idx
  on public.analysis_jobs(owner_id,cache_key,updated_at desc);
alter table public.analysis_jobs enable row level security;
-- Backend uses a server-only service role; authenticated browser users cannot write jobs.
drop policy if exists analysis_jobs_owner_read on public.analysis_jobs;
create policy analysis_jobs_owner_read on public.analysis_jobs
for select to authenticated using (owner_id = (select auth.uid()));
create or replace function public.touch_analysis_job_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at=now(); return new; end $$;
drop trigger if exists touch_analysis_job on public.analysis_jobs;
create trigger touch_analysis_job before update on public.analysis_jobs
for each row execute function public.touch_analysis_job_updated_at();
