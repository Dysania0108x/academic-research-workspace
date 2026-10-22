"""Regression tests for Supabase authorization helpers.

Run: cd backend && python -m pytest tests/test_cloud_auth.py
"""
from unittest.mock import Mock, patch
import pytest
from fastapi import HTTPException
from cloud_auth import authenticated_user, private_pdf_path, require_project_owner

USER = "11111111-1111-4111-8111-111111111111"
PROJECT = "22222222-2222-4222-8222-222222222222"
PAPER = "33333333-3333-4333-8333-333333333333"

def test_missing_bearer_is_rejected():
    with pytest.raises(HTTPException) as exc:
        authenticated_user(None)
    assert exc.value.status_code == 401

def test_invalid_storage_identifier_is_rejected():
    with pytest.raises(HTTPException) as exc:
        private_pdf_path(USER, "../outside", PAPER)
    assert exc.value.status_code == 422

def test_private_path_is_scoped():
    assert private_pdf_path(USER, PROJECT, PAPER) == f"{USER}/{PROJECT}/{PAPER}.pdf"

@patch("cloud_auth._configuration", return_value=("https://example.supabase.co", "anon"))
@patch("cloud_auth.httpx.Client")
def test_invalid_token_is_rejected(client_class, _config):
    client = client_class.return_value.__enter__.return_value
    client.get.return_value = Mock(status_code=401)
    with pytest.raises(HTTPException) as exc:
        authenticated_user("Bearer invalid")
    assert exc.value.status_code == 401

@patch("cloud_auth._configuration", return_value=("https://example.supabase.co", "anon"))
@patch("cloud_auth.httpx.Client")
def test_project_not_visible_under_rls_is_rejected(client_class, _config):
    client = client_class.return_value.__enter__.return_value
    client.get.side_effect = [
        Mock(status_code=200, json=lambda: {"id": USER}),
        Mock(status_code=200, json=lambda: []),
    ]
    with pytest.raises(HTTPException) as exc:
        require_project_owner(PROJECT, "Bearer valid")
    assert exc.value.status_code == 404
