# Academic Research Workspace v0.4

A locally run prototype based on the user's v0.3 project. This release adds SQLite-backed project records, paper deletion, duplicate detection, editable map themes and evidence, theme-specific line highlights, and a less cluttered Overview/Reader.

## Run on macOS (VS Code)

Terminal 1:
```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
# Edit backend/.env locally to supply a newly generated API key and the correct endpoint.
uvicorn main:app --reload --port 8000
```

Terminal 2 (project root):
```bash
npm install
npm run dev
```
Open the Local URL printed by Vite (typically http://localhost:5173).

## What's new
- SQLite at `backend/research.db` for saved project JSON and PDF metadata; actual PDFs are stored under `backend/uploads/`.
- Project deletion and paper deletion with confirmation; linked evidence is removed when deleting a paper.
- SHA-256 duplicate PDF detection. Reuploading identical bytes returns the existing PDF ID.
- Editable Evidence Map themes: add, rename, delete; edit/move evidence cards.
- Research Overview replaces static Next Steps with live evidence counts per theme.
- Reader highlights use per-line rectangles, colored by theme, with assistant visibility/filter toggles; the giant passage list beneath PDF is removed.
- Guest Workspace label instead of pretending login is implemented.

## Important limitations
- Existing v0.3 projects saved only in browser localStorage are imported to SQLite when the frontend starts. Use the **same browser profile and localhost origin** to migrate them. Back up before deleting old project folders.
- PDF uploads from v0.3 are NOT included in this download. If you need them, copy `backend/uploads/` from your original v0.3 into v0.4. Database PDF metadata for old files may be absent; files still render if their IDs are in saved projects.
- The database is for a single local guest workspace, not secure multi-user login. Authentication remains future work.
- Highlighting is line-level based on AI-selected text blocks, not exact phrase-level. Complex tables and layouts can still cause imprecise overlays.
- Qwen API access is not fixed by this update; 403 AccessDenied.Unpurchased requires checking the account, model and workspace permissions.
- PDF deletions are permanent and are not reversible. Back up your uploads first.
- Project data is saved asynchronously to the local API. The UI also retains localStorage as a compatibility backup.

## Security
Never commit `backend/.env`, API keys, `backend/research.db`, or uploaded PDFs. The included `.env.example` contains placeholders only. Rotate any previously exposed API key.


## v0.5: AI efficiency
- Persistent per-PDF, per-research-question, per-theme analysis cache in SQLite. Reopening identical analysis uses 0 new API calls.
- Incremental theme analysis: newly added themes are analysed without repeating unchanged themes; removing a theme requires no API call. Renaming a theme changes its semantic cache key and triggers reanalysis on the next run.
- Passage analysis is triggered only on clicking a highlight and is cached by paper, block, question, theme, model and prompt version.
- Actual input/output/total token usage is recorded per API call in SQLite and displayed under Project Settings. This usage dashboard is global to the local backend, not per project.
- Existing verified evidence is not overwritten by cache updates.
- IMPORTANT: cache only works for PDFs registered in the new local database. New app installations should reupload their PDFs.
- This version does not yet implement a dedicated analysis job queue, per-project token attribution, or sentence-precise highlights.


## v0.6 changes (precision highlighting prototype)

- **Verified quote-based highlights:** The AI must supply an exact source quote, not a whole block. The server rejects quotes not present in the extracted text or not locatable on the PDF page with PyMuPDF `search_for`. No fallback block rectangles. Highlights may be absent if source matching fails.
- **Reduced clutter:** Maximum five accepted quotes per theme per page, maximum four suggested quotes per batch. Duplicate identical quotes are visually consolidated. Theme selection has explicit Select All / Clear All; selecting zero themes displays zero highlights.
- **Cache versioning:** New `v06-precise-20261020` keys prevent old v0.5 block highlights from reappearing. Existing evidence is preserved.
- **Reading controls:** Higher resolution server-rendered pages (2.5x), zoom from 65% to 250%, scrollable reading viewport, collapsible paper list, and Open PDF in a native browser viewer for selectable text. **The embedded reader is still raster-based, not yet PDF.js.**
- **Evidence editor:** Replace the native browser prompt with an in-app modal containing read-only source text and editable interpretation.
- **Overview:** Limit visible verified evidence to the three latest records and link to the full Evidence Map. This is not automatic cross-paper synthesis.

### Known limitations and validation

PDF matching is deliberately conservative. It can miss valid quotes when a PDF has non-standard text encoding, ligatures, or hyphenated line breaks. The model can still select too many phrases on highly topical papers; density tuning and a true PDF.js text layer are follow-up tasks. No live Qwen API calls were made during packaging. The frontend was not built in this environment because npm dependencies were unavailable offline. Run `npm install && npm run build` on your Mac to validate the UI.

### Quick verification

1. Run AI Highlight PDF on the supplied two-page synthetic UV paper. Old v0.5 cached block rectangles must **not** appear.
2. Clear All themes: all highlights disappear. Select one theme: only that theme's highlights show. Select All restores all.
3. Zoom to 150%, scroll the page, and open the original PDF in a new tab.
4. Edit an Evidence Map card, cancel, then save a revised interpretation; verify the change persists after reload.
5. Verify Overview shows only three recent records, not an endlessly growing list.
