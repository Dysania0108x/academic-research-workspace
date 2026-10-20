# Academic Research Workspace

AI-assisted academic research workspace prototype built with React, Vite, FastAPI, SQLite, and a Qwen-compatible API.

## Project status

Initial repository setup. Application source code has not yet been uploaded.

## Security before uploading

Do not commit secrets or local/private data. Keep these out of Git:

- `backend/.env`
- `.env` files containing credentials
- `.venv/` and `node_modules/`
- `backend/research.db` or any SQLite database
- `backend/uploads/` and any user PDFs
- Python cache files

Configure API credentials locally in `backend/.env`; use `backend/.env.example` with placeholder values for documentation only.

## Local development

See `backend/requirements.txt` and `package.json` for dependencies. Run the FastAPI backend and Vite frontend in separate terminals.
