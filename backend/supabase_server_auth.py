"""Server-only Supabase REST headers for legacy JWT and modern secret API keys."""
import os

def server_key():
    return os.getenv("SUPABASE_SERVICE_ROLE_KEY") or os.getenv("SUPABASE_SECRET_KEY")

def enabled():
    return bool(os.getenv("SUPABASE_URL") and server_key())

def headers():
    key=server_key()
    if not key:
        raise RuntimeError("Supabase server key is missing")
    result={"apikey":key,"Content-Type":"application/json"}
    # Modern sb_secret_ keys are API gateway credentials, not JWTs.
    # Do not send them as Bearer tokens. Legacy service_role JWTs need both.
    if not key.startswith("sb_secret_"):
        result["Authorization"]="Bearer "+key
    return result
