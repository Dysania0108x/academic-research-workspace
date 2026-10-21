"""Unit tests for durable Supabase job REST adapter (no real network)."""
import sys
import unittest
from pathlib import Path
from unittest.mock import patch, Mock
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
import cloud_jobs

ENV={"SUPABASE_URL":"https://example.supabase.co","SUPABASE_SERVICE_ROLE_KEY":"server-secret"}

class CloudJobTests(unittest.TestCase):
    def test_disabled_without_server_secret(self):
        with patch.dict("os.environ",{"SUPABASE_SERVICE_ROLE_KEY":"","SUPABASE_URL":""}):
            self.assertFalse(cloud_jobs.enabled())

    def test_save_uses_server_only_key(self):
        job={"id":"job-1","owner_id":"user-1","paper_id":"paper-1","cache_key":"hash"}
        with patch.dict("os.environ",ENV),patch.object(cloud_jobs.httpx,"Client") as factory:
            client=factory.return_value.__enter__.return_value
            client.post.return_value=Mock(status_code=201)
            self.assertTrue(cloud_jobs.save(job,{"status":"completed"}))
            args,kwargs=client.post.call_args
            self.assertEqual(kwargs["json"]["owner_id"],"user-1")
            self.assertEqual(kwargs["headers"]["Authorization"],"Bearer server-secret")

    def test_read_filters_owner(self):
        with patch.dict("os.environ",ENV),patch.object(cloud_jobs.httpx,"Client") as factory:
            client=factory.return_value.__enter__.return_value
            client.get.return_value=Mock(json=lambda:[{"snapshot":{"status":"completed"}}])
            self.assertEqual(cloud_jobs.get("job-1","user-1")["status"],"completed")
            self.assertEqual(client.get.call_args.kwargs["params"]["owner_id"],"eq.user-1")
