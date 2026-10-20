"""Regression tests for per-paper background analysis reconnect and deduplication."""
import sys
import unittest
from pathlib import Path
from unittest.mock import patch
from fastapi.testclient import TestClient

sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
import main


class PaperAnalysisRecoveryTests(unittest.TestCase):
    def test_resume_and_context_isolation_and_cancel(self):
        with patch.object(main,"analysis_jobs",{}), \
             patch.object(main,"paper_sha",return_value="same-content-hash"), \
             patch.object(main,"active_model",return_value="mock-model"), \
             patch.object(main.analysis_pool,"submit",return_value=None):
            with TestClient(main.app) as client:
                payload={"paper_id":"paper-one","question":"How does UV exposure change?","themes":["UV exposure"]}
                started=client.post("/api/analyse/start",json=payload)
                self.assertEqual(started.status_code,200,started.text)
                job=started.json()
                self.assertEqual(job["paper_id"],"paper-one")
                self.assertEqual(job["status"],"queued")
                # A duplicate start is idempotent and does not spawn another worker.
                again=client.post("/api/analyse/start",json=payload)
                self.assertEqual(again.json()["id"],job["id"])
                endpoint="/api/analyse/papers/paper-one/job"
                params={"question":payload["question"],"themes":'["UV exposure"]'}
                restored=client.get(endpoint,params=params)
                self.assertEqual(restored.status_code,200,restored.text)
                self.assertEqual(restored.json()["job"]["id"],job["id"])
                # Changing the research context cannot attach to a stale job.
                different=client.get(endpoint,params={"question":"Different question","themes":params["themes"]})
                self.assertIsNone(different.json()["job"])
                cancelled=client.post(f"/api/analyse/jobs/{job['id']}/cancel")
                self.assertEqual(cancelled.status_code,200,cancelled.text)
                self.assertEqual(cancelled.json()["status"],"cancelled")
                self.assertEqual(client.get(endpoint,params=params).json()["job"]["status"],"cancelled")

if __name__=="__main__":
    unittest.main()
