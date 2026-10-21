from supabase_server_auth import enabled as server_enabled, headers as server_headers
"""Durable AI usage events; never send service-role credentials to the browser."""
import os
import uuid
import httpx

def enabled():
    return server_enabled()

def _headers():
    return server_headers()

def record(*, owner_id, paper_id, task_type, model, usage, status):
    if not enabled() or not owner_id:return False
    row={'id':str(uuid.uuid4()),'owner_id':owner_id,'paper_id':paper_id,
         'task_type':task_type,'model':model,
         'input_tokens':int(usage[0] or 0),'output_tokens':int(usage[1] or 0),
         'total_tokens':int(usage[2] or 0),'status':status}
    with httpx.Client(timeout=8) as client:
        response=client.post(os.environ['SUPABASE_URL'].rstrip('/')+'/rest/v1/ai_usage_events',
                             headers=_headers(),json=row)
        response.raise_for_status()
    return True

def project_report(owner_id,paper_ids):
    if not enabled():return None
    if not paper_ids:return []
    # Paper IDs are server-derived from a project verified through RLS.
    params={'select':'task_type,input_tokens,output_tokens,total_tokens,status',
            'owner_id':'eq.'+owner_id,'paper_id':'in.('+','.join(paper_ids)+')',
            'limit':'10000'}
    with httpx.Client(timeout=10) as client:
        response=client.get(os.environ['SUPABASE_URL'].rstrip('/')+'/rest/v1/ai_usage_events',
                            headers=_headers(),params=params)
        response.raise_for_status()
        return response.json()
