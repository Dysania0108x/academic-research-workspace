"""Regression checks for production and Preview browser origins."""
import ast
import re
import unittest
from pathlib import Path

SOURCE=Path(__file__).resolve().parents[1]/"main.py"

class CorsOriginTests(unittest.TestCase):
    def test_production_and_preview_origins_allowed(self):
        tree=ast.parse(SOURCE.read_text(encoding="utf-8"))
        patterns=[]
        for node in ast.walk(tree):
            if isinstance(node,ast.keyword) and node.arg=="allow_origin_regex":
                patterns.append(ast.literal_eval(node.value))
        self.assertEqual(len(patterns),1)
        regex=re.compile(patterns[0])
        self.assertIsNotNone(regex.fullmatch("https://academic-research-workspace.vercel.app"))
        self.assertIsNotNone(regex.fullmatch("https://academic-research-workspace-git-fix-example.vercel.app"))
        self.assertIsNone(regex.fullmatch("https://academic-research-workspace.vercel.app.evil.example"))
        self.assertIsNone(regex.fullmatch("https://unrelated-project.vercel.app"))

if __name__=="__main__":unittest.main()
