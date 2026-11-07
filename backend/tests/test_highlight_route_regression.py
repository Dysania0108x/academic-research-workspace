"""Regression checks for the highlight endpoint security and middleware ordering."""
from pathlib import Path

SOURCE = (Path(__file__).resolve().parents[1] / "main.py").read_text()


def test_highlight_route_remains_owner_scoped():
    assert "require_project_owner(project_id, authorization)" in SOURCE
    assert "params={'select':'data', 'id':f'eq.{project_id}'}" in SOURCE
    assert "headers={'apikey':key, 'Authorization':authorization}" in SOURCE


def test_highlight_route_allowed_but_legacy_project_routes_blocked():
    assert "request.method == 'GET' and re.fullmatch(r'/api/projects/[^/]+/highlight-candidates', path)" in SOURCE
    assert "Legacy unscoped endpoint disabled" in SOURCE


def test_cors_wraps_auth_middleware():
    assert SOURCE.index("@app.middleware(\"http\")") < SOURCE.index("app.add_middleware(\n    CORSMiddleware,")


def test_missing_ephemeral_cache_is_not_a_missing_project():
    assert "project = records[0].get('data') or {}" in SOURCE
    assert "return {'candidates':list(candidates.values())" in SOURCE
