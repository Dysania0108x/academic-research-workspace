"""Hosted PDF upload smoke tests, without real Supabase credentials."""
import sys
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch
from fastapi.testclient import TestClient
import fitz
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
import main

class HostedPdfSmokeTests(unittest.TestCase):
    def test_vercel_preview_cors_preflight(self):
        origin="https://academic-research-workspace-10903vcvj-evidence-workspace.vercel.app"
        with TestClient(main.app) as client:
            response=client.options("/api/papers?project_id=00000000-0000-4000-8000-000000000001",
                headers={"Origin":origin,"Access-Control-Request-Method":"POST",
                         "Access-Control-Request-Headers":"authorization"})
        self.assertEqual(response.status_code,200,response.text)
        self.assertEqual(response.headers.get("access-control-allow-origin"),origin)

    def test_real_two_page_pdf_upload_with_mocked_ownership(self):
        doc=fitz.open()
        for page_number in range(2):
            page=doc.new_page()
            page.insert_text((65,75),"A sample research paragraph about how students use AI to learn effectively, "+("first" if page_number==0 else "second")+" page, including reflection and verification.")
        pdf=doc.tobytes()
        doc.close()
        with tempfile.TemporaryDirectory() as directory:
            with patch.object(main,"STORE",Path(directory)), \
                 patch.object(main,"DB_PATH",Path(directory)/"test.db"), \
                 patch.object(main,"authenticated_user",return_value="test-owner"), \
                 patch("cloud_auth.require_project_owner",return_value="test-owner"):
                main.init_db()
                with TestClient(main.app) as client:
                    response=client.post("/api/papers?project_id=00000000-0000-4000-8000-000000000001",
                        headers={"Authorization":"Bearer test"},
                        files={"file":("test.pdf",pdf,"application/pdf")})
                self.assertEqual(response.status_code,200,response.text)
                self.assertEqual(response.json()["pages"],2)
                self.assertGreater(response.json()["blocks"],0)
