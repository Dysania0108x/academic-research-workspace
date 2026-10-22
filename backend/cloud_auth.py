"""Supabase identity and ownership checks for protected FastAPI routes.

Fail closed: never trust user IDs or project IDs sent by the browser as proof
of authorization. Verify bearer tokens with Supabase Auth and query projects
using the same token, so the database's RLS policies remain authoritative.
"""
import os
import httpx
from fastapi import Header, HTTPException


def _configuration():
    url = os.getenv("SUPABASE_URL") or os.getenv("VITE_SUPABASE_URL")
    key = (os.getenv("SUPABASE_PUBLISHABLE_KEY")
           or os.getenv("SUPABASE_ANON_KEY")
           or os.getenv("VITE_SUPABASE_PUBLISHABLE_KEY"))
    if not url or not key:
        raise HTTPException(503, "Supabase authentication is not configured")
    return url.rstrip("/"), key


def _token(authorization: str | None):
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(401, "Bearer token required")
    token = authorization[7:].strip()
    if not token:
        raise HTTPException(401, "Bearer token required")
    return token


def authenticated_user(authorization: str | None = Header(default=None)):
    """FastAPI dependency; returns the authenticated Supabase user ID."""
    token = _token(authorization)
    url, key = _configuration()
    try:
        with httpx.Client(timeout=8.0) as client:
            response = client.get(
                f"{url}/auth/v1/user",
                headers={"apikey": key, "Authorization": f"Bearer {token}"},
            )
    except httpx.RequestError:
        raise HTTPException(503, "Authentication service unavailable")
    if response.status_code in (401, 403):
        raise HTTPException(401, "Invalid or expired session")
    if response.status_code != 200:
        raise HTTPException(503, "Authentication verification failed")
    user_id = response.json().get("id")
    if not isinstance(user_id, str) or not user_id:
        raise HTTPException(401, "Invalid user identity")
    return user_id


def require_project_owner(project_id: str, authorization: str | None):
    """Validate identity AND project ownership through Supabase RLS.

    This helper must be invoked by each project-scoped endpoint; defining it
    alone does not secure legacy endpoints.
    """
    user_id = authenticated_user(authorization)
    token = _token(authorization)
    url, key = _configuration()
    try:
        with httpx.Client(timeout=8.0) as client:
            response = client.get(
                f"{url}/rest/v1/projects",
                params={"select": "id", "id": f"eq.{project_id}",
                        "user_id": f"eq.{user_id}", "limit": "1"},
                headers={"apikey": key, "Authorization": f"Bearer {token}"},
            )
    except httpx.RequestError:
        raise HTTPException(503, "Project authorization service unavailable")
    if response.status_code != 200:
        raise HTTPException(503, "Project authorization failed")
    if not response.json():
        raise HTTPException(404, "Project not found")
    return user_id


def private_pdf_path(user_id: str, project_id: str, paper_id: str):
    """Construct private storage paths only from validated UUIDs."""
    from uuid import UUID
    try:
        return "/".join(str(UUID(value)) for value in
                        (user_id, project_id, paper_id)) + ".pdf"
    except (ValueError, TypeError, AttributeError):
        raise HTTPException(422, "Invalid storage identifier")
