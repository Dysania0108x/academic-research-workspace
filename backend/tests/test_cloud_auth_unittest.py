"""Unittest-discoverable security checks for the V6.3 auth boundary."""
import sys
import unittest
from pathlib import Path
from unittest.mock import patch, Mock

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from fastapi import HTTPException
from fastapi.testclient import TestClient
import cloud_auth
import main


class CloudAuthBoundaryTests(unittest.TestCase):
    def test_missing_token_denied(self):
        with TestClient(main.app) as client:
            response = client.get("/api/papers/unknown/blocks")
        self.assertEqual(response.status_code, 401)

    def test_invalid_token_denied(self):
        with patch.object(cloud_auth, "_configuration", return_value=("https://example.supabase.co", "anon")), \
             patch.object(cloud_auth.httpx, "Client") as client_class:
            client_class.return_value.__enter__.return_value.get.return_value = Mock(status_code=401)
            with TestClient(main.app) as client:
                response = client.get("/api/papers/unknown/blocks", headers={"Authorization": "Bearer invalid"})
        self.assertEqual(response.status_code, 401)

    def test_storage_path_rejects_traversal(self):
        with self.assertRaises(HTTPException) as context:
            cloud_auth.private_pdf_path("11111111-1111-4111-8111-111111111111", "../bad", "33333333-3333-4333-8333-333333333333")
        self.assertEqual(context.exception.status_code, 422)

    def test_health_remains_public(self):
        with TestClient(main.app) as client:
            response = client.get("/api/health")
        self.assertEqual(response.status_code, 200)

    def test_authenticated_user_cannot_read_unowned_paper(self):
        user_id = "11111111-1111-4111-8111-111111111111"
        with patch.object(main, "authenticated_user", return_value=user_id), \
             patch("cloud_auth._configuration", return_value=("https://example.supabase.co", "anon")), \
             patch("httpx.Client") as client_class:
            client_class.return_value.__enter__.return_value.get.return_value = Mock(
                status_code=200, json=lambda: [])
            with TestClient(main.app) as client:
                response = client.get("/api/papers/unowned/blocks",
                                      headers={"Authorization": "Bearer valid"})
        self.assertEqual(response.status_code, 404)

    def test_legacy_global_project_list_is_disabled(self):
        with patch.object(main, "authenticated_user", return_value="test-user"):
            with TestClient(main.app) as client:
                response = client.get("/api/projects",
                                      headers={"Authorization": "Bearer valid"})
        self.assertEqual(response.status_code, 410)

    def test_other_users_analysis_job_is_hidden(self):
        job_id = "11111111-1111-4111-8111-111111111111"
        job = {"id": job_id, "owner_id": "another-user", "status": "completed"}
        with patch.object(main, "authenticated_user", return_value="current-user"), \
             patch.dict(main.analysis_jobs, {job_id: job}, clear=True):
            with TestClient(main.app) as client:
                response = client.get(f"/api/analyse/jobs/{job_id}",
                                      headers={"Authorization": "Bearer valid"})
        self.assertEqual(response.status_code, 404)
