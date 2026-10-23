# NUScope Floating Assistant · Chrome Extension MVP

A **separate** Manifest V3 extension. No existing NUScope Web App files are changed.

## Install locally

1. Download or clone the repository.
2. Visit `chrome://extensions` in Chrome.
3. Enable **Developer mode**.
4. Click **Load unpacked** and select this `extension` directory.
5. Open an ordinary HTTPS webpage and refresh it. The N button appears in the lower-right corner.
6. Select a passage, click N, add an optional note, and choose **Save excerpt**.
7. Click the extension toolbar icon or **Full panel** to view, delete, or export captures.

Chrome prevents content scripts on some internal pages (chrome://), the Chrome Web Store, and certain protected pages.

## Scope and privacy

- Excerpts are saved **locally** using `chrome.storage.local`, capped at 500 records and 10,000 characters per excerpt.
- The extension does **not** send browsing content to an external server.
- No login, project sync, AI API, or Evidence Map write is implemented in this first prototype.
- The panel's **Open NUScope** action currently opens the project's GitHub repository, **not** an authenticated workspace. Replace with the confirmed production app URL when integration is ready.
- The extension injects a floating launcher on HTTP(S) pages and reads a selection only for capture. Avoid saving confidential text on shared computers.

## Next integration milestone

Confirm the production NUScope URL, implement secure extension authentication (no token scraping from Web App localStorage), then add authenticated project selection and a backend capture endpoint with ownership checks. Only after this should saved excerpts be synced into project evidence.

## Files

- `manifest.json`: MV3 permissions, service worker, and content script.
- `content.js`: isolated floating button and mini capture window.
- `background.js`: opens the Chrome side panel.
- `panel.html`, `panel.css`, `panel.js`: capture review and JSON export.


## Cloud excerpts integration (v0.2)

The packaged extension now supports NUScope Supabase email/password sign-in, authenticated project selection, theme display, explicit upload of local captures to the selected project, and listing of cloud excerpts. Project captures from other projects are excluded; older unassigned captures require confirmation before upload. Local copies remain on-device and can be exported as JSON.

Build from GitHub Actions **Package NUScope Chrome Extension** on the integration branch. Repository Actions variables `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` must be set to public client values. Never use the Supabase service-role key. The packaging script generates `extension/config.js` and pins host permissions to the configured Supabase origin. The checked-in config is intentionally empty.

Cloud excerpts require `public.saved_excerpts` with owner-only RLS and the `add_excerpt_evidence` RPC if the Evidence Map action is used. See `supabase/check_saved_excerpts.sql` and `docs/saved-excerpts-rollout.md`. SQL committed to GitHub does **not** apply itself to Supabase.

This focused integration intentionally does not include PDF import, PDF Reader or AI Highlight. Those remain in draft PR #66. The existing extension ID/storage must be preserved during updates to keep local captures.
