from pathlib import Path
import unittest

SQL = Path(__file__).resolve().parents[2] / "supabase" / "migrations" / "20261023_pdf_highlight_review.sql"

class PdfReviewMigrationTests(unittest.TestCase):
    def test_single_complete_function_definition(self):
        text = SQL.read_text()
        self.assertEqual(text.count("create or replace function public.review_pdf_highlight("), 1)
        self.assertEqual(text.count("end $$;"), 1)
        self.assertEqual(text.count("grant execute on function public.review_pdf_highlight("), 1)
        self.assertTrue(text.rstrip().endswith("to authenticated;"))

    def test_owner_and_row_lock_present(self):
        text = SQL.read_text()
        self.assertIn("user_id=auth.uid() for update", text)
        self.assertIn("PDF does not belong to project", text)
        self.assertIn("Theme not found", text)
        self.assertIn("record_id text;", text)
        self.assertNotIn("::uuid into record_id", text)

if __name__ == "__main__":
    unittest.main()
