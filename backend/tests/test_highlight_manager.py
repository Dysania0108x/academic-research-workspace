"""Highlight Manager endpoint reads existing cached candidate records without AI calls."""
import json
import sys
import unittest
from pathlib import Path
from unittest.mock import patch
from fastapi.testclient import TestClient
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
import main

@unittest.skip('Legacy SQLite project API removed in V6.3; replace with owner-scoped cloud highlight tests')
class HighlightManagerTests(unittest.TestCase):
    def test_candidates_are_scoped_to_project_papers_and_deduplicated(self):
        project='highlight-manager-fixture'
        paper='highlight-paper-fixture'
        outside='other-paper-fixture'
        sample={'id':'0:1','page':1,'quote':'Outdoor participants showed accumulated exposure.','theme':'UV exposure'}
        with TestClient(main.app) as client:
            try:
                response=client.put(f'/api/projects/{project}',json={'id':project,'name':'Test','papers':[{'id':paper}],'evidence':[]})
                self.assertEqual(response.status_code,200,response.text)
                with main.db() as c:
                    for key,pid in [('highlight-test-a',paper),('highlight-test-b',paper),('highlight-test-outside',outside)]:
                        c.execute('INSERT OR REPLACE INTO multi_highlight_cache(cache_key,paper_id,result,created_at) VALUES(?,?,?,?)',(key,pid,json.dumps([sample]),1))
                response=client.get(f'/api/projects/{project}/highlight-candidates')
                self.assertEqual(response.status_code,200,response.text)
                candidates=response.json()['candidates']
                self.assertEqual(len(candidates),1)
                self.assertEqual(candidates[0]['paperId'],paper)
                self.assertEqual(candidates[0]['theme'],'UV exposure')
            finally:
                with main.db() as c:
                    c.execute('DELETE FROM projects WHERE id=?',(project,))
                    c.execute("DELETE FROM multi_highlight_cache WHERE cache_key LIKE 'highlight-test-%'")

if __name__=='__main__':unittest.main()
