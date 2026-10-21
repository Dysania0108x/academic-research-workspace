# Floating Research Assistant (Chrome Extension MVP)

This Manifest V3 side-panel extension captures **selected text** from the active HTTP(S) page and saves an **unverified** source-linked record in Supabase `research_clips`. It does not call an AI model, scrape pages in the background, bypass paywalls, or mark evidence as verified.

## Setup (one-time)
1. Use the same Supabase project as the Web App. In Supabase Dashboard > SQL Editor, review and run `supabase/migrations/20261021_research_clips.sql`. This creates an RLS-protected inbox table. Run only once in the intended project.
2. Open desktop Chrome > Extensions > Manage Extensions > Developer mode > Load unpacked, and select the `extension` folder.
3. Click the extension toolbar button to open its side panel.
4. Enter your Supabase Project URL and **publishable/anon key** (never a service-role/secret key). Sign in using the same email/password account as the Web App.
5. Create a Project in the Web App if needed. On a research page, select text, click **Capture selection**, review the source and excerpt, then **Save to research inbox**.

## Current limitations
- This is a developer preview. The Web App does **not yet display or import** `research_clips`. Captures are visible in Supabase Table Editor until the inbox UI is implemented.
- Email/password sign-in only; OAuth, SSO, MFA, and organization-specific authentication flows are not implemented.
- Browser local extension storage holds session tokens and the publishable key. Use a dedicated test account and test excerpts; do not use sensitive research material until security review.
- Requires page text selection; Chrome protected pages, PDF viewer, and certain restricted tabs cannot be scripted.
- No Chrome Web Store account is needed for local testing. Publishing later requires Chrome Web Store registration.
- The extension requires a Chromium browser supporting `chrome.sidePanel`; iPhone Safari cannot run this Chrome extension.
- No automated browser test or real Supabase E2E test has been performed yet.
