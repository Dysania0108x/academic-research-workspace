# NUScope — AI-Assisted Academic Research Workspace

NUScope is a research prototype developed for postgraduate literature-review workflows. It combines a **Web App** and **Chrome Floating Assistant Extension** to help researchers read academic PDFs, review AI-generated suggestions against original sources, save evidence, and explore relationships across papers.

**Live Web App:** https://academic-research-workspace.vercel.app  
**Backend health check:** https://academic-research-api.onrender.com/api/health  
**Source code:** https://github.com/Dysania0108x/academic-research-workspace

> **Prototype status:** This is an academic MVP, not an officially approved NUS service. AI outputs require independent verification. Reliability, institutional clearance, data handling, and large-scale operation have not been fully validated.

## What NUScope does

| Area | Current prototype capabilities |
| --- | --- |
| Projects | Email/password sign-in, private project workspaces, research questions and research themes |
| PDF workflow | Import PDFs through the Web App or Floating Extension; read PDFs in NUScope readers |
| AI-assisted reading | Theme-based candidate highlights and optional passage interpretations |
| Evidence review | Locate original source passages, review suggestions, save excerpts and maintain user interpretation |
| Research organisation | Evidence Map, theme-based views and evidence records |
| Cross-paper exploration | Evidence connections, network views and AI-assisted synthesis suggestions |
| Chrome Extension | Floating Assistant, PDF detection/import, side panel and independent Extension Reader |

**Human-in-the-loop principle:** Saving a passage does not mean accepting the AI interpretation. Users remain responsible for checking sources and deciding what evidence supports their research.

AI highlighting does **not** guarantee discovery of every relevant passage, and AI synthesis does **not** establish research gaps across an entire academic field.

## Try the prototype (for reviewers)

1. Open the [NUScope Web App](https://academic-research-workspace.vercel.app).
2. Sign in with an authorised test account, or create a new account where registration is enabled.
3. Open an existing sample project or create a project with a research question and themes.
4. Import a **text-based, appropriately licensed PDF**. Run **AI Highlight PDF** and review the suggestions against the original document.
5. Save useful passages, explore the **Evidence Map**, and inspect connections or synthesis suggestions.
6. Optionally install the Chrome Extension to test PDF detection, import and the independent Extension Reader.

**Demo credentials are not included in this repository.** If the teaching team needs a pre-populated account, share its temporary credentials privately through an approved channel, not in GitHub, slides or a public README. Use only non-sensitive sample PDFs and rotate the password afterward.

### Chrome Extension installation (unpacked)

1. Obtain the current **Extension ZIP** from the project team or a verified release artifact. The `extension/` directory contains extension source files; do not assume that any old ZIP is the latest build.
2. Unzip the package to a local folder.
3. In desktop Google Chrome, open `chrome://extensions` and enable **Developer mode**.
4. Click **Load unpacked** and select the extracted folder containing `manifest.json`.
5. Open a supported academic PDF page and use the NUScope Floating Assistant. Sign in and choose a project if prompted.

Chrome Extension functionality depends on browser permissions, site/PDF compatibility, and the availability of the Web App/backend. It is intended for desktop Chrome, not iPad Safari.

## Architecture

| Component | Technology / service | Responsibility |
| --- | --- | --- |
| Web App | React + Vite, hosted on Vercel | Project, reader, evidence and visualisation interfaces |
| Chrome Extension | Manifest V3 | Floating Assistant, PDF detection/import and Extension Reader |
| Backend | FastAPI + PyMuPDF, hosted on Render | PDF processing, protected analysis routes and AI orchestration |
| Authentication & data | Supabase Auth, PostgreSQL and private Storage | User sessions, project records, evidence and PDF storage |
| AI | Bailian-compatible LLM API; configured model may change | Candidate highlights, interpretations and synthesis suggestions |

The deployed backend exposes `/api/health` for a non-sensitive status check. A healthy response does **not** guarantee that every authenticated analysis request will succeed.

## Run locally (development)

Prerequisites: Node.js, Python 3, a Supabase project configured with appropriate Auth/database/Storage policies, and access to the configured LLM provider.

**Backend**
```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
# Configure your own backend environment variables; never commit secrets.
uvicorn main:app --reload --port 8000
```

**Frontend** (in another terminal, from the repository root)
```bash
npm install
npm run dev
```

Configure the frontend's local environment with the Supabase URL and publishable key and the FastAPI URL (normally `http://localhost:8000`). The application reads:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`
- `VITE_API_BASE_URL`

The backend also requires its Supabase URL/key, the configured AI provider credentials, and appropriate `FRONTEND_ORIGINS` for deployed frontend origins. See the backend source and `backend/.env.example` for provider settings. A working local install requires correctly configured Supabase tables, RLS and private `research-pdfs` Storage policies; the environment example alone does not provision these services.

For offline development, `AI_MOCK_MODE=true` uses synthetic responses. **Mock outputs are not research evidence.**

## Validation and known limitations

- The team has conducted **three exploratory user-testing sessions**. Feedback informed separation of passage saving from AI interpretation, improved PDF navigation/uploading, and retention of source-linked evidence features.
- Automated checks run through GitHub Actions. They are not a substitute for live browser, cross-account or third-party API testing.
- Some PDFs (scans, unusual layouts or text encodings) may not yield usable text or accurately located highlights.
- Render free-tier cold starts, upstream AI latency/errors, and temporary local processing caches can affect availability.
- Source verification, excerpt completeness, AI accuracy and long-term use require further systematic evaluation.
- The current prototype does not include NUS-only SSO, direct journal/database integration or AI-assisted academic writing as completed features.
- NUS-scale load testing, institutional security approval, licensing review and a validated semester operating-cost estimate remain outstanding.

## Security and research integrity

Do not commit API keys, `.env` files, private PDFs, local databases, access tokens or demo passwords. Do not upload confidential or restricted research materials without confirming the relevant permissions and third-party AI data-processing terms. Use a dedicated, non-sensitive demonstration account for assessment.

**Researcher judgement comes first:** verify AI claims against original academic sources before using them in academic work.

## Project history

This repository was originally named **Academic Research Workspace**. Earlier README content referred to local-only SQLite prototypes (v0.4–v0.7 and V6.2); those descriptions are historical and do not describe the current deployed NUScope architecture.
