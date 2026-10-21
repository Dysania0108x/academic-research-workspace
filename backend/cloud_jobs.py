"""Durable owner-scoped job snapshots in Supabase PostgREST.

The backend uses a server-only service-role key for background worker writes.
Never expose that key through VITE_* or browser code.
"""
import json
import os
import httpx

def enabled():
    return bool(os.getenv("SUPABASE_SERVICE_ROLE_KEY") and os.getenv("SUPABASE_URL"))

def _headers():
    key=os.environ["SUPABASE_SERVICE_ROLE_KEY"]
    return {"apikey":key,"Authorization":"Bearer "+key,"Content-Type":"application/json"}

def _url():
    return os.environ["SUPABASE_URL"].rstrip("/")+"/rest/v1/analysis_jobs"

def save(job, snapshot):
    if not enabled():return False
    payload={"id":job["id"],"owner_id":job["owner_id"],"paper_id":job["paper_id"],
             "cache_key":job["cache_key"],"snapshot":snapshot}
    with httpx.Client(timeout=12) as client:
        response=client.post(_url()+"?on_conflict=id",headers={**_headers(),"Prefer":"resolution=merge-duplicates"},json=payload)
        response.raise_for_status()
    return True

def get(job_id, owner_id):
    if not enabled():return None
    with httpx.Client(timeout=12) as client:
        response=client.get(_url(),headers=_headers(),params={
            "select":"snapshot","id":"eq."+job_id,"owner_id":"eq."+owner_id,"limit":"1"})
        response.raise_for_status()
        rows=response.json()
    return rows[0]["snapshot"] if rows else None

def latest(owner_id, cache_key):
    if not enabled():return None
    with httpx.Client(timeout=12) as client:
        response=client.get(_url(),headers=_headers(),params={
            "select":"snapshot","owner_id":"eq."+owner_id,"cache_key":"eq."+cache_key,
            "order":"updated_at.desc","limit":"1"})
        response.raise_for_status()
        rows=response.json()
    return rows[0]["snapshot"] if rows else None
