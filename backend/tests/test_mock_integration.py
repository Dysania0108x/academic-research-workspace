"""Full offline API smoke test using a generated PDF and deterministic mock AI.

No real API key, external requests, or existing user database are used.
"""
import os
import sys
import tempfile
import time
import unittest
from pathlib import Path
from unittest.mock import patch

import fitz
from fastapi.testclient import TestClient

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import main


@unittest.skip('Old unscoped upload contract; replace with Supabase-backed integration fixture')
class MockWorkflowIntegration(unittest.TestCase):
    def test_pdf_to_evidence_network_and_synthesis(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            uploads = root / "uploads"
            uploads.mkdir()
            pdf = fitz.open()
            page = pdf.new_page()
            page.insert_textbox(
                fitz.Rect(72, 70, 530, 200),
                "Cumulative ultraviolet exposure can increase during outdoor hiking. "
                "Participants reported that shade and protective clothing influenced their behaviour. "
                "The observation requires careful interpretation in relation to the research question.",
                fontsize=11,
            )
            page = pdf.new_page()
            page.insert_textbox(
                fitz.Rect(72, 70, 530, 200),
                "Outdoor participants often considered comfort when choosing sunscreen. "
                "Delayed effects of sunlight may influence risk awareness and protective decisions. "
                "These statements are sample data rather than empirical research findings.",
                fontsize=11,
            )
            pdf_bytes = pdf.tobytes()
            pdf.close()
            with patch.dict(os.environ, {"AI_MOCK_MODE": "true"}, clear=False), \
                 patch.object(main, "STORE", uploads), \
                 patch.object(main, "DB_PATH", root / "mock-test.db"), \
                 patch.object(main, "OpenAI", side_effect=AssertionError("No external model calls allowed")):
                main.init_db()
                with TestClient(main.app) as client:
                    response = client.post("/api/papers", files={"file": ("mock-uv.pdf", pdf_bytes, "application/pdf")})
                    self.assertEqual(response.status_code, 200, response.text)
                    paper = response.json()
                    paper_id = paper["id"]
                    self.assertEqual(paper["pages"], 2)
                    self.assertEqual(paper["metadata_status"], "unverified")

                    health = client.get("/api/health").json()
                    self.assertTrue(health["mock_mode"])
                    self.assertTrue(health["ai_configured"])
                    blocks = client.get(f"/api/papers/{paper_id}/blocks").json()["blocks"]
                    self.assertGreaterEqual(len(blocks), 2)
                    theme_response = client.post("/api/themes/suggest", json={
                        "question": "How does outdoor activity affect cumulative UV exposure?",
                        "topics": ["UV Exposure"], "paper_ids": [paper_id]
                    })
                    self.assertEqual(theme_response.status_code, 200, theme_response.text)
                    self.assertTrue(theme_response.json()["themes"])

                    job_response = client.post("/api/analyse/start", json={
                        "paper_id": paper_id,
                        "question": "How does outdoor activity affect cumulative UV exposure?",
                        "themes": ["UV Exposure", "Risk Awareness"]
                    })
                    self.assertEqual(job_response.status_code, 200, job_response.text)
                    job_id = job_response.json()["id"]
                    status = {}
                    for _ in range(100):
                        status = client.get(f"/api/analyse/jobs/{job_id}").json()
                        if status["status"] in ("completed", "failed", "cancelled"):
                            break
                        time.sleep(0.05)
                    self.assertEqual(status.get("status"), "completed", status)
                    self.assertGreater(len(status["matches"]), 0, status)
                    self.assertEqual(status["completed_batches"], status["total_batches"])
                    first = status["matches"][0]
                    self.assertTrue(first["rects"])

                    passage = client.post("/api/passage", json={
                        "paper_id": paper_id, "block_id": first["id"],
                        "question": "How does outdoor activity affect cumulative UV exposure?",
                        "theme": first["theme"]
                    })
                    self.assertEqual(passage.status_code, 200, passage.text)
                    self.assertIn("[MOCK]", passage.json()["interpretation"])

                    located = client.post(f"/api/papers/{paper_id}/locate", json={
                        "page": first["page"], "quote": first["quote"]
                    })
                    self.assertEqual(located.status_code, 200, located.text)
                    self.assertTrue(located.json()["found"])

                    records = [
                        {"id": "e1", "theme": "UV Exposure", "quote": first["quote"],
                         "analysis": "[MOCK] Sample interpretation", "source": "mock-uv.pdf"},
                        {"id": "e2", "theme": "Risk Awareness",
                         "quote": "Delayed effects of sunlight may influence risk awareness",
                         "analysis": "[MOCK] Another interpretation", "source": "mock-uv.pdf"}
                    ]
                    network = client.post("/api/network/propose", json={
                        "question": "How does outdoor activity affect cumulative UV exposure?",
                        "evidence": records
                    })
                    self.assertEqual(network.status_code, 200, network.text)
                    self.assertEqual(network.json()["links"][0]["status"], "suggested")
                    synthesis = client.post("/api/synthesis", json={
                        "question": "How does outdoor activity affect cumulative UV exposure?",
                        "evidence": [
                            {"id": x["id"], "theme": x["theme"], "quote": x["quote"],
                             "interpretation": x["analysis"], "source": x["source"]}
                            for x in records
                        ]
                    })
                    self.assertEqual(synthesis.status_code, 200, synthesis.text)
                    self.assertTrue(synthesis.json()["insights"])
                    self.assertTrue(synthesis.json()["gaps"])
                    self.assertEqual(client.get("/api/usage").json()["requests"], 0)


if __name__ == "__main__":
    unittest.main()
