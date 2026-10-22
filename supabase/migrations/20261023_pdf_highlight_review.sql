-- Atomic PDF candidate review, scoped to the authenticated project owner.
-- Apply after backup in the NUScope Supabase SQL editor.
create or replace function public.review_pdf_highlight(
  p_project_id uuid, p_paper_id text, p_page integer, p_quote text,
  p_theme text, p_action text, p_interpretation text default ''
) returns jsonb language plpgsql security invoker set search_path=public as $$
declare
  p public.projects%rowtype;
  k text;
  items jsonb;
  rejects jsonb;
  record_id text;
begin
  if p_action not in ('reject','restore','save') then
    raise exception 'Invalid action';
  end if;
  if p_page is null or p_page < 1 or p_page > 100000
    or p_quote is null or length(trim(p_quote)) < 8 or length(p_quote) > 2000 then
    raise exception 'Invalid source quotation';
  end if;
  select * into p from public.projects
    where id=p_project_id and user_id=auth.uid() for update;
  if not found then raise exception 'Project not found'; end if;
  if not exists (
    select 1 from jsonb_array_elements(coalesce(p.data->'papers','[]'::jsonb)) x
    where x->>'id'=p_paper_id
  ) then raise exception 'PDF does not belong to project'; end if;
  if p_theme is null or not (coalesce(p.data->'topics','[]'::jsonb) ? p_theme) then
    raise exception 'Theme not found';
  end if;

  k:=lower(p_paper_id||'|'||p_page::text||'|'||
    regexp_replace(trim(p_quote),'\s+',' ','g'));
  rejects:=coalesce(p.data->'rejected','[]'::jsonb);
  items:=coalesce(p.data->'evidence','[]'::jsonb);

  if p_action='reject' then
    if not (rejects ? k) then rejects:=rejects||to_jsonb(k); end if;
  else
    select coalesce(jsonb_agg(x),'[]'::jsonb) into rejects
      from jsonb_array_elements(rejects) x where x #>> '{}' <> k;
    if p_action='save' then
      select x->>'id' into record_id from jsonb_array_elements(items) x
        where x->>'paperId'=p_paper_id
          and x->>'page'=p_page::text
          and lower(regexp_replace(trim(coalesce(x->>'quote',x->>'text','')),
            '\s+',' ','g'))=lower(regexp_replace(trim(p_quote),'\s+',' ','g'))
        limit 1;
      if record_id is null then
        record_id:=gen_random_uuid()::text;
        items:=items||jsonb_build_array(jsonb_build_object(
          'id',record_id,'paperId',p_paper_id,'page',p_page,
          'quote',trim(p_quote),'text',trim(p_quote),
          'theme',p_theme,'themes',jsonb_build_array(p_theme),
          'analysis',coalesce(p_interpretation,''),
          'relationship','Unclassified','verified',true,'verifiedAt',now()
        ));
      end if;
    end if;
  end if;

  update public.projects
    set data=jsonb_set(
      jsonb_set(coalesce(p.data,'{}'::jsonb),'{evidence}',items),
      '{rejected}',rejects),
      updated_at=now()
    where id=p_project_id and user_id=auth.uid();
  return jsonb_build_object(
    'action',p_action,'evidence_id',record_id,'highlight_key',k
  );
end $$;

revoke all on function public.review_pdf_highlight(uuid,text,integer,text,text,text,text) from public;
grant execute on function public.review_pdf_highlight(uuid,text,integer,text,text,text,text) to authenticated;
