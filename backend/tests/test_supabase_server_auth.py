import os
import sys
import unittest
from pathlib import Path
from unittest.mock import patch
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
import supabase_server_auth as auth
import cloud_jobs
import cloud_usage

class ServerHeadersTests(unittest.TestCase):
    def test_modern_secret_is_not_used_as_jwt(self):
        with patch.dict(os.environ,{"SUPABASE_URL":"https://example.supabase.co","SUPABASE_SERVICE_ROLE_KEY":"sb_secret_example"},clear=True):
            self.assertTrue(auth.enabled())
            self.assertEqual(auth.headers()["apikey"],"sb_secret_example")
            self.assertNotIn("Authorization",auth.headers())
            self.assertEqual(cloud_jobs._headers(),auth.headers())
            self.assertEqual(cloud_usage._headers(),auth.headers())

    def test_legacy_service_role_uses_bearer(self):
        with patch.dict(os.environ,{"SUPABASE_URL":"https://example.supabase.co","SUPABASE_SERVICE_ROLE_KEY":"eyJlegacy"},clear=True):
            self.assertEqual(auth.headers()["Authorization"],"Bearer eyJlegacy")

    def test_fallback_secret_variable(self):
        with patch.dict(os.environ,{"SUPABASE_URL":"https://example.supabase.co","SUPABASE_SECRET_KEY":"sb_secret_example"},clear=True):
            self.assertTrue(cloud_jobs.enabled())
            self.assertTrue(cloud_usage.enabled())
            self.assertNotIn("Authorization",auth.headers())

    def test_no_key_fails_closed(self):
        with patch.dict(os.environ,{"SUPABASE_URL":"https://example.supabase.co"},clear=True):
            self.assertFalse(auth.enabled())
            with self.assertRaises(RuntimeError):auth.headers()
