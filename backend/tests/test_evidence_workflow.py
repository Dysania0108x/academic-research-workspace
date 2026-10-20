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


if __name__ == "__main__":
    unittest.main()
