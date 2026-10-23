# Saved Excerpts database rollout

1. Back up the existing `public.projects` and `public.saved_excerpts` data.
2. Run `supabase/check_saved_excerpts.sql` in the Supabase SQL Editor. This file only reads schema metadata.
3. If `saved_excerpts` is absent, review and apply `supabase/migrations/20261023_saved_excerpts.sql`.
4. If the table already exists, **do not blindly rerun** the migration: the original `create policy` statements will fail if the policies already exist. Compare columns, policies, and RPC definition first, then write a targeted reconciliation migration.
5. Confirm owner-only RLS by signing in as two different test accounts. Account B must not read or promote Account A's excerpts.
6. Test in the Web App: select a Project > Evidence Workspace > Add Evidence > From Saved Excerpts. Confirm source title, URL, quote, note, and unverified state.
7. Test promoting the same excerpt twice. It must not create duplicate Evidence records.

**Important:** Committing this SQL file does not execute it. No service-role key is required in the Web App or Chrome Extension. Do not expose database credentials in GitHub commits or browser code.
