-- Read-only preflight. Run in Supabase SQL Editor before applying the migration.
select to_regclass('public.saved_excerpts') as saved_excerpts_table;
select n.nspname as schema_name,p.proname as function_name,
 pg_get_function_identity_arguments(p.oid) as arguments
from pg_proc p join pg_namespace n on n.oid=p.pronamespace
where n.nspname='public' and p.proname='add_excerpt_evidence';
select tablename,policyname,cmd,roles,qual,with_check
from pg_policies where schemaname='public' and tablename='saved_excerpts'
order by policyname;
select c.relname as table_name,c.relrowsecurity as rls_enabled
from pg_class c join pg_namespace n on n.oid=c.relnamespace
where n.nspname='public' and c.relname='saved_excerpts';
