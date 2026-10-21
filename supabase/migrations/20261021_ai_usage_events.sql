-- Run once in Supabase SQL Editor before enabling durable usage reporting.
create table if not exists public.ai_usage_events (
  id uuid primary key,
  owner_id uuid not null references auth.users(id) on delete cascade,
  paper_id text,
  task_type text not null,
  model text not null,
  input_tokens integer not null default 0,
  output_tokens integer not null default 0,
  total_tokens integer not null default 0,
  status text not null check (status in ('success','error')),
  created_at timestamptz not null default now()
);
create index if not exists ai_usage_events_owner_paper_idx
  on public.ai_usage_events(owner_id,paper_id,created_at desc);
alter table public.ai_usage_events enable row level security;
-- Only the service-role backend can write usage events; owners may read their own.
drop policy if exists ai_usage_events_owner_select on public.ai_usage_events;
create policy ai_usage_events_owner_select on public.ai_usage_events
  for select to authenticated using (owner_id = (select auth.uid()));
revoke all on public.ai_usage_events from anon;
grant select on public.ai_usage_events to authenticated;
