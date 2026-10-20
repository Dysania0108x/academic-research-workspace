import os, uuid, json, re, sqlite3, hashlib, time
from pathlib import Path
from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response
from pydantic import BaseModel
import fitz
from openai import OpenAI
from dotenv import load_dotenv
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
        c.execute('CREATE TABLE IF NOT EXISTS analysis_batch_cache (cache_key TEXT PRIMARY KEY, paper_id TEXT NOT NULL, result TEXT NOT NULL, created_at REAL NOT NULL)')
        c.execute('CREATE TABLE IF NOT EXISTS passage_cache (cache_key TEXT PRIMARY KEY, paper_id TEXT NOT NULL, result TEXT NOT NULL, created_at REAL NOT NULL)')
        c.execute('CREATE TABLE IF NOT EXISTS theme_cache (cache_key TEXT PRIMARY KEY, result TEXT NOT NULL, created_at REAL NOT NULL)')
        c.execute('CREATE TABLE IF NOT EXISTS ai_usage (id INTEGER PRIMARY KEY AUTOINCREMENT, created_at REAL NOT NULL, task_type TEXT NOT NULL, paper_id TEXT, model TEXT, input_tokens INTEGER, output_tokens INTEGER, total_tokens INTEGER, status TEXT NOT NULL, error TEXT)')
init_db()
app=FastAPI(title='Research Workspace API')
app.add_middleware(CORSMiddleware,allow_origins=['http://localhost:5173','http://127.0.0.1:5173'],allow_methods=['*'],allow_headers=['*'])
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
    with db() as c:
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
        c.execute('DELETE FROM analysis_batch_cache WHERE paper_id=?',(paper_id,))
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
        elif table=='analysis_batch_cache':
            c.execute('INSERT OR REPLACE INTO analysis_batch_cache VALUES(?,?,?,?)',(key,paper_id,json.dumps(result,ensure_ascii=False),time.time()))
        elif table=='passage_cache':
            c.execute('INSERT OR REPLACE INTO passage_cache VALUES(?,?,?,?)',(key,paper_id,json.dumps(result,ensure_ascii=False),time.time()))
        else:
            c.execute('INSERT OR REPLACE INTO theme_cache VALUES(?,?,?)',(key,json.dumps(result,ensure_ascii=False),time.time()))
def paper_sha(paper_id):
    with db() as c:
        row=c.execute('SELECT sha256 FROM papers WHERE id=?',(paper_id,)).fetchone()
    if not row: raise HTTPException(404,'Paper not found')
    return row['sha256']
def ask(messages,task_type='other',paper_id=None):
    key=os.getenv('DASHSCOPE_API_KEY')
    if not key: raise HTTPException(503,'Set DASHSCOPE_API_KEY in backend/.env')
    model=os.getenv('QWEN_MODEL','qwen-plus')
    client=OpenAI(api_key=key,base_url=os.getenv('QWEN_BASE_URL','https://dashscope-intl.aliyuncs.com/compatible-mode/v1'),timeout=float(os.getenv('QWEN_TIMEOUT_SECONDS','180')),max_retries=0)
    usage=(None,None,None);status='success';error=None
    try:
        res=client.chat.completions.create(model=model,messages=messages,temperature=0.1,response_format={'type':'json_object'})
        u=res.usage
        if u: usage=(u.prompt_tokens,u.completion_tokens,u.total_tokens)
        return json.loads(res.choices[0].message.content or '{}')
    except Exception as exc:
        status='error';error=str(exc)[:500]
        raise HTTPException(502,'AI request failed: '+error[:250])
    finally:
        with db() as c:
            c.execute('INSERT INTO ai_usage(created_at,task_type,paper_id,model,input_tokens,output_tokens,total_tokens,status,error) VALUES(?,?,?,?,?,?,?,?,?)',(time.time(),task_type,paper_id,model,*usage,status,error))
@app.get('/api/usage')
def usage_stats():
    with db() as c:
        rows=[dict(r) for r in c.execute('SELECT task_type, COUNT(*) AS requests, SUM(COALESCE(input_tokens,0)) AS input_tokens, SUM(COALESCE(output_tokens,0)) AS output_tokens, SUM(COALESCE(total_tokens,0)) AS total_tokens, SUM(CASE WHEN status="error" THEN 1 ELSE 0 END) AS errors FROM ai_usage GROUP BY task_type ORDER BY task_type')]
    return {'by_task':rows,'total_tokens':sum(r['total_tokens'] for r in rows),'requests':sum(r['requests'] for r in rows),'note':'Counts actual model responses only; cache hits use zero new tokens.'}
@app.get('/api/health')
def health(): return {'ok':True,'ai_configured':bool(os.getenv('DASHSCOPE_API_KEY'))}
@app.post('/api/papers')
async def upload(file:UploadFile=File(...)):
    if not file.filename.lower().endswith('.pdf'): raise HTTPException(400,'Only PDFs supported')
    data=await file.read(20*1024*1024+1)
    if len(data)>20*1024*1024: raise HTTPException(413,'PDF must be under 20MB')
    sha=hashlib.sha256(data).hexdigest()
    with db() as c:
        existing=c.execute('SELECT * FROM papers WHERE sha256=?',(sha,)).fetchone()
    if existing and (STORE/(existing['id']+'.pdf')).exists():
        return {'id':existing['id'],'name':existing['filename'],'pages':existing['pages'],'duplicate':True}
    pid=str(uuid.uuid4()); path=STORE/(pid+'.pdf')
    path.write_bytes(data)
    try:
        with fitz.open(path) as doc:
            if doc.is_encrypted: raise ValueError('Password-protected PDF')
            blocks=blocks_for(doc)
            if not blocks: raise ValueError('No extractable text. Scanned PDFs require OCR.')
            pages=len(doc)
    except Exception as e:
        path.unlink(missing_ok=True);raise HTTPException(422,str(e))
    with db() as c:
        c.execute('INSERT INTO papers VALUES(?,?,?,?,?)',(pid,file.filename,sha,pages,time.time()))
    return {'id':pid,'name':file.filename,'pages':pages,'blocks':len(blocks),'duplicate':False}
@app.get('/api/papers/{paper_id}/blocks')
def blocks(paper_id:str):
    with get_doc(paper_id) as doc:
        return {'blocks':blocks_for(doc),'pages':[{'width':round(p.rect.width,2),'height':round(p.rect.height,2)} for p in doc]}
@app.get('/api/papers/{paper_id}/file')
def original_pdf(paper_id:str):
    with get_doc(paper_id) as doc:
        return Response((STORE/(paper_id+'.pdf')).read_bytes(),media_type='application/pdf',headers={'Content-Disposition':'inline'})

@app.get('/api/papers/{paper_id}/pages/{page_num}/image')
def page_image(paper_id:str,page_num:int,scale:float=2.5):
    with get_doc(paper_id) as doc:
        if page_num<1 or page_num>len(doc):raise HTTPException(404,'Page not found')
        scale=max(1.5,min(3.0,scale))
        pix=doc[page_num-1].get_pixmap(matrix=fitz.Matrix(scale,scale),alpha=False)
        return Response(pix.tobytes('png'),media_type='image/png')
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
    sha=paper_sha(req.paper_id);model=os.getenv('QWEN_MODEL','qwen-plus')
    matches=[];cached_themes=[];analysed_themes=[]
    for theme in themes:
        key=fingerprint('precise-highlight',PROMPT_VERSION,sha,req.question.strip(),theme,model)
        cached=cache_get('analysis_cache',key)
        if cached is not None:
            matches.extend(cached);cached_themes.append(theme);continue
        selected=[];seen_quotes=set();page_counts={}
        for start in range(0,len(blocks),15):
            batch=blocks[start:start+15]
            batch_key=fingerprint('precise-highlight-batch',PROMPT_VERSION,sha,req.question.strip(),theme,model,start,[(b['id'],b['text']) for b in batch])
            batch_result=cache_get('analysis_batch_cache',batch_key)
            if batch_result is not None:
                selected.extend(batch_result)
                for cached_item in batch_result:
                    seen_quotes.add((cached_item['page'],cached_item['quote'].casefold()))
                    page_counts[cached_item['page']]=page_counts.get(cached_item['page'],0)+1
                continue
            batch_selected=[]
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
                batch_selected.append({'id':bid,'page':block['page'],'text':quote,'quote':quote,'theme':theme,'reason':str(item.get('reason',''))[:300],'rects':rects,'rect':block['rect']})
            selected.extend(batch_selected)
            cache_put('analysis_batch_cache',batch_key,batch_selected,req.paper_id)
        cache_put('analysis_cache',key,selected,req.paper_id,theme)
        matches.extend(selected);analysed_themes.append(theme)
    return {'matches':matches,'analysed_blocks':len(blocks),'cached_themes':cached_themes,'analysed_themes':analysed_themes,'cache_hit':not analysed_themes,'precision_mode':'exact_quote','batches_per_theme':(len(blocks)+14)//15}
@app.post('/api/passage')
def passage(req:PassageRequest):
    with get_doc(req.paper_id) as doc:blocks=blocks_for(doc)
    block=next((b for b in blocks if b['id']==req.block_id),None)
    if not block:raise HTTPException(404,'Original source block not found')
    key=fingerprint('passage',PROMPT_VERSION,paper_sha(req.paper_id),req.block_id,block['text'],req.question.strip(),req.theme,os.getenv('QWEN_MODEL','qwen-plus'))
    cached=cache_get('passage_cache',key)
    if cached is not None:return {**cached,'cache_hit':True}
    data=ask([{'role':'system','content':'Analyse the provided original academic passage cautiously. Do not invent results, statistics, authors or related papers. Return JSON object with fields interpretation, relevance, limitations. Keep each concise.'},{'role':'user','content':json.dumps({'question':req.question,'theme':req.theme,'original_passage':block['text']})}],task_type='passage',paper_id=req.paper_id)
    result={'source':block,'interpretation':str(data.get('interpretation','')),'relevance':str(data.get('relevance','')),'limitations':str(data.get('limitations',''))}
    cache_put('passage_cache',key,result,req.paper_id)
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
    return {'themes':[{'name':str(t.get('name','')).strip()[:80],'basis':str(t.get('basis',''))[:300],'source_block_ids':[x for x in t.get('source_block_ids',[]) if x in valid_ids]} for t in data.get('themes',[]) if str(t.get('name','')).strip()][:8]}
