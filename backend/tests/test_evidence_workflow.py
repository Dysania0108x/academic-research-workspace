"""Offline regression tests; no real Qwen API calls or user PDF files."""
import sys
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import fitz
import main


class EvidenceWorkflowTests(unittest.TestCase):
    def test_exact_quote_location_and_missing_quote(self):
        with tempfile.TemporaryDirectory() as folder:
            path = Path(folder) / "paper-test.pdf"
            doc = fitz.open()
            page = doc.new_page()
            page.insert_text((72, 100), "Cumulative UV exposure increases during outdoor hiking.")
            doc.save(path)
            doc.close()
            with patch.object(main, "STORE", Path(folder)):
                found = main.locate_quote("paper-test", main.LocateRequest(
                    page=1, quote="Cumulative UV exposure increases during outdoor hiking."
                ))
                self.assertTrue(found["found"])
                self.assertTrue(found["rects"])
                missing = main.locate_quote("paper-test", main.LocateRequest(
                    page=1, quote="This sentence does not occur in the PDF."
                ))
                self.assertFalse(missing["found"])
                self.assertEqual(missing["rects"], [])

    def test_metadata_does_not_invent_publication_year_or_venue(self):
        doc = fitz.open()
        doc.new_page().insert_text((72, 100), "Sample UV Research Study")
        meta = main.extract_paper_metadata(doc)
        self.assertEqual(meta["year"], "")
        self.assertEqual(meta["venue"], "")
        self.assertEqual(meta["metadata_status"], "unverified")
        doc.close()

    def test_network_filters_invalid_and_duplicate_edges(self):
        req = main.NetworkProposalRequest(question="What influences UV exposure?", evidence=[
            {"id": "a", "theme": "UV", "quote": "UV exposure increased during longer outdoor activities.", "source": "paper A"},
            {"id": "b", "theme": "UV", "quote": "Exposure was lower under dense tree cover.", "source": "paper B"},
        ])
        generated = {"links": [
            {"source_id": "a", "target_id": "b", "relationship": "Related", "rationale": "Both discuss environmental exposure under different outdoor conditions."},
            {"source_id": "b", "target_id": "a", "relationship": "Related", "rationale": "Duplicate in reverse order."},
            {"source_id": "a", "target_id": "unknown", "relationship": "Supporting", "rationale": "Unknown source must be rejected."},
            {"source_id": "a", "target_id": "a", "relationship": "Supporting", "rationale": "Self link must be rejected."},
        ]}
        with patch.object(main, "cache_get", return_value=None), patch.object(main, "ask", return_value=generated), patch.object(main, "cache_put"):
            result = main.propose_evidence_links(req)
        self.assertEqual(len(result["links"]), 1)
        self.assertEqual(result["links"][0]["status"], "suggested")
        self.assertEqual(result["links"][0]["relationship"], "Related")


    def test_synthesis_only_returns_known_evidence_ids(self):
        req = main.SynthesisRequest(question="How does UV exposure vary?", evidence=[
            {"id": "e1", "theme": "UV", "quote": "Cumulative UV exposure increased with outdoor duration.", "interpretation": "Duration matters."}
        ])
        generated = {"insights": [{"text": "Longer exposure is associated with more accumulated UV dose.", "evidence_ids": ["e1", "invented"]}],
                     "gaps": [{"text": "This library has no direct comparison across seasons.", "evidence_ids": ["invented"]}]}
        with patch.object(main, "cache_get", return_value=None), patch.object(main, "ask", return_value=generated), patch.object(main, "cache_put"):
            result = main.synthesize(req)
        self.assertEqual(result["insights"][0]["evidence_ids"], ["e1"])
        self.assertEqual(result["gaps"][0]["evidence_ids"], [])



    def test_mock_mode_never_calls_openai_or_logs_tokens(self):
        from unittest.mock import patch
        import os
        with patch.dict(os.environ, {"AI_MOCK_MODE": "true"}, clear=False):
            with patch.object(main, "OpenAI", side_effect=AssertionError("Network model must not be called")):
                with patch.object(main, "db", side_effect=AssertionError("Mock calls must not log tokens")):
                    self.assertTrue(main.mock_mode())
                    self.assertEqual(main.active_model(), "mock-deterministic-v1")
                    self.assertTrue(main.health()["ai_configured"])
                    self.assertTrue(main.health()["mock_mode"])
                    data = main.ask([{"role": "user", "content": '{"themes":["UV","Risk"],"pdf_blocks":[{"id":"0:0","page":1,"text":"Cumulative UV exposure increases during outdoor activity because people spend longer periods exposed to solar radiation while hiking."}]}'}], task_type="highlight")
                    self.assertEqual(data["matches"][0]["theme"], "UV")
                    self.assertIn(data["matches"][0]["quote"], "Cumulative UV exposure increases during outdoor activity because people spend longer periods exposed to solar radiation while hiking.")
                    passage = main.ask([{"role": "user", "content": '{"original_passage":"A test source quote."}'}], task_type="passage")
                    self.assertIn("[MOCK]", passage["interpretation"])

    def test_mock_network_and_synthesis_reference_real_supplied_ids(self):
        from unittest.mock import patch
        import os
        with patch.dict(os.environ, {"AI_MOCK_MODE": "true"}, clear=False):
            network = main.ask([{"role":"user","content": '{"evidence":[{"id":"e1"},{"id":"e2"}]}'}],task_type="network")
            self.assertEqual((network["links"][0]["source_id"], network["links"][0]["target_id"]), ("e1","e2"))
            summary = main.ask([{"role":"user","content": '{"verified_evidence":[{"id":"e1"}]}'}],task_type="synthesis")
            self.assertEqual(summary["insights"][0]["evidence_ids"], ["e1"])
            themes = main.ask([{"role":"user","content": '{"question":"How does UV exposure vary?","user_topics":["UV Awareness"]}'}],task_type="theme_suggestion")
            self.assertIn("UV Awareness", [t["name"] for t in themes["themes"]])



if __name__ == "__main__":
    unittest.main()
