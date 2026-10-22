-- Run in the existing NUScope Supabase project before enabling cloud excerpts.
create table if not exists public.saved_excerpts (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  quote text not null,
  note text not null default '',
  source_title text not null default '',
  source_url text not null default '',
  captured_at timestamptz not null default now(),
  evidence_id uuid,
  constraint excerpt_quote_nonempty check (char_length(trim(quote)) > 0)
);
create index if not exists saved_excerpts_owner_project_idx on public.saved_excerpts(user_id,project_id,captured_at desc);
alter table public.saved_excerpts enable row level security;
create policy "Owners read own excerpts" on public.saved_excerpts for select to authenticated using (
  user_id=(select auth.uid()) and exists(select 1 from public.projects p where p.id=project_id and p.user_id=(select auth.uid()))
);
create policy "Owners insert own excerpts" on public.saved_excerpts for insert to authenticated with check (
  user_id=(select auth.uid()) and exists(select 1 from public.projects p where p.id=project_id and p.user_id=(select auth.uid()))
);
create policy "Owners update own excerpts" on public.saved_excerpts for update to authenticated using (
  user_id=(select auth.uid()) and exists(select 1 from public.projects p where p.id=project_id and p.user_id=(select auth.uid()))
) with check (
  user_id=(select auth.uid()) and exists(select 1 from public.projects p where p.id=project_id and p.user_id=(select auth.uid()))
);
create policy "Owners delete own excerpts" on public.saved_excerpts for delete to authenticated using (
  user_id=(select auth.uid()) and exists(select 1 from public.projects p where p.id=project_id and p.user_id=(select auth.uid()))
);
-- Atomic project evidence addition with row lock and ownership check.
create or replace function public.add_excerpt_evidence(p_excerpt_id uuid,p_theme text,p_interpretation text)
returns uuid language plpgsql security invoker set search_path=public as $$
declare v_excerpt public.saved_excerpts%rowtype; v_project public.projects%rowtype; v_id uuid; v_evidence jsonb;
begin
  select * into v_excerpt from public.saved_excerpts where id=p_excerpt_id and user_id=auth.uid() for update;
  if not found then raise exception 'Excerpt not found'; end if;
  select * into v_project from public.projects where id=v_excerpt.project_id and user_id=auth.uid() for update;
  if not found then raise exception 'Project not found'; end if;
  if not (coalesce(v_project.data->'topics','[]'::jsonb) ? p_theme) then raise exception 'Choose a current project theme'; end if;
  if v_excerpt.evidence_id is not null then return v_excerpt.evidence_id; end if;
  v_id:=gen_random_uuid();
  v_evidence:=jsonb_build_object('id',v_id,'sourceType','web','sourceExcerptId',v_excerpt.id,
    'sourceTitle',v_excerpt.source_title,'sourceUrl',v_excerpt.source_url,
    'quote',v_excerpt.quote,'text',v_excerpt.quote,'analysis',coalesce(p_interpretation,''),
    'theme',p_theme,'status','unverified','verificationStatus','unverified',
    'relationship','Unclassified','createdAt',now());
  update public.projects set data=jsonb_set(coalesce(data,'{}'::jsonb),'{evidence}',
    coalesce(data->'evidence','[]'::jsonb)||jsonb_build_array(v_evidence)),updated_at=now() where id=v_project.id;
  update public.saved_excerpts set evidence_id=v_id where id=v_excerpt.id;
  return v_id;
end $$;
grant execute on function public.add_excerpt_evidence(uuid,text,text) to authenticated;
