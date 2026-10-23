-- Apply only after verifying the existing saved_excerpts table and RPC are installed.
-- Safe to replace the function without recreating RLS policies.
create or replace function public.add_excerpt_evidence(p_excerpt_id uuid,p_theme text,p_interpretation text)
returns uuid language plpgsql security invoker set search_path=public as $$
declare v_excerpt public.saved_excerpts%rowtype; v_project public.projects%rowtype; v_id uuid; v_evidence jsonb;
begin
  select * into v_excerpt from public.saved_excerpts where id=p_excerpt_id and user_id=auth.uid() for update;
  if not found then raise exception 'Excerpt not found'; end if;
  select * into v_project from public.projects where id=v_excerpt.project_id and user_id=auth.uid() for update;
  if not found then raise exception 'Project not found'; end if;
  if coalesce(nullif(trim(p_theme),''),'Uncategorised') <> 'Uncategorised'
     and not (coalesce(v_project.data->'topics','[]'::jsonb) ? p_theme) then
    raise exception 'Choose a current project theme';
  end if;
  if v_excerpt.evidence_id is not null then return v_excerpt.evidence_id; end if;
  if exists(select 1 from jsonb_array_elements(coalesce(v_project.data->'evidence','[]'::jsonb)) e where e->>'savedExcerptId'=v_excerpt.id::text) then
    raise exception 'Excerpt already added to Evidence Map';
  end if;
  v_id:=gen_random_uuid();
  v_evidence:=jsonb_build_object('id',v_id,'sourceType','web','savedExcerptId',v_excerpt.id,
    'sourceTitle',v_excerpt.source_title,'sourceUrl',v_excerpt.source_url,
    'quote',v_excerpt.quote,'text',v_excerpt.quote,'analysis',coalesce(p_interpretation,''),
    'theme',coalesce(nullif(trim(p_theme),''),'Uncategorised'),
    'themes',jsonb_build_array(coalesce(nullif(trim(p_theme),''),'Uncategorised')),'verified',false,'status','unverified','verificationStatus','unverified',
    'relationship','Unclassified','createdAt',now());
  update public.projects set data=jsonb_set(coalesce(data,'{}'::jsonb),'{evidence}',
    coalesce(data->'evidence','[]'::jsonb)||jsonb_build_array(v_evidence)),updated_at=now() where id=v_project.id;
  update public.saved_excerpts set evidence_id=v_id where id=v_excerpt.id;
  return v_id;
end $$;
revoke all on function public.add_excerpt_evidence(uuid,text,text) from public;
grant execute on function public.add_excerpt_evidence(uuid,text,text) to authenticated;
