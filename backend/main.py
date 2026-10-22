import os, uuid, json, re, sqlite3, hashlib, time, threading, math
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor
from fastapi import FastAPI, UploadFile, File, HTTPException, Header
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response
from pydantic import BaseModel
import fitz
from openai import OpenAI
from dotenv import load_dotenv
import cloud_jobs
import cloud_usage
load_dotenv(Path(__file__).with_name('.env'))
ROOT=Path(__file__).parent
STORE=ROOT/'uploads'; STORE.mkdir(exist_ok=True)
DB_PATH=ROOT/'research.db'
def db():
    c=sqlite3.connect(DB_PATH, timeout=15)
    c.row_factory=sqlite3.Row
    return c
def init_db():
    with db() as c:
        c.execute('CREATE TABLE IF NOT EXISTS projects (id TEXT PRIMARY KEY, data TEXT NOT NULL, updated_at REAL NOT NULL)')
        c.execute('CREATE TABLE IF NOT EXISTS papers (id TEXT PRIMARY KEY, filename TEXT NOT NULL, sha256 TEXT NOT NULL, pages INTEGER NOT NULL, created_at REAL NOT NULL)')
        c.execute('CREATE TABLE IF NOT EXISTS analysis_cache (cache_key TEXT PRIMARY KEY, paper_id TEXT NOT NULL, theme TEXT NOT NULL, result TEXT NOT NULL, created_at REAL NOT NULL)')
        c.execute('CREATE TABLE IF NOT EXISTS multi_highlight_cache (cache_key TEXT PRIMARY KEY, paper_id TEXT NOT NULL, result TEXT NOT NULL, created_at REAL NOT NULL)')
        c.execute('CREATE TABLE IF NOT EXISTS passage_cache (cache_key TEXT PRIMARY KEY, paper_id TEXT NOT NULL, result TEXT NOT NULL, created_at REAL NOT NULL)')
        c.execute('CREATE TABLE IF NOT EXISTS theme_cache (cache_key TEXT PRIMARY KEY, result TEXT NOT NULL, created_at REAL NOT NULL)')
        c.execute('CREATE TABLE IF NOT EXISTS ai_usage (id INTEGER PRIMARY KEY AUTOINCREMENT, created_at REAL NOT NULL, task_type TEXT NOT NULL, paper_id TEXT, model TEXT, input_tokens INTEGER, output_tokens INTEGER, total_tokens INTEGER, status TEXT NOT NULL, error TEXT)')
        c.execute('CREATE TABLE IF NOT EXISTS analysis_jobs_persisted (id TEXT PRIMARY KEY, owner_id TEXT NOT NULL, paper_id TEXT NOT NULL, cache_key TEXT NOT NULL, snapshot TEXT NOT NULL, updated_at REAL NOT NULL)')
        c.execute('CREATE INDEX IF NOT EXISTS idx_jobs_owner_context ON analysis_jobs_persisted(owner_id, cache_key, updated_at)')
init_db()
app=FastAPI(title='Research Workspace API')
# Set FRONTEND_ORIGINS to comma-separated exact HTTPS origins in production.
# Never combine credentialed CORS with a wildcard origin.
frontend_origins=[origin.strip().rstrip('/') for origin in os.getenv('FRONTEND_ORIGINS','').split(',') if origin.strip()]
app.add_middleware(
    CORSMiddleware,
    allow_origins=['http://localhost:5173','http://127.0.0.1:5173',*frontend_origins],
    # Project-scoped Vercel Preview domains change with each deployment.
    # CORS is not authentication: all protected routes still require JWT ownership checks.
    allow_origin_regex=r'^https://academic-research-workspace(?:-[a-z0-9-]+)?[.]vercel[.]app$',
    allow_methods=['GET','POST','PUT','PATCH','DELETE','OPTIONS'],
    allow_headers=['Authorization','Content-Type'],
)
# V6.3: all API calls except the non-sensitive health probe require a valid
# Supabase access token. Project/paper ownership enforcement is a separate
# requirement before multi-user release.
from cloud_auth import authenticated_user

@app.middleware("http")
async def require_api_session(request, call_next):
    """Authorize all project and paper endpoints before any local file access."""
    # Browser CORS preflight has no bearer token. Let CORSMiddleware answer it;
    # actual API requests still require authenticated ownership checks.
    if request.method == "OPTIONS" or not request.url.path.startswith("/api/") or request.url.path == "/api/health":
        return await call_next(request)
    from fastapi.responses import JSONResponse
    from cloud_auth import require_project_owner
    try:
        token = request.headers.get("authorization")
        user_id = authenticated_user(token)
        path = request.url.path
        project_match = re.match(r"^/api/projects/([^/]+)", path)
        if project_match:
            require_project_owner(project_match.group(1), token)
        if path == '/api/projects' or path.startswith('/api/projects/')  :
            raise HTTPException(410, 'Legacy unscoped endpoint disabled')
        # Do not let paper deletion race against an unrelated user's local cache.
        # Existing files are globally named, so ownership is checked before deletion.
        paper_ids = []
        paper_match = re.match(r"^/api/papers/([^/]+)", path)
        if paper_match:
            paper_ids.append(paper_match.group(1))
        if path in ("/api/analyse", "/api/analyse/start", "/api/passage"):
            payload = await request.body()
            try:
                paper_ids.append(json.loads(payload).get("paper_id"))
            except (ValueError, TypeError):
                raise HTTPException(422, "Invalid JSON payload")
            # Replaying the request body requires restoring its ASGI receive channel.
            async def receive():
                return {"type": "http.request", "body": payload, "more_body": False}
            request._receive = receive
        if path == "/api/themes/suggest":
            payload = await request.body()
            try:
                paper_ids.extend(json.loads(payload).get("paper_ids", []))
            except (ValueError, TypeError):
                raise HTTPException(422, "Invalid JSON payload")
            async def receive():
                return {"type": "http.request", "body": payload, "more_body": False}
            request._receive = receive
        if path == "/api/analyse/papers/" or path.startswith("/api/analyse/papers/"):
            match = re.match(r"^/api/analyse/papers/([^/]+)/job", path)
            if match: paper_ids.append(match.group(1))
        if paper_ids:
            # Use the caller's RLS-restricted project rows as the authorization source.
            import httpx
            from cloud_auth import _configuration
            url, key = _configuration()
            with httpx.Client(timeout=8.0) as client:
                resp = client.get(f"{url}/rest/v1/projects",
                    params={"select":"id,data", "user_id":f"eq.{user_id}"},
                    headers={"apikey":key,"Authorization":token})
            if resp.status_code != 200:
                raise HTTPException(503, "Unable to verify paper ownership")
            owned = {str(p.get("id")): (str(row.get("id")), p)
                     for row in resp.json()
                     for p in (row.get("data") or {}).get("papers", [])
                     if isinstance(p, dict)}
            if any(not isinstance(pid,str) or pid not in owned for pid in paper_ids):
                raise HTTPException(404, "Paper not found")
            # Restore absent local PDFs from the owner's private Supabase Storage.
            # The bearer token is forwarded, preserving Storage RLS.
            for pid in paper_ids:
                target = STORE / (pid + ".pdf")
                if target.exists(): continue
                project_id, metadata = owned[pid]
                from cloud_auth import private_pdf_path
                expected = private_pdf_path(user_id, project_id, pid)
                if metadata.get("storagePath") != expected:
                    raise HTTPException(404, "Cloud PDF unavailable")
                from urllib.parse import quote
                with httpx.Client(timeout=30.0) as client:
                    download = client.get(
                        f"{url}/storage/v1/object/authenticated/research-pdfs/{quote(expected, safe='/')}",
                        headers={"apikey":key,"Authorization":token})
                if download.status_code != 200:
                    raise HTTPException(404, "Unable to restore authorized cloud PDF")
                content = download.content
                if len(content) > 20*1024*1024 or not content.startswith(b"%PDF-"):
                    raise HTTPException(422, "Invalid cloud PDF")
                with fitz.open(stream=content, filetype="pdf") as doc:
                    if doc.is_encrypted or not blocks_for(doc):
                        raise HTTPException(422, "Cloud PDF has no readable text")
                    pages = len(doc)
                sha = hashlib.sha256(content).hexdigest()
                # Write atomically so a failed download never leaves a partial PDF.
                import tempfile
                temporary = None
                try:
                    with tempfile.NamedTemporaryFile(
                        mode="wb", suffix=".pdf", prefix="restore-",
                        dir=STORE, delete=False
                    ) as output:
                        temporary = Path(output.name)
                        output.write(content)
                    temporary.replace(target)
                    with db() as conn:
                        conn.execute("INSERT OR REPLACE INTO papers VALUES(?,?,?,?,?)",
                            (pid, metadata.get("name") or pid+".pdf", sha, pages, time.time()))
                finally:
                    if temporary is not None:
                        temporary.unlink(missing_ok=True)
        # New uploads must be bound to an existing project; unaffiliated uploads
        # would otherwise create unowned local files.
        if path == "/api/papers" and request.method == "POST":
            project_id = request.query_params.get("project_id")
            if not project_id:
                raise HTTPException(422, "project_id required for upload")
            require_project_owner(project_id, token)
        job_match = re.match(r"^/api/analyse/jobs/([^/]+)", path)
        if job_match:
            with analysis_lock:
                job = analysis_jobs.get(job_match.group(1))
                if job and job.get("owner_id") != user_id:
                    raise HTTPException(404, "Analysis job not found")
                if not job and not _load_job(job_match.group(1), user_id):
                    raise HTTPException(404, "Analysis job not found")
        return await call_next(request)
    except HTTPException as exc:
        return JSONResponse(status_code=exc.status_code, content={"detail":exc.detail})

class ProjectPayload(BaseModel):
    id: str
    data: dict

@app.get('/api/projects')
def list_projects():
    with db() as c:
        return {'projects':[json.loads(r['data']) for r in c.execute('SELECT data FROM projects ORDER BY updated_at DESC')]}

@app.put('/api/projects/{project_id}')
def save_project(project_id:str, payload:dict):
    if payload.get('id')!=project_id: raise HTTPException(400,'Project ID mismatch')
    def evidence_key(item):
        quote=' '.join(str(item.get('quote') or item.get('text') or '').split()).casefold()
        return (str(item.get('paperId') or ''),str(item.get('page') or ''),quote)
    with db() as c:
        previous=c.execute('SELECT data FROM projects WHERE id=?',(project_id,)).fetchone()
        previous_records=json.loads(previous['data']).get('evidence',[]) if previous else []
        old_ids={str(e.get('id')) for e in previous_records if isinstance(e,dict)}
        seen=set()
        for record in payload.get('evidence',[]):
            if not isinstance(record,dict):raise HTTPException(422,'Invalid evidence record')
            key=evidence_key(record)
            if not key[0] or not key[2]:continue
            if key in seen and str(record.get('id')) not in old_ids:
                raise HTTPException(409,'Evidence already saved for this PDF passage')
            seen.add(key)
        c.execute('INSERT INTO projects(id,data,updated_at) VALUES(?,?,?) ON CONFLICT(id) DO UPDATE SET data=excluded.data, updated_at=excluded.updated_at',(project_id,json.dumps(payload),time.time()))
    return {'ok':True}

@app.delete('/api/projects/{project_id}')
def delete_project(project_id:str):
    with db() as c:
        c.execute('DELETE FROM projects WHERE id=?',(project_id,))
    return {'ok':True}

@app.delete('/api/papers/{paper_id}')
def delete_paper(paper_id:str):
    with db() as c:
        c.execute('DELETE FROM papers WHERE id=?',(paper_id,))
        c.execute('DELETE FROM analysis_cache WHERE paper_id=?',(paper_id,))
        c.execute('DELETE FROM multi_highlight_cache WHERE paper_id=?',(paper_id,))
        c.execute('DELETE FROM passage_cache WHERE paper_id=?',(paper_id,))
    (STORE/(paper_id+'.pdf')).unlink(missing_ok=True)
    return {'ok':True}

class AnalysisRequest(BaseModel):
    paper_id:str
    question:str
    themes:list[str]
class ThemeRequest(BaseModel):
    question:str
    topics:list[str]=[]
    paper_ids:list[str]=[]
class PassageRequest(BaseModel):
    paper_id:str
    block_id:str
    question:str
    theme:str

def get_doc(paper_id):
    path=STORE/(paper_id+'.pdf')
    if not path.exists(): raise HTTPException(404,'PDF not found. Re-upload after restarting the backend.')
    return fitz.open(path)
def blocks_for(doc):
    result=[]
    for page_no,page in enumerate(doc):
        for j,b in enumerate(page.get_text('blocks')):
            if len(b)<5 or len(b[4].strip())<35: continue
            text=' '.join(b[4].split())
            result.append({'id':f'{page_no}:{j}','page':page_no+1,'text':text[:1400], 'rect':[round(b[k],2) for k in range(4)]})
    return result

def line_rectangles(doc,block_id):
    try:
        page_i,block_i=map(int,block_id.split(':'))
        blocks=doc[page_i].get_text('dict')['blocks']
        block=blocks[block_i]
        return [[round(v,2) for v in line['bbox']] for line in block.get('lines',[]) if any(span.get('text','').strip() for span in line.get('spans',[]))]
    except (ValueError, IndexError, KeyError, TypeError):
        return []

PROMPT_VERSION='v06-precise-20261020'
def fingerprint(*values):
    return hashlib.sha256(json.dumps(values,sort_keys=True,ensure_ascii=False).encode('utf-8')).hexdigest()
def cache_get(table,key):
    with db() as c:
        row=c.execute(f'SELECT result FROM {table} WHERE cache_key=?',(key,)).fetchone()
    return json.loads(row['result']) if row else None
def cache_put(table,key,result,paper_id=None,theme=None):
    with db() as c:
        if table=='analysis_cache':
            c.execute('INSERT OR REPLACE INTO analysis_cache VALUES(?,?,?,?,?)',(key,paper_id,theme,json.dumps(result,ensure_ascii=False),time.time()))
        elif table=='multi_highlight_cache':
            c.execute('INSERT OR REPLACE INTO multi_highlight_cache VALUES(?,?,?,?)',(key,paper_id,json.dumps(result,ensure_ascii=False),time.time()))
        elif table=='passage_cache':
            c.execute('INSERT OR REPLACE INTO passage_cache VALUES(?,?,?,?)',(key,paper_id,json.dumps(result,ensure_ascii=False),time.time()))
        else:
            c.execute('INSERT OR REPLACE INTO theme_cache VALUES(?,?,?)',(key,json.dumps(result,ensure_ascii=False),time.time()))
def paper_sha(paper_id):
    with db() as c:
        row=c.execute('SELECT sha256 FROM papers WHERE id=?',(paper_id,)).fetchone()
    if not row: raise HTTPException(404,'Paper not found')
    # Include the unique paper ID so shared SQLite caches cannot mix accounts
    # that uploaded identical PDF bytes.
    return hashlib.sha256((paper_id + ':' + row['sha256']).encode()).hexdigest()

def mock_mode():
    return os.getenv('AI_MOCK_MODE','false').strip().lower() in ('1','true','yes','on')

def ai_provider():
    provider=os.getenv('AI_PROVIDER','bailian').strip().lower()
    if provider not in ('bailian','qwen','deepseek'):
        raise HTTPException(503,'AI_PROVIDER must be bailian, qwen or deepseek')
    return provider

def active_model():
    if mock_mode():return 'mock-deterministic-v1'
    if ai_provider()=='bailian':return os.getenv('BAILIAN_MODEL') or os.getenv('QWEN_MODEL') or 'deepseek-v4.1-flash'
    if ai_provider()=='deepseek':return os.getenv('DEEPSEEK_MODEL','deepseek-chat')
    return os.getenv('QWEN_MODEL','qwen-plus')

def ai_client_config():
    if ai_provider() in ('bailian','qwen'):
        key=os.getenv('DASHSCOPE_API_KEY')
        if not key:raise HTTPException(503,'Set DASHSCOPE_API_KEY on the backend server')
        return key,os.getenv('QWEN_BASE_URL','https://dashscope-intl.aliyuncs.com/compatible-mode/v1')
    key=os.getenv('DEEPSEEK_API_KEY')
    if not key:raise HTTPException(503,'Set DEEPSEEK_API_KEY on the backend server')
    return key,'https://api.deepseek.com'

def _mock_response(messages,task_type):
    """Deterministic contract-compatible responses; never call a remote model."""
    try:
        payload=json.loads(next((m['content'] for m in reversed(messages) if m.get('role')=='user'),'{}'))
    except (ValueError,TypeError):
        payload={}
    if task_type=='highlight':
        themes=payload.get('themes') or [payload.get('theme','Research Theme')]
        matches=[]
        for block in payload.get('pdf_blocks',[]):
            content=' '.join(str(block.get('text','')).split())
            if len(content)<35:continue
            # Choose an exact substring with no model hallucination.
            words=content.split()
            quote=' '.join(words[:min(18,len(words))])
            if len(quote)<18:continue
            matches.append({'block_id':block['id'],'quote':quote,'theme':themes[len(matches)%len(themes)],
                            'reason':'Mock candidate for testing source verification; not a research finding.'})
            if len(matches)>=min(6,max(2,len(themes)*2)):break
        return {'matches':matches}
    if task_type=='passage':
        passage=str(payload.get('original_passage',''))
        return {'interpretation':'[MOCK] Review this original passage before drawing a conclusion: '+passage[:170],
                'relevance':'[MOCK] Relevance is not evaluated. Compare the source with your research question.',
                'limitations':'[MOCK] Synthetic response for UX testing; not a scientific assessment.'}
    if task_type=='theme_suggestion':
        topics=[str(x).strip() for x in payload.get('user_topics',[]) if str(x).strip()]
        themes=list(dict.fromkeys(topics+['Research Context','Evidence Quality','Research Limitations']))[:6]
        return {'themes':[{'name':t,'basis':'[MOCK] Illustrative theme for testing selection and editing.',
                           'source_block_ids':[]} for t in themes]}
    if task_type=='network':
        evidence=payload.get('evidence',[])
        if len(evidence)<2:return {'links':[]}
        return {'links':[{'source_id':evidence[0]['id'],'target_id':evidence[1]['id'],
                          'relationship':'Related','rationale':'[MOCK] Example relationship for review-flow testing only; no academic claim is implied.'}]}
    if task_type=='synthesis':
        evidence=payload.get('verified_evidence',[])
        ids=[e['id'] for e in evidence if e.get('id')]
        return {'insights':[{'text':'[MOCK] Example insight for interface testing, not a research conclusion.',
                             'evidence_ids':ids[:2]}],
                'gaps':[{'text':'[MOCK] Example gap in the current library; not a field-wide research gap.',
                         'evidence_ids':ids[:1]}]}
    return {}

def ask(messages,task_type='other',paper_id=None,timeout_seconds=None,owner_id=None):
    if mock_mode():return _mock_response(messages,task_type)
    key,base_url=ai_client_config()
    model=active_model()
    client=OpenAI(api_key=key,base_url=base_url,timeout=float(timeout_seconds or os.getenv('AI_TIMEOUT_SECONDS','120')),max_retries=0)
    usage=(None,None,None);status='success';error=None
    try:
        res=client.chat.completions.create(model=model,messages=messages,temperature=0.1,response_format={'type':'json_object'})
        u=res.usage
        if u: usage=(u.prompt_tokens,u.completion_tokens,u.total_tokens)
        return json.loads(res.choices[0].message.content or '{}')
    except Exception as exc:
        # Classify provider errors without exposing response bodies, prompts or secrets.
        code=getattr(exc,'status_code',None)
        kind=type(exc).__name__.lower()
        if code in (401,403): category='upstream_auth'
        elif code==404: category='model_or_endpoint'
        elif code==429: category='rate_limited_or_quota'
        elif code==400: category='unsupported_request'
        elif code in (408,504) or 'timeout' in kind: category='upstream_timeout'
        elif isinstance(exc,json.JSONDecodeError): category='invalid_json'
        else: category='upstream_error'
        status='error';error=f'{category} (provider HTTP {code or "unknown"})'
        raise HTTPException(502,'AI request failed: '+error) from None
    finally:
        with db() as c:
            c.execute('INSERT INTO ai_usage(created_at,task_type,paper_id,model,input_tokens,output_tokens,total_tokens,status,error) VALUES(?,?,?,?,?,?,?,?,?)',(time.time(),task_type,paper_id,model,*usage,status,error))
        if owner_id and cloud_usage.enabled():
            try:
                cloud_usage.record(owner_id=owner_id,paper_id=paper_id,task_type=task_type,
                                   model=model,usage=usage,status=status)
            except Exception:
                # Do not fail a successful AI response because metering is unavailable.
                import logging
                logging.getLogger(__name__).exception('Durable AI usage write failed')

@app.get('/api/usage')
def usage_stats(project_id: str | None = None, authorization: str | None = Header(default=None)):
    if not project_id:
        raise HTTPException(422,'Project ID required for scoped usage report')
    from cloud_auth import require_project_owner, _configuration
    import httpx
    user_id=require_project_owner(project_id,authorization)
    url,key=_configuration()
    with httpx.Client(timeout=8.0) as client:
        response=client.get(url+'/rest/v1/projects',params={'select':'data','id':'eq.'+project_id,'user_id':'eq.'+user_id,'limit':'1'},
                            headers={'apikey':key,'Authorization':authorization})
    if response.status_code!=200 or not response.json():
        raise HTTPException(503,'Unable to read project usage scope')
    papers=(response.json()[0].get('data') or {}).get('papers',[])
    paper_ids=[str(p['id']) for p in papers if isinstance(p,dict) and p.get('id')]
    if not cloud_usage.enabled():
        raise HTTPException(503,'Durable usage storage is not configured')
    try:
        events=cloud_usage.project_report(user_id,paper_ids)
    except Exception:
        raise HTTPException(503,'Durable usage storage unavailable; verify database migration')
    grouped={}
    for event in events:
        task=event['task_type']
        row=grouped.setdefault(task,{'task_type':task,'requests':0,'input_tokens':0,
                                     'output_tokens':0,'total_tokens':0,'errors':0})
        row['requests']+=1
        for field in ('input_tokens','output_tokens','total_tokens'):
            row[field]+=int(event.get(field) or 0)
        row['errors']+=int(event.get('status')=='error')
    rows=sorted(grouped.values(),key=lambda item:item['task_type'])
    return {'by_task':rows,'total_tokens':sum(row['total_tokens'] for row in rows),
            'requests':sum(row['requests'] for row in rows),
            'note':'Durable events recorded after migration only; cached results use no new tokens.',
            'scope':'project','durable':True}

@app.get('/api/health')
def health(): return {'ok':True,'ai_configured':(bool(os.getenv('DEEPSEEK_API_KEY')) if ai_provider()=='deepseek' else bool(os.getenv('DASHSCOPE_API_KEY'))) or mock_mode(),'mock_mode':mock_mode(),'ai_provider':ai_provider(),'ai_model':active_model()}

def extract_paper_metadata(doc):
    """Conservative PDF metadata: no guessed journal, author, or publication year."""
    raw=doc.metadata or {}
    first=(doc[0].get_text('text')[:3500] if len(doc) else '')
    title=str(raw.get('title') or '').strip()
    author=str(raw.get('author') or '').strip()
    if title.lower() in ('untitled','microsoft word','document','none') or title.lower().endswith('.pdf'):
        title=''
    doi_match=re.search(r'\b10\.\d{4,9}/[-._;()/:A-Za-z0-9]+\b',first,re.I)
    doi=doi_match.group(0).rstrip('.,;)') if doi_match else ''
    return {'title':title,'authors':author,'year':'','venue':'','doi':doi,'url':'https://doi.org/'+doi if doi else '',
            'metadata_status':'unverified'}

@app.get('/api/papers/{paper_id}/metadata')
def paper_metadata(paper_id:str):
    with get_doc(paper_id) as doc:
        return extract_paper_metadata(doc)

class LocateRequest(BaseModel):
    page:int
    quote:str
    block_rect:list[float]|None=None

@app.post('/api/papers/{paper_id}/locate')
def locate_quote(paper_id:str,req:LocateRequest):
    with get_doc(paper_id) as doc:
        if req.page<1 or req.page>len(doc):raise HTTPException(404,'Page not found')
        page=doc[req.page-1]
        rects=exact_quote_rectangles(page,req.quote,req.block_rect or list(page.rect))
        if not rects:
            return {'found':False,'page':req.page,'rects':[],'message':'Exact quotation not located; showing source page only.'}
        return {'found':True,'page':req.page,'rects':rects}

@app.post('/api/papers')
async def upload(file:UploadFile=File(...), project_id: str | None = None, authorization: str | None = Header(default=None)):
    from cloud_auth import require_project_owner
    if not project_id: raise HTTPException(422,'Project ID required for PDF upload')
    require_project_owner(project_id, authorization)
    if not file.filename or not file.filename.lower().endswith('.pdf'): raise HTTPException(400,'Only PDFs supported')
    data=await file.read(20*1024*1024+1)
    if len(data)>20*1024*1024: raise HTTPException(413,'PDF must be under 20MB')
    sha=hashlib.sha256(data).hexdigest()
    # Never reuse a global paper ID across users/projects, even for identical bytes.
    pid=str(uuid.uuid4()); path=STORE/(pid+'.pdf')
    path.write_bytes(data)
    try:
        with fitz.open(path) as doc:
            if doc.is_encrypted: raise ValueError('Password-protected PDF')
            blocks=blocks_for(doc)
            if not blocks: raise ValueError('No extractable text. Scanned PDFs require OCR.')
            pages=len(doc)
            metadata=extract_paper_metadata(doc)
    except Exception as e:
        path.unlink(missing_ok=True);raise HTTPException(422,str(e))
    with db() as c:
        c.execute('INSERT INTO papers VALUES(?,?,?,?,?)',(pid,file.filename,sha,pages,time.time()))
    return {'id':pid,'name':file.filename,'pages':pages,'blocks':len(blocks),'duplicate':False,**metadata}
@app.get('/api/projects/{project_id}/highlight-candidates')
def highlight_candidates(project_id:str):
    """Return cached AI candidates for the project's papers, including after backend restart.
    Cache may contain previous research contexts; candidates are not automatically verified.
    """
    with db() as c:
        row=c.execute('SELECT data FROM projects WHERE id=?',(project_id,)).fetchone()
        if not row:raise HTTPException(404,'Project not found')
        project=json.loads(row['data'])
        papers={str(p['id']) for p in project.get('papers',[]) if p.get('id')}
        candidates={}
        if papers:
            placeholders=','.join('?' for _ in papers)
            rows=c.execute(f'SELECT paper_id,result,created_at FROM multi_highlight_cache WHERE paper_id IN ({placeholders}) ORDER BY created_at DESC',tuple(papers)).fetchall()
            for cached in rows:
                try:items=json.loads(cached['result'])
                except (ValueError,TypeError):continue
                if isinstance(items,dict):items=items.get('matches',[])
                if not isinstance(items,list):continue
                for item in items:
                    if not isinstance(item,dict):continue
                    quote=' '.join(str(item.get('quote') or item.get('text') or '').split())
                    if not quote:continue
                    key=(cached['paper_id'],str(item.get('page') or ''),quote.casefold())
                    if key not in candidates:
                        candidates[key]={**item,'paperId':cached['paper_id'],'quote':quote}
        return {'candidates':list(candidates.values()),'cached_context_warning':'Cached candidates may reflect earlier research questions, themes, or models.'}

@app.get('/api/papers/{paper_id}/blocks')
def blocks(paper_id:str):
    with get_doc(paper_id) as doc:
        return {'blocks':blocks_for(doc),'pages':[{'width':round(p.rect.width,2),'height':round(p.rect.height,2)} for p in doc]}
@app.get('/api/papers/{paper_id}/file')
def original_pdf(paper_id:str):
    with get_doc(paper_id) as doc:
        return Response((STORE/(paper_id+'.pdf')).read_bytes(),media_type='application/pdf',headers={'Content-Disposition':'inline'})

@app.get('/api/papers/{paper_id}/pages/{page_num}/image')
def page_image(paper_id:str,page_num:int,scale:float=1.7):
    with get_doc(paper_id) as doc:
        if page_num<1 or page_num>len(doc):raise HTTPException(404,'Page not found')
        scale=max(1.2,min(3.0,scale))
        pix=doc[page_num-1].get_pixmap(matrix=fitz.Matrix(scale,scale),alpha=False)
        # JPEG reduces transfer size for remote readers; source PDF remains unchanged.
        return Response(pix.tobytes('jpeg',jpg_quality=85),media_type='image/jpeg',
                        headers={'Cache-Control':'private, max-age=300'})
def exact_quote_rectangles(page, quote, block_rect):
    """Return verified PDF quads only; never fall back to whole text blocks."""
    quote=' '.join(str(quote).split()).strip()
    if len(quote)<18 or len(quote)>260: return []
    # Search exact source text; PyMuPDF handles line breaks/hyphenation in most text PDFs.
    candidates=page.search_for(quote, quads=True)
    target=fitz.Rect(block_rect)
    found=[]
    for quad in candidates:
        r=quad.rect
        intersection=r & target
        if not intersection.is_empty and intersection.get_area()>=r.get_area()*0.65:
            found.append([round(r.x0,2),round(r.y0,2),round(r.x1,2),round(r.y1,2)])
    return found[:8]

@app.post('/api/analyse')
def analyse(req:AnalysisRequest):
    with get_doc(req.paper_id) as doc: blocks=blocks_for(doc)
    themes=list(dict.fromkeys(t.strip() for t in req.themes if t.strip()))
    if not themes: raise HTTPException(422,'Add or confirm research themes first.')
    by_id={b['id']:b for b in blocks}
    sha=paper_sha(req.paper_id);model=active_model()
    matches=[];cached_themes=[];analysed_themes=[]
    for theme in themes:
        key=fingerprint('precise-highlight',PROMPT_VERSION,sha,req.question.strip(),theme,model)
        cached=cache_get('analysis_cache',key)
        if cached is not None:
            matches.extend(cached);cached_themes.append(theme);continue
        selected=[];seen_quotes=set();page_counts={}
        for start in range(0,len(blocks),30):
            batch=blocks[start:start+30]
            compact=[{'id':b['id'],'page':b['page'],'text':b['text'][:1200]} for b in batch]
            data=ask([{'role':'system','content':('You are a selective academic evidence highlighter. Return ONLY JSON {"matches":[{"block_id":"0:1","quote":"exact verbatim contiguous source phrase","reason":"short relevance reason"}]}. Select at most 4 key evidence quotes PER BATCH for the specified theme. Each quote MUST be copied exactly from one supplied block, 18-180 characters, ideally a single sentence or meaningful clause. Prioritise concrete findings, numbers and limitations. Exclude headings, hypotheses mistaken for results, general background, repeated points and speculative content. It is fine to return zero matches. Never paraphrase the quote.')},{'role':'user','content':json.dumps({'research_question':req.question,'theme':theme,'pdf_blocks':compact},ensure_ascii=False)}],task_type='highlight',paper_id=req.paper_id)
            for item in data.get('matches',[])[:6]:
                bid=item.get('block_id');quote=str(item.get('quote','')).strip()
                if bid not in by_id or bid not in {x['id'] for x in batch}: continue
                if not 18<=len(quote)<=220:continue
                block=by_id[bid]
                # Strict source verification: reject model-generated text and unsupported quotes.
                if ' '.join(quote.split()).casefold() not in block['text'].casefold():continue
                qkey=(block['page'],quote.casefold())
                if qkey in seen_quotes or page_counts.get(block['page'],0)>=5:continue
                with get_doc(req.paper_id) as doc:
                    rects=exact_quote_rectangles(doc[block['page']-1],quote,block['rect'])
                if not rects:continue
                seen_quotes.add(qkey);page_counts[block['page']]=page_counts.get(block['page'],0)+1
                selected.append({'id':bid,'page':block['page'],'text':quote,'quote':quote,'theme':theme,'reason':str(item.get('reason',''))[:300],'rects':rects,'rect':block['rect']})
        cache_put('analysis_cache',key,selected,req.paper_id,theme)
        matches.extend(selected);analysed_themes.append(theme)
    return {'matches':matches,'analysed_blocks':len(blocks),'cached_themes':cached_themes,'analysed_themes':analysed_themes,'cache_hit':not analysed_themes,'precision_mode':'exact_quote','batches_per_theme':(len(blocks)+29)//30}

# Fast multi-theme analysis jobs. Jobs live in memory; completed batches persist in SQLite.
HIGHLIGHT_ENGINE_VERSION='multitheme-v1'
analysis_pool=ThreadPoolExecutor(max_workers=2)
analysis_jobs={}
analysis_lock=threading.Lock()

def _job_snapshot(job):
    return {k:v for k,v in job.items() if k not in ('cancel_event','cache_key','request')}

def _persist_job(job):
    snapshot=_job_snapshot(job)
    if cloud_jobs.save(job,snapshot):return
    with db() as c:
        c.execute('INSERT INTO analysis_jobs_persisted(id,owner_id,paper_id,cache_key,snapshot,updated_at) VALUES(?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET snapshot=excluded.snapshot,updated_at=excluded.updated_at',
                  (job['id'],job['owner_id'],job['paper_id'],job['cache_key'],json.dumps(snapshot,ensure_ascii=False),time.time()))

def _load_job(job_id, owner_id):
    if cloud_jobs.enabled():
        snapshot=cloud_jobs.get(job_id,owner_id)
        if snapshot and snapshot.get('status') in ('queued','running'):
            snapshot.update(status='interrupted',message='Worker stopped; restart analysis to retry',batch_started_at=None)
        return snapshot
    with db() as c:
        row=c.execute('SELECT snapshot FROM analysis_jobs_persisted WHERE id=? AND owner_id=?',(job_id,owner_id)).fetchone()
    if not row:return None
    snapshot=json.loads(row['snapshot'])
    if snapshot.get('status') in ('queued','running'):
        snapshot.update(status='interrupted',message='Server restarted; start analysis again to resume from cached batches',batch_started_at=None)
    return snapshot

def _latest_persisted_job(owner_id, identity):
    if cloud_jobs.enabled():
        snapshot=cloud_jobs.latest(owner_id,identity)
        if snapshot and snapshot.get('status') in ('queued','running'):
            snapshot.update(status='interrupted',message='Worker stopped; restart analysis to retry',batch_started_at=None)
        return snapshot
    with db() as c:
        row=c.execute('SELECT snapshot FROM analysis_jobs_persisted WHERE owner_id=? AND cache_key=? ORDER BY updated_at DESC LIMIT 1',(owner_id,identity)).fetchone()
    if not row:return None
    snapshot=json.loads(row['snapshot'])
    if snapshot.get('status') in ('queued','running'):
        snapshot.update(status='interrupted',message='Server restarted; start analysis again to resume from cached batches',batch_started_at=None)
    return snapshot

def _set_job(job, **changes):
    with analysis_lock:
        if job['cancel_event'].is_set() and changes.get('status') != 'cancelled':
            return
        job.update(changes)
        _persist_job(job)

def _analyse_job(job, req):
    try:
        with get_doc(req.paper_id) as doc:
            blocks=blocks_for(doc)
        themes=list(dict.fromkeys(t.strip() for t in req.themes if t.strip()))
        sha=paper_sha(req.paper_id)
        model=active_model()
        # Smaller calls bound latency; the cache fingerprint includes the batch content.
        batch_size=max(5,min(36,int(os.getenv('HIGHLIGHT_BATCH_BLOCKS','12'))))
        total=max(1,math.ceil(len(blocks)/batch_size))
        _set_job(job,total_batches=total,status='running',message='Analysing PDF for all themes together')
        all_matches=[]
        failed_batches=[]
        for index,start in enumerate(range(0,len(blocks),batch_size)):
            if job['cancel_event'].is_set():
                _set_job(job,status='cancelled',message='Analysis stopped; completed batches are cached')
                return
            batch=blocks[start:start+batch_size]
            compact=[{'id':b['id'],'page':b['page'],'text':b['text'][:1200]} for b in batch]
            batch_key=fingerprint(HIGHLIGHT_ENGINE_VERSION,sha,req.question.strip(),themes,model,index,compact)
            result=cache_get('multi_highlight_cache',batch_key)
            if result is None:
                started_at=time.monotonic()
                _set_job(job,message=f'Analysing batch {index+1} of {total}',batch_started_at=time.time())
                try:
                    data=ask([
                    {'role':'system','content':(
                        'You are a precise, selective academic evidence highlighter. '
                        'Return only JSON {"matches":[{"block_id":"0:1","quote":"verbatim contiguous phrase","theme":"one exact supplied theme","reason":"brief reason"}]}. '
                        'Analyse ALL supplied themes in this ONE response. Choose at most 8 important quotes across ALL themes per batch. '
                        'Quotes must be copied exactly from the supplied text, between 18 and 180 characters. '
                        'Prefer concrete findings and limitations, not headings, general background or hypotheses presented as results. '
                        'Never invent or paraphrase quotes. Returning zero matches is valid.'
                    )},
                    {'role':'user','content':json.dumps({'research_question':req.question,'themes':themes,'pdf_blocks':compact},ensure_ascii=False)}
                ],task_type='highlight',paper_id=req.paper_id,timeout_seconds=float(os.getenv('HIGHLIGHT_TIMEOUT_SECONDS','90')),owner_id=job['owner_id'])
                except HTTPException as exc:
                    if job['cancel_event'].is_set():return
                    failed_batches.append(index+1)
                    detail=str(exc.detail)
                    known=('upstream_auth','model_or_endpoint','rate_limited_or_quota',
                           'unsupported_request','upstream_timeout','invalid_json','upstream_error')
                    category=next((name for name in known if name in detail),
                                  'missing_api_key' if exc.status_code==503 else 'upstream_error')
                    errors=[*job.get('batch_errors',[]),{'batch':index+1,'category':category}]
                    _set_job(job,completed_batches=index+1,
                             message=f'Batch {index+1}/{total} failed ({category}); continuing',
                             failed_batches=list(failed_batches),batch_errors=errors,batch_started_at=None)
                    continue
                result=[]
                allowed_ids={b['id'] for b in batch}
                seen=set()
                with get_doc(req.paper_id) as doc:
                    for item in data.get('matches',[])[:12]:
                        if not isinstance(item,dict):continue
                        bid=item.get('block_id')
                        theme=item.get('theme')
                        quote=str(item.get('quote','')).strip()
                        if bid not in allowed_ids or theme not in themes or not 18<=len(quote)<=220:continue
                        block=next(b for b in batch if b['id']==bid)
                        if ' '.join(quote.split()).casefold() not in block['text'].casefold():continue
                        duplicate=(block['page'],quote.casefold())
                        if duplicate in seen:continue
                        rects=exact_quote_rectangles(doc[block['page']-1],quote,block['rect'])
                        if not rects:continue
                        seen.add(duplicate)
                        result.append({'id':bid,'page':block['page'],'text':quote,'quote':quote,'theme':theme,'reason':str(item.get('reason',''))[:300],'rects':rects,'rect':block['rect']})
                # Never cache an API response that arrived after cancellation.
                if job['cancel_event'].is_set():return
                cache_put('multi_highlight_cache',batch_key,result,req.paper_id)
            if job['cancel_event'].is_set():return
            all_matches.extend(result)
            _set_job(job,completed_batches=index+1,matches=list(all_matches),batch_started_at=None,failed_batches=list(failed_batches),message=f'{index+1} of {total} batches completed')
        if job['cancel_event'].is_set():
            _set_job(job,status='cancelled',message='Analysis stopped; completed batches are cached')
        else:
            _set_job(job,status='completed' if not failed_batches else 'partial',message='Highlighting complete' if not failed_batches else f'Partial results: {len(failed_batches)} batches failed. Run analysis again to retry uncached batches.',matches=all_matches,failed_batches=list(failed_batches),batch_started_at=None)
    except Exception as exc:
        _set_job(job,status='failed',error=str(getattr(exc,'detail',exc))[:400],message='Analysis failed; completed batches remain cached')

@app.post('/api/analyse/start')
def start_analysis(req:AnalysisRequest, authorization: str | None = Header(default=None)):
    owner_id=authenticated_user(authorization)
    themes=list(dict.fromkeys(t.strip() for t in req.themes if t.strip()))
    if not themes:raise HTTPException(422,'Add research themes first')
    if not req.question.strip():raise HTTPException(422,'Research question required')
    sha=paper_sha(req.paper_id)
    identity=fingerprint(owner_id,HIGHLIGHT_ENGINE_VERSION,sha,req.question.strip(),themes,active_model())
    with analysis_lock:
        for job in analysis_jobs.values():
            if job['cache_key']==identity and job['status'] in ('queued','running'):
                return _job_snapshot(job)
        # Reuse finished jobs when all batches succeeded; a partial job may be retried.
        for job in reversed(list(analysis_jobs.values())):
            if job['cache_key']==identity and job['status']=='completed':
                return _job_snapshot(job)
        # Limit in-memory job history.
        for old_id in list(analysis_jobs)[:-40]:
            if analysis_jobs[old_id]['status'] not in ('queued','running'):
                analysis_jobs.pop(old_id,None)
        job={'id':str(uuid.uuid4()),'owner_id':owner_id,'paper_id':req.paper_id,'question':req.question.strip(),'themes':themes,'cache_key':identity,'status':'queued','message':'Queued','completed_batches':0,'total_batches':0,'matches':[],'failed_batches':[],'batch_started_at':None,'error':None,'cancel_event':threading.Event()}
        analysis_jobs[job['id']]=job
        _persist_job(job)
    analysis_pool.submit(_analyse_job,job,req)
    return _job_snapshot(job)

@app.get('/api/analyse/papers/{paper_id}/job')
def get_paper_analysis_job(paper_id:str, question:str, themes:str, authorization: str | None = Header(default=None)):
    """Reconnect to the latest job for this exact paper and research context."""
    sha=paper_sha(paper_id)
    try:
        theme_list=json.loads(themes)
    except (ValueError,TypeError):
        raise HTTPException(422,'Invalid themes parameter')
    if not isinstance(theme_list,list):
        raise HTTPException(422,'Themes must be an array')
    normalized=list(dict.fromkeys(str(t).strip() for t in theme_list if str(t).strip()))
    identity=fingerprint(authenticated_user(authorization),HIGHLIGHT_ENGINE_VERSION,sha,question.strip(),normalized,active_model())
    with analysis_lock:
        candidates=[j for j in analysis_jobs.values() if j.get('cache_key')==identity]
        if not candidates:
            return {'job':_latest_persisted_job(authenticated_user(authorization),identity)}
        # Most recently created job wins, including a completed or cancelled job.
        return {'job':_job_snapshot(candidates[-1])}

@app.get('/api/analyse/jobs/{job_id}')
def get_analysis_job(job_id:str):
    with analysis_lock:
        job=analysis_jobs.get(job_id)
        if job is None:
            saved=_load_job(job_id,authenticated_user(authorization))
            if saved is None:raise HTTPException(404,'Analysis job not found')
            return saved
        return _job_snapshot(job)

@app.post('/api/analyse/jobs/{job_id}/cancel')
def cancel_analysis_job(job_id:str):
    with analysis_lock:
        job=analysis_jobs.get(job_id)
        if job is None:raise HTTPException(404,'Analysis job not found')
        if job['status'] in ('queued','running'):
            job['cancel_event'].set()
            job['status']='cancelled'
            job['message']='Cancelled. In-flight provider request may continue until timeout.'
            _persist_job(job)
        return _job_snapshot(job)

@app.post('/api/passage')
def passage(req:PassageRequest):
    with get_doc(req.paper_id) as doc:blocks=blocks_for(doc)
    block=next((b for b in blocks if b['id']==req.block_id),None)
    if not block:raise HTTPException(404,'Original source block not found')
    key=fingerprint('passage',PROMPT_VERSION,paper_sha(req.paper_id),req.block_id,block['text'],req.question.strip(),req.theme,active_model())
    cached=cache_get('passage_cache',key)
    if cached is not None:return {**cached,'cache_hit':True}
    data=ask([{'role':'system','content':'Analyse the provided original academic passage cautiously. Do not invent results, statistics, authors or related papers. Return JSON object with fields interpretation, relevance, limitations. Keep each concise.'},{'role':'user','content':json.dumps({'question':req.question,'theme':req.theme,'original_passage':block['text']})}],task_type='passage',paper_id=req.paper_id)
    result={'source':block,'interpretation':str(data.get('interpretation','')),'relevance':str(data.get('relevance','')),'limitations':str(data.get('limitations',''))}
    cache_put('passage_cache',key,result,req.paper_id)
    return {**result,'cache_hit':False}


class NetworkProposalRequest(BaseModel):
    question:str
    evidence:list[dict]

@app.post('/api/network/propose')
def propose_evidence_links(req:NetworkProposalRequest):
    records=[]
    for e in req.evidence[:60]:
        if not e.get('id') or not (e.get('quote') or e.get('text')):continue
        records.append({'id':str(e['id']),'theme':str(e.get('theme',''))[:100],
          'quote':str(e.get('quote') or e.get('text'))[:500],
          'interpretation':str(e.get('analysis',''))[:400],
          'source':str(e.get('source',''))[:200]})
    if len(records)<2:raise HTTPException(422,'At least two verified evidence records are required')
    key=fingerprint('network-proposal-v1',req.question,records,active_model())
    cached=cache_get('theme_cache',key)
    if cached is not None:return {**cached,'cache_hit':True}
    result=ask([
      {'role':'system','content':(
        'You propose evidence-to-evidence relationships for HUMAN REVIEW. '
        'Return only JSON {"links":[{"source_id":"exact id","target_id":"exact id",'
        '"relationship":"Supporting|Contradictory|Related","rationale":"specific grounded explanation"}]}. '
        'Propose at most 12 relationships. Supporting means compatible claims, '
        'Contradictory means actual disagreement on a comparable claim, Related means '
        'topically or methodologically connected but neither supported nor contradicted. '
        'Shared theme alone is insufficient for an edge. Be conservative; zero links is valid. '
        'Use only supplied evidence and exact IDs; do not invent claims or sources.'
      )},
      {'role':'user','content':json.dumps({'research_question':req.question,'evidence':records},ensure_ascii=False)}
    ],task_type='network')
    allowed={x['id'] for x in records}
    links=[];seen=set()
    for edge in result.get('links',[])[:24]:
        if not isinstance(edge,dict):continue
        a,b=str(edge.get('source_id','')),str(edge.get('target_id',''))
        kind=str(edge.get('relationship',''))
        why=str(edge.get('rationale','')).strip()[:500]
        if a not in allowed or b not in allowed or a==b or kind not in ('Supporting','Contradictory','Related') or len(why)<15:continue
        pair=tuple(sorted((a,b)))
        if pair in seen:continue
        seen.add(pair)
        links.append({'id':fingerprint(pair,kind)[:20],'source_id':a,'target_id':b,'relationship':kind,'rationale':why,'status':'suggested'})
        if len(links)>=12:break
    payload={'links':links}
    cache_put('theme_cache',key,payload)
    return {**payload,'cache_hit':False}

class PairRelationshipRequest(BaseModel):
    question: str
    source: dict
    target: dict

@app.post('/api/network/suggest-pair')
def suggest_pair_relationship(req:PairRelationshipRequest):
    def clean(e):
        return {'id':str(e.get('id',''))[:100],'quote':str(e.get('quote') or e.get('text') or '')[:1200],
                'interpretation':str(e.get('analysis') or e.get('interpretation') or '')[:800],
                'source':str(e.get('source') or '')[:250]}
    source,target=clean(req.source),clean(req.target)
    if not source['id'] or not target['id'] or source['id']==target['id'] or not source['quote'] or not target['quote']:
        raise HTTPException(422,'Choose two different evidence records with original quotes')
    key=fingerprint('network-pair-v1',req.question,source,target,active_model())
    cached=cache_get('theme_cache',key)
    if cached is not None:return {**cached,'cache_hit':True}
    result=ask([
        {'role':'system','content':(
            'Assess the relationship between two research evidence claims for HUMAN REVIEW. '
            'Return only JSON {"relationship":"Supporting|Contradictory|Related","rationale":"1-3 precise sentences",'
            '"caveat":"one short limitation"}. Supporting requires one claim to directly reinforce the other; '
            'Contradictory requires an actual disagreement about comparable claims; Related means connected '
            'without direct support or contradiction. Do not infer causal efficacy from a design suggestion. '
            'Use ONLY the supplied original quotes and interpretations. Be conservative and note uncertainty.'
        )},
        {'role':'user','content':json.dumps({'research_question':req.question,'source':source,'target':target},ensure_ascii=False)}
    ],task_type='network')
    kind=str(result.get('relationship',''))
    rationale=str(result.get('rationale','')).strip()[:700]
    caveat=str(result.get('caveat','')).strip()[:350]
    if kind not in ('Supporting','Contradictory','Related') or len(rationale)<15:
        raise HTTPException(502,'AI did not return a usable evidence relationship; please review manually')
    payload={'relationship':kind,'rationale':rationale,'caveat':caveat}
    cache_put('theme_cache',key,payload)
    return {**payload,'cache_hit':False}

class SynthesisRequest(BaseModel):
    question: str
    evidence: list[dict]

@app.post('/api/synthesis')
def synthesize(req:SynthesisRequest):
    # Never synthesize unverified, user-unsupplied evidence. The frontend sends
    # verified records only. Return traceable record IDs and library-scoped gaps.
    records=[{'id':str(e.get('id','')),'theme':str(e.get('theme','')),'quote':str(e.get('quote',''))[:700],
              'interpretation':str(e.get('interpretation',''))[:700],'relationship':str(e.get('relationship','Unclassified')),
              'source':str(e.get('source',''))[:300]} for e in req.evidence[:150] if e.get('id') and e.get('quote')]
    if not records:raise HTTPException(422,'No verified evidence available for synthesis')
    cache_key=fingerprint('verified-synthesis-v1',req.question,records,active_model())
    cached=cache_get('theme_cache',cache_key)
    if cached is not None:return {**cached,'cache_hit':True}
    data=ask([
      {'role':'system','content':'You are a careful research synthesis assistant. Use ONLY supplied verified evidence. Return JSON {"insights":[{"text":"specific cross-evidence insight","evidence_ids":["id"]}],"gaps":[{"text":"gap in this uploaded evidence library, not a claim about the whole field","evidence_ids":["id"]}]}. At most 4 insights and 4 gaps. Every cited ID must be supplied. Distinguish synthetic documents, limitations, and hypotheses from empirical evidence. Never fabricate references or claim universal research gaps.'},
      {'role':'user','content':json.dumps({'research_question':req.question,'verified_evidence':records},ensure_ascii=False)}
    ],task_type='synthesis')
    allowed={e['id'] for e in records}
    result={}
    for field in ('insights','gaps'):
        result[field]=[{'text':str(x.get('text',''))[:600],'evidence_ids':[i for i in x.get('evidence_ids',[]) if i in allowed]} for x in data.get(field,[])[:4] if isinstance(x,dict) and x.get('text')]
    cache_put('theme_cache',cache_key,result)
    return {**result,'cache_hit':False}

@app.post('/api/themes/suggest')
def suggest_themes(req:ThemeRequest):
    excerpts=[]
    for pid in req.paper_ids[:8]:
        with get_doc(pid) as doc:
            blocks=blocks_for(doc)
            # Spread samples across the document, not just the introduction.
            step=max(1,len(blocks)//24)
            excerpts.extend([{'paper_id':pid,'block_id':b['id'],'text':b['text'][:450]} for b in blocks[::step][:24]])
    data=ask([{'role':'system','content':'Suggest 3-6 research themes based ONLY on the research question, user topics and supplied PDF excerpts. Return JSON {"themes":[{"name":"...","basis":"...","source_block_ids":["0:1"]}]}. Do not claim comprehensive field coverage. If sources are insufficient, say so in basis.'},{'role':'user','content':json.dumps({'question':req.question,'user_topics':req.topics,'paper_excerpts':excerpts},ensure_ascii=False)}],task_type='theme_suggestion')
    valid_ids={e['block_id'] for e in excerpts}
    def clean_themes(payload):
        raw=payload.get('themes',[]) if isinstance(payload,dict) else []
        if isinstance(raw,dict):raw=[raw]
        if not isinstance(raw,list):raw=[]
        items=[]
        for item in raw:
            if isinstance(item,str):item={'name':item,'basis':'AI-suggested research topic.'}
            if not isinstance(item,dict):continue
            name=str(item.get('name') or item.get('theme') or item.get('topic') or '').strip()[:80]
            if not name:continue
            ids=item.get('source_block_ids') or []
            if not isinstance(ids,list):ids=[]
            items.append({'name':name,'basis':str(item.get('basis') or item.get('reason') or 'Suggested from the research question.')[:300],'source_block_ids':[x for x in ids if x in valid_ids]})
        return list({t['name'].casefold():t for t in items}.values())[:8]
    themes=clean_themes(data)
    if not themes:
        # A second attempt with an unambiguous JSON contract, never claim a successful empty result.
        retry=ask([{'role':'system','content':'You are a research theme ideation assistant. Always return a JSON object with exactly one key, "themes", whose value is a list of 3 to 5 objects. Each object has string keys "name" and "basis" and a list key "source_block_ids". Derive themes from the question even if no PDF is provided. Never return an empty list.'},{'role':'user','content':json.dumps({'research_question':req.question,'initial_topics':req.topics},ensure_ascii=False)}],task_type='theme_suggestion')
        themes=clean_themes(retry)
    if not themes:
        raise HTTPException(502,'The AI returned no usable research themes after two attempts. Please retry or enter themes manually.')
    return {'themes':themes}
