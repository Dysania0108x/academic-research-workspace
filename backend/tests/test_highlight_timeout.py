"""Offline regression: one timeout must not discard other highlight batches."""
import os
import sys
import threading
import unittest
from pathlib import Path
from unittest.mock import patch
from fastapi import HTTPException

sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
import main


class HighlightTimeoutTests(unittest.TestCase):
    def test_batch_failure_yields_partial_result(self):
        blocks=[{'id':f'0:{i}','page':1,'text':'A grounded observation about exposure and outdoor conditions.','rect':[0,0,100,100]} for i in range(24)]
        job={'id':'test','status':'queued','cancel_event':threading.Event(),'matches':[]}
        calls=[]
        def fake_ask(*args,**kwargs):
            calls.append(1)
            if len(calls)==1:raise HTTPException(502,'AI request failed: Request timed out.')
            return {'matches':[]}
        class FakeDoc:
            def __enter__(self):return self
            def __exit__(self,*args):return False
        with patch.dict(os.environ,{'HIGHLIGHT_BATCH_BLOCKS':'12'}), \
             patch.object(main,'get_doc',return_value=FakeDoc()), \
             patch.object(main,'blocks_for',return_value=blocks), \
             patch.object(main,'paper_sha',return_value='sha'), \
             patch.object(main,'active_model',return_value='mock'), \
             patch.object(main,'cache_get',return_value=None), \
             patch.object(main,'cache_put'), \
             patch.object(main,'ask',side_effect=fake_ask):
            main._analyse_job(job,main.AnalysisRequest(paper_id='test',question='How?',themes=['UV']))
        self.assertEqual(len(calls),2)
        self.assertEqual(job['status'],'partial')
        self.assertEqual(job['completed_batches'],2)
        self.assertEqual(job['failed_batches'],[1])

if __name__=='__main__':unittest.main()
