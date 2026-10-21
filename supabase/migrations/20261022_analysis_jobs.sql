-- Apply in the same Supabase project used by Render SUPABASE_URL.
-- Durable, owner-scoped AI analysis job snapshots.
create table if not exists public.analysis_jobs (
  id text primary key,
  owner_id uuid not null references auth.users(id) on delete cascade,
  paper_id text not null,
  cache_key text not null,
  snapshot jsonb not null,
  updated_at timestamptz not null default now()
);
create index if not exists analysis_jobs_owner_cache_updated_idx
  on public.analysis_jobs(owner_id,cache_key,updated_at desc);
create index if not exists analysis_jobs_owner_paper_idx
  on public.analysis_jobs(owner_id,paper_id);
create or replace function public.touch_analysis_jobs_updated_at()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_at = now();
  return new;
end; $$;
drop trigger if exists trg_analysis_jobs_updated_at on public.analysis_jobs;
create trigger trg_analysis_jobs_updated_at before update on public.analysis_jobs
for each row execute function public.touch_analysis_jobs_updated_at();
alter table public.analysis_jobs enable row level security;
drop policy if exists analysis_jobs_owner_read on public.analysis_jobs;
create policy analysis_jobs_owner_read on public.analysis_jobs
  for select to authenticated using (owner_id = (select auth.uid()));
revoke all on public.analysis_jobs from anon;
grant select on public.analysis_jobs to authenticated;
-- Backend writes use a server-only Supabase secret API key.
notify pgrst, 'reload schema';
