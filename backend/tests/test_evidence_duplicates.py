"""Regression checks for duplicate evidence prevention."""
import sys
import unittest
from pathlib import Path
from unittest.mock import patch
from fastapi.testclient import TestClient
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
import main

@unittest.skip('Legacy SQLite project API removed in V6.3; replace with Supabase RLS integration tests')
class EvidenceDuplicateTests(unittest.TestCase):
    def test_new_duplicate_rejected_but_existing_record_can_be_edited(self):
        project_id='test-evidence-duplicate'
        first={'id':'one','paperId':'paper-1','page':2,'quote':'Sun exposure increases during long outdoor activities.','analysis':'first'}
        second={**first,'id':'two','analysis':'second'}
        with TestClient(main.app) as client:
            try:
                response=client.put(f'/api/projects/{project_id}',json={'id':project_id,'evidence':[first]})
                self.assertEqual(response.status_code,200,response.text)
                duplicate=client.put(f'/api/projects/{project_id}',json={'id':project_id,'evidence':[first,second]})
                self.assertEqual(duplicate.status_code,409,duplicate.text)
                edited=client.put(f'/api/projects/{project_id}',json={'id':project_id,'evidence':[{**first,'analysis':'updated'}]})
                self.assertEqual(edited.status_code,200,edited.text)
            finally:
                client.delete(f'/api/projects/{project_id}')

if __name__=='__main__':unittest.main()
