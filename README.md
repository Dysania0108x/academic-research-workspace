# NUScope

**Make sense of more.**

NUScope is an AI-assisted academic research workspace for collecting papers, reviewing source-grounded highlights, organising evidence around a research question, and connecting findings. It combines a **React web app**, a **FastAPI analysis backend**, **Supabase authentication/storage**, and a companion **Chrome Floating Assistant**.

> **Project status (2 November 2026):** Working research prototype / MVP, not a production-validated research service. This README describes the merged `main` branch. Experimental PDF Import, AI Highlight, and PDF Reader features for the Chrome extension are still in open PRs [#96](https://github.com/Dysania0108x/academic-research-workspace/pull/96) and [#97](https://github.com/Dysania0108x/academic-research-workspace/pull/97); they are **not** part of the packaged `main` extension.

## Try the web app

**Web:** https://academic-research-workspace.vercel.app

Create an account or sign in with an existing one. `Start exploring` leads to Sign in; use Sign up only to create an account. Create a project, enter a research question and themes, upload a text-based PDF, and review the resulting AI suggestions. **AI-generated highlights are candidates, not verified evidence.** Verify quotations against the original PDF before promoting them.

The deployed interface can lag behind GitHub `main`; a successful GitHub merge does not itself confirm that Vercel Production deployed that commit.

## Features

| Area | Current scope on `main` |
| --- | --- |
| Accounts and projects | Supabase email/password auth, project-specific research questions and themes, cloud-backed project records |
| Paper Library | Upload/manage private PDFs, embedded reader, AI Highlight workflow and review controls |
| Evidence Workspace | Manually add evidence, review/edit interpretations, organise by theme/paper, relate findings to the research question |
| Evidence Network | Reviewed connections, interactive graph, zoom and Fit to view; graph layout and usability still need browser QA |
| Saved Excerpts | Capture webpage text through the Chrome extension, explicitly sync to a selected project, review in the web workspace and promote to evidence |
| Floating Assistant (v0.2) | Account sign-in, project picker, themes, local excerpt capture/JSON export, cloud excerpts and Evidence Map promotion |
| Academic Writing | Placeholder / future feature, not a finished writing assistant |

Evidence can be **Uncategorised** (no research theme assigned) and **Unclassified** (relationship to the research question not yet assessed). These are different concepts. Saved excerpts require deliberate promotion and should not be presented as automatically verified.

### Chrome extension

The **current `main` package is v0.2**, focused on capture and sync. For install, packaging, limitations and planned PDF support, see [extension/README.md](extension/README.md).

To build a distributable ZIP, run the [Package NUScope Chrome Extension](https://github.com/Dysania0108x/academic-research-workspace/actions/workflows/package-extension.yml) workflow against `main`, then download its `nuscope-extension` artifact. The artifact is a developer-mode, unpacked extension package, not a Chrome Web Store release.

**PDF integration is in progress:** PR #96 restores PDF detection/import, AI analysis and a PDF.js Reader; PR #97 addresses theme-filter synchronization and clearer failures for Chrome PDF Viewer / university proxy URLs. Neither PR should be described as shipped in `main` until merged, packaged and tested in Chrome. NUS library proxy PDFs may require authorised download and manual upload through the web app; do not assume a protected PDF URL can be imported directly.

## Architecture

```text
Web App (React / Vite)  ────┐
                           ├── Supabase Auth / Projects / private PDF Storage
Chrome Extension (MV3) ────┘
           |
Web App analysis requests ───── FastAPI on Render ─── Bailian / DeepSeek model
```

- **Frontend:** React, Vite, PDF reading/highlight UI
- **Backend:** Python FastAPI, PDF extraction and source-quote matching, AI analysis jobs
- **Cloud:** Supabase Auth, Postgres with row-level security, private PDF Storage
- **Hosting:** Vercel (frontend), Render (backend)
- **Extension:** Chrome Manifest V3, Side Panel, explicit cloud sync

A verified source quotation is not the same as a verified scientific claim. Users remain responsible for assessing research quality and interpretation.

## Local development

Requirements: Node.js 22+, Python 3.12+ and access to the project's Supabase instance and configured AI backend.

```bash
npm ci
cp .env.example .env.local
npm run dev
```

If `.env.example` is unavailable in your checkout, create `.env.local` manually with the following **public frontend** settings:

```dotenv
VITE_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=YOUR_PUBLIC_PUBLISHABLE_KEY
VITE_API_BASE_URL=http://127.0.0.1:8000
```

Start the backend in another terminal:

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
python -m uvicorn main:app --reload --port 8000
```

Configure `backend/.env` with the appropriate provider credentials; the checked-in example uses `AI_PROVIDER=bailian`, `BAILIAN_MODEL=deepseek-v4.1-flash` and `DASHSCOPE_API_KEY`. **Never** place provider secrets or a Supabase service-role key in `VITE_*` variables or the extension package. For offline UI development, `AI_MOCK_MODE=true` enables simulated responses, which must not be treated as real research findings.

Build and validate:

```bash
npm run build
node --test tests/pdfGeometry.test.js tests/evidenceConflict.test.js tests/extensionSyncRules.test.js
```

Backend tests run via `python -m unittest discover -s backend/tests -v` after installing its requirements. GitHub Actions runs frontend and backend validation; automated checks do not replace real browser, cloud permissions, or AI-provider testing.

## Saved Excerpts database setup

The cloud workflow depends on `public.saved_excerpts`, owner-scoped RLS, and the `add_excerpt_evidence` RPC. See [docs/saved-excerpts-rollout.md](docs/saved-excerpts-rollout.md) for a safe preflight, backup and multi-account test procedure. The optional-theme RPC update is in `supabase/migrations/20261023_optional_excerpt_theme.sql`.

**Committing SQL does not execute it in Supabase.** Apply and verify migrations separately. Confirm that a second test account cannot read or promote another user's excerpts, and that repeated promotion does not duplicate evidence.

## Deployment and configuration

- **Web:** Vercel deploys the frontend from GitHub. Confirm the Production deployment SHA and `Ready` status; do not assume a merge has reached production.
- **Backend:** Render serves the authenticated FastAPI API. Verify health and actual authenticated endpoints independently.
- **Extension:** GitHub Actions packages the extension with public repository Actions variables `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY`. The unmerged PDF integration additionally requires `VITE_API_BASE_URL` and bundled PDF.js assets.
- **Secrets:** Keep backend AI keys in backend/hosting secrets only. Never commit `.env`, credentials, private PDFs or user data.

## Known limitations and next steps

1. **PDF Import in Extension:** Direct public-PDF detection, Chrome's PDF viewer URLs, NUS library proxy access and browser permissions need robust end-to-end testing. Protected sources must respect access controls.
2. **Theme/reader synchronization:** Verify selected themes immediately show/hide the corresponding already-loaded highlights without a new AI request.
3. **Cross-device evidence consistency:** Validate project/PDF metadata, Saved Excerpts, promotion and refresh behavior across the Web App and extension.
4. **Evidence Network:** Test graph readability, node positioning, dragging, zoom and Fit to view with larger datasets.
5. **UX and responsiveness:** Continue browser QA for Paper Library, Reader, Assistant, mobile layouts and legacy purple UI elements.
6. **Research reliability:** AI outputs can be incomplete or wrong; only human-reviewed findings should be treated as verified evidence.

## Repository pointers

- `src/` — web application
- `backend/` — FastAPI and analysis
- `extension/` — Chrome Floating Assistant
- `supabase/` — database policies and migrations
- `.github/workflows/` — validation, extension packaging and deployment fallback

---

**NUScope is a research prototype.** Do not upload sensitive or confidential papers without confirming the deployment's access controls and applicable permissions.
