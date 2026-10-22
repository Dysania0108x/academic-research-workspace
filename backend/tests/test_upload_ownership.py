"""Check upload is rejected before reading bytes unless the project belongs to user."""
import sys
import unittest
from pathlib import Path
from unittest.mock import patch
from fastapi.testclient import TestClient
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
import main

class UploadOwnershipTests(unittest.TestCase):
    def test_upload_requires_project_id(self):
        with TestClient(main.app) as client, patch.object(main,"authenticated_user",return_value="owner"):
            response=client.post("/api/papers",headers={"Authorization":"Bearer test"},
                files={"file":("paper.pdf",b"%PDF-1.4","application/pdf")})
        self.assertEqual(response.status_code,422)

    def test_upload_rejects_unowned_project(self):
        from fastapi import HTTPException
        with TestClient(main.app) as client, patch.object(main,"authenticated_user",return_value="owner"), \
             patch("cloud_auth.require_project_owner",side_effect=HTTPException(404,"Project not found")):
            response=client.post("/api/papers?project_id=11111111-1111-4111-8111-111111111111",
                headers={"Authorization":"Bearer test"},
                files={"file":("paper.pdf",b"%PDF-1.4","application/pdf")})
        self.assertEqual(response.status_code,404)
