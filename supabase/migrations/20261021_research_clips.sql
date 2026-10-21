-- Independent inbox prevents concurrent Project JSON updates from losing captures.
create table if not exists public.research_clips (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  title text not null,
  source_url text not null,
  excerpt text not null,
  note text not null default '',
  status text not null default 'unverified' check (status in ('unverified','verified','rejected')),
  created_at timestamptz not null default now(),
  constraint clip_title_limit check (char_length(title) <= 500),
  constraint clip_url_limit check (char_length(source_url) <= 2048),
  constraint clip_excerpt_limit check (char_length(excerpt) between 1 and 10000),
  constraint clip_note_limit check (char_length(note) <= 3000)
);
alter table public.research_clips enable row level security;
create index if not exists research_clips_owner_project_idx on public.research_clips(user_id,project_id,created_at desc);
drop policy if exists research_clips_select on public.research_clips;
create policy research_clips_select on public.research_clips for select to authenticated using (
  user_id = (select auth.uid()) and exists(select 1 from public.projects p where p.id=project_id and p.user_id=(select auth.uid()))
);
drop policy if exists research_clips_insert on public.research_clips;
create policy research_clips_insert on public.research_clips for insert to authenticated with check (
  user_id = (select auth.uid()) and exists(select 1 from public.projects p where p.id=project_id and p.user_id=(select auth.uid()))
);
drop policy if exists research_clips_update on public.research_clips;
create policy research_clips_update on public.research_clips for update to authenticated using (
  user_id = (select auth.uid()) and exists(select 1 from public.projects p where p.id=project_id and p.user_id=(select auth.uid()))
) with check (user_id = (select auth.uid()) and exists(select 1 from public.projects p where p.id=project_id and p.user_id=(select auth.uid())));
drop policy if exists research_clips_delete on public.research_clips;
create policy research_clips_delete on public.research_clips for delete to authenticated using (
  user_id = (select auth.uid()) and exists(select 1 from public.projects p where p.id=project_id and p.user_id=(select auth.uid()))
);
