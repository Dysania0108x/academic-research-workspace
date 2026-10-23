# Vercel production deployment fallback

This workflow triggers a Vercel Deploy Hook after **Validate app** succeeds on `main`. It does not upload source code or use a Vercel access token.

## One-time setup

1. In Vercel, open the **academic-research-workspace** project and find **Settings > Git > Deploy Hooks** (location may vary). Create a hook named `GitHub Actions fallback` targeting branch `main`.
2. Copy the full hook URL. Treat it as a secret: anyone with the URL can trigger a deployment.
3. In GitHub repository **Settings > Secrets and variables > Actions > New repository secret**, create `VERCEL_DEPLOY_HOOK_URL` and paste the hook URL.
4. In GitHub Actions run **Deploy NUScope to Vercel (fallback)** using **Run workflow** once. Verify a new Production deployment is **Ready** and uses the expected `main` commit.
5. If Vercel's native Git auto-deploy resumes working, disable either the native integration's auto-deploy or this fallback workflow to avoid duplicate builds.

The workflow requires the successful `Validate app` run on `main`, and it can also be started manually. A successful deploy-hook request means Vercel accepted the trigger, **not** that the resulting build finished successfully. Check Vercel Deployments for its final status.

Do not commit the hook URL, Vercel tokens, or Supabase secrets to this repository.
