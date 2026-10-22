#!/usr/bin/env bash
set -eu
cd /workspaces/academic-research-workspace
mkdir -p /tmp/arw-codespaces
if ! curl -fsS http://127.0.0.1:8000/api/health >/dev/null 2>&1; then
  nohup python -m uvicorn main:app --app-dir backend --host 0.0.0.0 --port 8000 > /tmp/arw-codespaces/backend.log 2>&1 < /dev/null &
fi
if ! curl -fsS http://127.0.0.1:5173/ >/dev/null 2>&1; then
  nohup npm run dev -- --host 0.0.0.0 > /tmp/arw-codespaces/frontend.log 2>&1 < /dev/null &
fi
echo "Web app: open forwarded port 5173 in the Codespaces Ports tab."
echo "Backend log: /tmp/arw-codespaces/backend.log"
echo "Frontend log: /tmp/arw-codespaces/frontend.log"
