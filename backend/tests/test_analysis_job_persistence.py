"""Persistence regression tests: snapshots survive process-memory loss."""
import sys
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import main

class AnalysisJobPersistenceTests(unittest.TestCase):
    def test_completed_job_recovers_only_for_owner(self):
        with tempfile.TemporaryDirectory() as directory:
            with patch.object(main,"DB_PATH",Path(directory)/"jobs.db"):
                main.init_db()
                job={"id":"job-test","owner_id":"owner-a","paper_id":"paper-a",
                     "cache_key":"context-a","status":"completed","matches":[{"quote":"test"}],
                     "cancel_event":__import__("threading").Event()}
                main._persist_job(job)
                self.assertEqual(main._load_job("job-test","owner-a")["status"],"completed")
                self.assertIsNone(main._load_job("job-test","owner-b"))
                self.assertEqual(main._latest_persisted_job("owner-a","context-a")["id"],"job-test")

    def test_inflight_job_becomes_interrupted_after_restart(self):
        with tempfile.TemporaryDirectory() as directory:
            with patch.object(main,"DB_PATH",Path(directory)/"jobs.db"):
                main.init_db()
                job={"id":"running-job","owner_id":"owner-a","paper_id":"paper-a",
                     "cache_key":"context-b","status":"running",
                     "cancel_event":__import__("threading").Event()}
                main._persist_job(job)
                recovered=main._load_job("running-job","owner-a")
                self.assertEqual(recovered["status"],"interrupted")
