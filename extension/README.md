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

## Phase 1–2 preview: account and project selection

This feature is on the `feature/extension-project-sync` branch and is not merged to `main`.

1. In the extension Side Panel, expand **Supabase connection settings**.
2. Enter the same Supabase Project URL and **publishable/anon** key configured for the NUScope Web App (`VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY`). These are public client configuration values, **not** the service-role key.
3. Sign in with your NUScope email and password.
4. Choose a project already created in the Web App. The research question and themes load from the authenticated `projects` table.
5. Use **Refresh projects** after changing themes in the Web App.

This phase is **read-only**: excerpts remain local and are not automatically associated with the selected project; no evidence or highlight is written to Supabase.

**Security/limitations:** Password authentication must be enabled for your Supabase project. Access is scoped by existing Supabase RLS; verify RLS policies before relying on it for private research. The session is stored in `chrome.storage.local` (extension-local, not shared with Web App); do not test on shared Chrome profiles. Authentication via Supabase's password endpoint is an MVP approach, not a final OAuth/PKCE flow. The extension requests HTTPS access to Supabase subdomains; Chrome may display a new permission prompt when loading it. This preview has not yet been browser-tested.

## Packaged connection (Phase 2 preview)

The extension now displays **NUScope sign in**, not database settings. The public Supabase configuration must be injected once when preparing an extension package; it cannot be retrieved automatically from Vercel by an unpacked extension.

From the repository root, set the same **public** `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` values used by the Web App in your local shell, then run:

```sh
node scripts/build-extension-config.mjs
```

Load the resulting `extension/` folder in `chrome://extensions`. Do **not** commit the locally generated `extension/config.js` or include service-role / secret keys. The committed file is intentionally an empty placeholder. Downloading the branch ZIP alone cannot log in until packaging is done.

After login, choose an existing Project and click **Refresh projects** after editing Themes in the Web App. This remains a **read-only project sync preview**; Saved Excerpts are still local and not yet uploaded to Evidence Map.

## Download a ready-to-load ZIP (GitHub Actions)

A manual packaging workflow is available in `.github/workflows/package-extension.yml`. Repository administrators must set two **GitHub Actions repository variables** (not secrets) at **Settings → Secrets and variables → Actions → Variables**:

- `VITE_SUPABASE_URL` — the public Supabase Project URL already used by the NUScope Web App.
- `VITE_SUPABASE_PUBLISHABLE_KEY` — the corresponding public publishable/anon client key.

Do not use a Supabase secret/service-role key. These values are included in the extension ZIP, as is normal for public browser-client configuration. Supabase RLS must enforce access control.

Go to **Actions → Package NUScope Chrome Extension → Run workflow**, select `feature/extension-project-sync`, and run. When it succeeds, download the **nuscope-extension** artifact from the workflow run. Unzip the artifact and then unzip `nuscope-extension.zip`; select the folder containing `manifest.json` in Chrome's **Load unpacked** dialog.

The workflow deliberately fails when the repository variables are missing, rather than producing a misleading nonfunctional package. No changes are deployed to the Web App. If the workflow is not visible before merging, GitHub may require the workflow to exist on the default branch for manual dispatch; use the local packaging script until then.

## Project PDF library (integration in progress)

The side panel now lists PDFs from the selected project's existing `data.papers` metadata. **Open original PDF** requests a short-lived signed URL from the same private Supabase Storage bucket used by the Web App. It does not make the PDF public, and it rejects unexpected storage paths. This is a viewing bridge only: it does **not** yet apply AI Highlight overlays or save PDF highlights in the Extension. Those must reuse the Web App's existing FastAPI analysis and verified geometry pipeline, rather than claiming Chrome's native PDF viewer supports injection.

This feature is currently a development preview. Test with a disposable project PDF and confirm signed URL access and browser permissions before release.

## AI PDF Highlight preview

The extension now has a **Project PDF Library → AI Highlight PDF** action. It sends the selected Project's research question, selected themes, and existing paper ID to the **same FastAPI `/api/analyse/start` endpoint** used by the Web App, then polls the authenticated job endpoint and displays candidate quotes, page numbers and themes. This does not yet paint overlays on the PDF or provide Verify/Reject/Restore controls; it is the first stage of integration.

For the AI button to work, set the public GitHub Actions repository variable `VITE_API_BASE_URL` to the **same HTTPS Render API base URL** as the Web App, then re-run the Extension packaging workflow. The packager adds that specific API origin to the extension's allowed host permissions. No private AI key is bundled. The backend must be deployed with the corresponding code, including authenticated job polling. If the variable is missing, the extension will show a configuration message rather than silently fail.

**Important:** This is a development preview. A valid project paper must also exist in the backend's PDF store; if the Render store was cleared, re-upload through the Web App. Do not treat suggested highlights as verified evidence.

## PDF candidate review (development preview)

After AI analysis, the side panel offers **Verify & Add Evidence**, **Reject**, and **Restore**. These use the authenticated, project-scoped `review_pdf_highlight` Supabase RPC and write to the same `projects.data.evidence` / `projects.data.rejected` fields as the Web App. Before testing, run `supabase/migrations/20261023_pdf_highlight_review.sql` in the existing Supabase project (after backup). The RPC requires ownership and an existing project paper/theme, and serializes writes with a row lock. This does not prove a quotation matches the original PDF: human verification is required. The PDF overlay viewer and live cross-client refresh remain outstanding.

## NUScope PDF Reader preview

The extension package now bundles **PDF.js 4.10.38 locally** (no remote executable scripts) and includes a browser-tab reader for private project PDFs. The reader fetches a PDF using the authenticated user's existing Supabase session, validates that the paper belongs to the selected project, and renders a selectable PDF.js text layer. Clicking **View highlight in PDF** in the Side Panel opens the relevant page and attempts to locate the exact quoted text in the PDF.js text layer, displaying orange highlight rectangles only when text can be matched. PDF text extraction may differ across fonts, scans, line breaks, and rotations; unmatched quotations remain unhighlighted rather than being placed at guessed coordinates.

This is a preview, not yet fully tested in Chrome. The PDF viewer supports page navigation, but not every PDF variant (scanned PDFs need OCR; some complex layout PDFs may not match). Analysis results and Verify/Reject/Restore are still controlled by the Side Panel, and the database RPC migration must be applied before those actions work. The GitHub Actions packaging workflow bundles PDF.js from npm at build time; downloading a raw source ZIP directly will **not** contain the vendor files and will not load the PDF reader.
