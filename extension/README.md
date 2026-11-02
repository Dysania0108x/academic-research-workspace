# NUScope Floating Assistant

Chrome Manifest V3 companion to [NUScope](https://academic-research-workspace.vercel.app). Capture source-linked webpage excerpts while researching and explicitly sync them to a chosen NUScope project.

> **Current shipped source on `main`: v0.2.0.** The full PDF Import / AI Highlight / PDF Reader integration is in open PR [#96](https://github.com/Dysania0108x/academic-research-workspace/pull/96), with follow-up fixes in [#97](https://github.com/Dysania0108x/academic-research-workspace/pull/97). Those experimental features are **not yet included** when packaging `main`.

## What works on `main`

- Supabase email/password sign-in and session refresh
- Choose an authenticated NUScope project and display its research question/themes
- Select text on a webpage and save it locally through the floating N button
- Review, delete and export local excerpts as JSON
- **Explicitly** sync local excerpts to the selected cloud project
- Read project excerpts from Supabase; promote a saved excerpt to Evidence Map via an owner-scoped RPC
- Use `Uncategorised` when no research theme has been selected; evidence remains subject to human review

Local captures are not automatically deleted when synced. Existing unassigned captures require care when assigning them to a project; check the selected project before syncing. A browser extension may not run on Chrome internal pages or protected browser surfaces.

## Install a test build

1. Open [Package NUScope Chrome Extension](https://github.com/Dysania0108x/academic-research-workspace/actions/workflows/package-extension.yml).
2. Run the workflow on **`main`** for the stable capture/sync build. Wait for a green Success.
3. Download the `nuscope-extension` artifact and unzip the downloaded archives as needed.
4. Open `chrome://extensions`, enable **Developer mode**, choose **Load unpacked**, and select the directory containing `manifest.json`.
5. Open an ordinary HTTPS article, refresh the page, and click the floating N button or Chrome extension toolbar icon.
6. Sign in, select a project, save a selected passage and use **Sync local excerpts to project**. Verify it in the web workspace.

Back up local excerpts using **Export JSON** before replacing or reinstalling the extension. Loading a different unpacked directory may create a different extension ID and therefore a different local storage area.

### Packaging configuration

GitHub Actions uses the following **public** repository variables:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`

The packaging script generates `extension/config.js` and restricts host permissions to the configured Supabase origin. The source-tree `config.js` is intentionally empty; simply loading an unconfigured checkout will not provide working cloud login.

Never package Supabase service-role credentials or AI-provider secrets.

## Experimental PDF workflow (PR #96 / #97)

The open integration branch adds:

- **Detect / import current PDF:** intended for direct, public HTTPS PDF resources; not a general authenticated proxy downloader.
- **AI Highlight PDF:** uses the shared FastAPI/Render analysis API and current project's themes.
- **PDF Reader:** uses PDF.js to display source-linked highlights and locate quotes.
- **Review:** AI matches are candidates; they require human verification before becoming evidence.

To try the experimental build, select `integration/full-extension-pdf-workflow` in the packaging workflow (after the relevant fixes have been merged into that branch). The experimental workflow also requires public variable `VITE_API_BASE_URL`, typically pointing to the existing HTTPS Render API, and bundles PDF.js into `extension/vendor/`.

**Known PDF limitations:** Chrome's built-in PDF Viewer can obscure the original tab URL; some `/doi/pdf/...` endpoints are not conventional `.pdf` links; NUS Library Proxy resources may require authenticated browser access and may not be importable automatically. For those papers, use an authorised download and upload via the Web App. Do not bypass access controls. PR #97 aims to synchronize theme visibility with an already open Reader and replace opaque Invalid URL errors with clear guidance; verify behavior in Chrome before claiming it is fixed.

## Database prerequisites

The cloud feature requires `public.saved_excerpts` with owner-only RLS and the `add_excerpt_evidence` RPC. Review [the rollout guide](../docs/saved-excerpts-rollout.md) and `supabase/migrations/20261023_optional_excerpt_theme.sql`. SQL merged into GitHub does **not** update the Supabase database automatically.

## Testing checklist

1. Sign in and switch projects; confirm data from another account or project is not exposed.
2. Capture text, edit its note, export JSON, and explicitly sync to the chosen project.
3. Refresh the cloud excerpt list; confirm source URL, title, quote and note are intact.
4. Promote one excerpt with no theme, then with a selected theme; verify the result in the Web App and ensure duplicates are prevented.
5. For the experimental PDF build, test public PDF detection/import, Reader opening, AI analysis, theme filtering, cancel/retry and source quote positioning.
6. Confirm the packaged ZIP includes the Reader scripts and PDF.js vendor files before distribution.

The extension is a prototype and is not yet a Chrome Web Store release. Do not use confidential browsing material without verifying access, retention and sharing policies.
