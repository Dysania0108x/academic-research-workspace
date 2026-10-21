"""Regression tests for CORS on Vercel preview origins and auth failures."""
import sys
import unittest
from pathlib import Path
from unittest.mock import patch
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
from fastapi.testclient import TestClient
from main import app

ORIGIN='https://academic-research-workspace-7o7s8z29w-evidence-workspace.vercel.app'
class PreviewCorsTests(unittest.TestCase):
    def setUp(self):
        self.client=TestClient(app)
    def test_health_get_has_preview_origin(self):
        r=self.client.get('/api/health',headers={'Origin':ORIGIN})
        self.assertEqual(r.status_code,200)
        self.assertEqual(r.headers.get('access-control-allow-origin'),ORIGIN)
    def test_authorized_preflight(self):
        r=self.client.options('/api/analyse/start',headers={'Origin':ORIGIN,'Access-Control-Request-Method':'POST','Access-Control-Request-Headers':'authorization,content-type'})
        self.assertEqual(r.status_code,200,r.text)
        self.assertEqual(r.headers.get('access-control-allow-origin'),ORIGIN)
    def test_missing_token_error_still_has_cors(self):
        r=self.client.get('/api/papers/nonexistent/blocks',headers={'Origin':ORIGIN})
        self.assertIn(r.status_code,(401,403))
        self.assertEqual(r.headers.get('access-control-allow-origin'),ORIGIN)
    def test_other_origin_is_rejected(self):
        r=self.client.options('/api/analyse/start',headers={'Origin':'https://evil.example','Access-Control-Request-Method':'POST','Access-Control-Request-Headers':'authorization'})
        self.assertNotEqual(r.headers.get('access-control-allow-origin'),'https://evil.example')
