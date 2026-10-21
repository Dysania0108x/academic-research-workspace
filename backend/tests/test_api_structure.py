"""Guard against accidental duplication of the complete API and middleware."""
import ast
import unittest
from pathlib import Path

SOURCE=Path(__file__).resolve().parents[1]/"main.py"

class ApiStructureTests(unittest.TestCase):
    def test_no_duplicate_route_handlers_or_auth_middleware(self):
        tree=ast.parse(SOURCE.read_text(encoding="utf-8"))
        names=[node.name for node in tree.body if isinstance(node,(ast.FunctionDef,ast.AsyncFunctionDef))]
        self.assertEqual(names.count("require_api_session"),1)
        self.assertEqual(names.count("upload"),1)
        self.assertEqual(names.count("start_analysis"),1)
        self.assertEqual(names.count("extract_paper_metadata"),1)
        self.assertEqual(names.count("init_db"),1)
