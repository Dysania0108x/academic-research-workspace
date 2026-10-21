# V6.4 Deployment: Vercel + Render (preview only)

## Important limitation
The backend still uses local SQLite and `backend/uploads` for job snapshots, analysis caches and restored PDFs. On Render Free, the filesystem is ephemeral. Restarts/redeployments can lose those files and job state; cloud PDFs can be restored from private Supabase Storage only when the corresponding project metadata exists. This is **not production-ready durable job processing**. Never use real sensitive research data for this preview.

## Render API
1. Connect GitHub repository and select branch `feature/v6-4-cloud-deployment` (or the eventual release branch).
2. Deploy with `render.yaml` as a Blueprint, if your account supports the Free service plan.
3. Set `SUPABASE_URL` and `SUPABASE_PUBLISHABLE_KEY` from the same Supabase project as the Web App. These are public configuration values, **not** service-role keys.
4. Set `FRONTEND_ORIGINS` to the exact Vercel HTTPS origin (e.g. `https://my-workspace.vercel.app`), without a trailing slash. Add comma-separated additional trusted preview origins only if needed.
5. Set `DASHSCOPE_API_KEY` as a secret for real AI requests. For non-AI smoke tests, leave it unset; do not expose it to Vite or the browser.
6. Check `https://<your-render-service>.onrender.com/api/health`. A cold start may take time.

## Vercel frontend
1. Import the same GitHub repository, select the same deployment branch, framework Vite.
2. Configure **build-time** environment variables:
   - `VITE_SUPABASE_URL` — same Supabase project URL.
   - `VITE_SUPABASE_PUBLISHABLE_KEY` — Supabase publishable key (never a secret/service-role key).
   - `VITE_API_BASE_URL` — Render API origin, e.g. `https://my-api.onrender.com` (no `/api` suffix).
3. Deploy and confirm Vercel's HTTPS URL is included in Render's `FRONTEND_ORIGINS`. Changing Vite environment variables requires rebuilding the frontend.
4. Supabase Auth > URL Configuration: allow the deployed Vercel origin and any required redirect URLs for your configured sign-in flow.

## Acceptance checks
- Login as test account A, create project, upload a synthetic PDF, refresh, open PDF and analyse.
- Login as account B and confirm A's project/PDF is inaccessible; verify protected API returns 401 without a token.
- Restart Render and test that private PDF can be re-downloaded; expect in-flight AI jobs to be interrupted and local SQLite job history to be unreliable on Free.
- Test CORS from the actual Vercel origin, not only localhost.

## Future work before general release
- Move job state and cache metadata to a durable Supabase-backed owner-scoped store or managed worker.
- Revisit the global local-file cache, job queue and background execution model for multi-instance hosting.
- Add hosted E2E tests and review all authenticated API routes, RLS policies, retention and rate limits.
- Extension V7 uses the same Supabase project; it is not automatically deployed by Vercel.
