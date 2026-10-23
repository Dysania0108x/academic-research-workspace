import React, { useEffect, useState, useRef } from 'react';
import { createRoot } from 'react-dom/client';
import { BookOpen, LayoutDashboard, Network, Settings, Plus, FolderOpen, FileText, Bot, Search, Check, X, Pencil, ArrowLeft, Trash2, Upload, Sparkles, ChevronRight, ChevronDown, Eye, Info, FilePenLine, Highlighter, SlidersHorizontal } from 'lucide-react';
import { createClient } from '@supabase/supabase-js';
import './style.css';
import { EvitlasLanding, EvitlasAuth } from './Evitlas.jsx';
import PdfJsPreview from './PdfJsPreview.jsx';

const supabaseUrl=import.meta.env.VITE_SUPABASE_URL;
const supabaseKey=import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
const supabase=supabaseUrl&&supabaseKey?createClient(supabaseUrl,supabaseKey):null;
/** Attach the current Supabase session to every protected FastAPI request. */
async function apiFetch(input, init={}) {
  if (!supabase) throw Error('Supabase is not configured');
  const {data:{session},error}=await supabase.auth.getSession();
  if(error||!session?.access_token) throw Error('Sign in again to access the research API');
  const headers=new Headers(init.headers||{});
  headers.set('Authorization','Bearer '+session.access_token);
  const configured=(import.meta.env.VITE_API_BASE_URL||'').trim();
  const isHosted=typeof window!=='undefined' && window.location.hostname.endsWith('.vercel.app');
  if(isHosted && !configured) throw Error('Deployment configuration missing: VITE_API_BASE_URL was not included in this Vercel build. Add it to the Preview environment and redeploy.');
  const base=configured.replace(/\/$/,'');
  let response;
  try { response=await fetch(base+input,{...init,headers}); }
  catch(error) {
    if(error?.name==='AbortError')throw error;
    throw Error('Cannot reach Render API ('+(base||'same origin')+'). Check Vercel Preview variables, Render deployment, and FRONTEND_ORIGINS. '+(error?.message||'Network error'));
  }
  return response;
}



const themePalette=['#E8B844','#67A7E8','#A783E8','#47B99A','#E48C98','#7D89D9'];
const themeColor=(themes,name)=>{const names=[...new Set([...(themes||[]),name].filter(Boolean))].sort((a,b)=>a.localeCompare(b));const index=names.indexOf(name);return themePalette[index%themePalette.length]};
const highlightText=(value,query)=>{const text=String(value||'');const q=String(query||'').trim();if(!q)return text;const lower=text.toLocaleLowerCase(),needle=q.toLocaleLowerCase();const pieces=[];let from=0,index=lower.indexOf(needle);while(index!==-1&&pieces.length<100){if(index>from)pieces.push(text.slice(from,index));pieces.push(<mark key={index}>{text.slice(index,index+q.length)}</mark>);from=index+q.length;index=lower.indexOf(needle,from)}pieces.push(text.slice(from));return pieces};
const highlightKey=m=>[m.paperId||'',m.page,(m.quote||m.text||'').trim().replace(/\s+/g,' ').toLowerCase()].join('|');
const existingEvidence=(project,passage)=>project?.evidence?.find(e=>highlightKey(e)===highlightKey(passage));
const relationshipOptions=['Supporting','Contradictory','Related','Unclassified'];
const relationshipColors={Supporting:{bg:'#DCF5E8',fg:'#176A45'},Contradictory:{bg:'#FCE1E5',fg:'#A22D42'},Related:{bg:'#DFECFF',fg:'#285A9A'},Unclassified:{bg:'#F0EFF3',fg:'#666273'}};
const relationshipStyle=kind=>({background:(relationshipColors[kind]||relationshipColors.Unclassified).bg,color:(relationshipColors[kind]||relationshipColors.Unclassified).fg});
const clearNativeSelection=()=>{if(typeof window!=='undefined')window.getSelection?.()?.removeAllRanges?.()};
const defaultThemes=['Research Efficiency','Information Reliability','Research Workflow'];
const initialProject={id:'demo',name:'AI in Literature Reviews',question:'How does generative AI influence students’ literature review processes?',topics:defaultThemes,papers:[],evidence:[]};
// A starter workspace contains fictional context only, never fabricated verified quotations.
const makeStarterProject=()=>({
 id:crypto.randomUUID(),
 name:'Example Project — AI in Literature Reviews',
 question:'How can AI support postgraduate students in reviewing academic literature while maintaining evidence reliability?',
 topics:['AI-assisted Literature Review','Evidence Verification','Research Workflow'],
 papers:[],evidence:[],
 description:'EXAMPLE PROJECT — Sample research question and themes for exploring the workspace. Upload your own papers to generate and verify real evidence.'
});
const normalizeSeedPapers=projects=>(projects||[]).map(p=>{let found=false;return {...p,papers:(p.papers||[]).map(paper=>{const seed=!!paper.seed&&!found;if(seed)found=true;return {...paper,seed}})}});
function load(){try{return normalizeSeedPapers(JSON.parse(localStorage.getItem('arw-v01'))||[initialProject])}catch{return [initialProject]}}
function EvidenceNetwork({evidence,links,themes,storedPositions,onPosition,onNode,onEdge,onConnect}){
 const width=1000,height=Math.max(520,Math.ceil(evidence.length/4)*170+100);
 const [dragging,setDragging]=useState(null);
 const [connecting,setConnecting]=useState(null);
 const [zoom,setZoom]=useState(1);
 const [selectedLink,setSelectedLink]=useState(null);
 const [positions,setPositions]=useState({});
 const svgRef=useRef(null);
 const dragMoved=useRef(false);
 const edgeColors={Supporting:'#229A78',Contradictory:'#D96B78',Related:'#4D8DCB'};
 const chooseLink=l=>{setSelectedLink(l.id);onEdge(l)};
 useEffect(()=>{setPositions(storedPositions||{});setDragging(null)},[storedPositions]);
 const point=(event)=>{const svg=svgRef.current;if(!svg)return null;const matrix=svg.getScreenCTM();if(!matrix)return null;const pt=svg.createSVGPoint();pt.x=event.clientX;pt.y=event.clientY;const local=pt.matrixTransform(matrix.inverse());return {x:local.x,y:local.y}};
 const position=(e,i)=>positions[e.id]||{x:145+(i%4)*235,y:115+Math.floor(i/4)*170};
 const nodes=Object.fromEntries(evidence.map((e,i)=>[e.id,position(e,i)]));
 const active=links.filter(l=>nodes[l.source_id]&&nodes[l.target_id]);
 const connectRef=useRef(null);
 const dragRef=useRef(null);
 const [hoverTarget,setHoverTarget]=useState(null);
 const [networkHint,setNetworkHint]=useState('');
 const releaseCapture=event=>{try{if(svgRef.current?.hasPointerCapture(event.pointerId))svgRef.current.releasePointerCapture(event.pointerId)}catch{}};
 const findTarget=(p,source)=>evidence.find(e=>e.id!==source&&p&&Math.abs(nodes[e.id].x-p.x)<=104&&Math.abs(nodes[e.id].y-p.y)<=51);
 const move=event=>{
  const p=point(event);if(!p)return;
  if(connectRef.current){const next={...connectRef.current,to:p};connectRef.current=next;setConnecting(next);setHoverTarget(findTarget(p,next.id)?.id||null);return}
  if(!dragRef.current)return;
  const drag=dragRef.current;
  if(Math.hypot(p.x-drag.startX,p.y-drag.startY)>4)dragMoved.current=true;
  if(!dragMoved.current)return;
  const next={x:Math.max(110,Math.min(width-110,p.x-drag.dx)),y:Math.max(65,Math.min(height-65,p.y-drag.dy))};
  setPositions(old=>({...old,[drag.id]:next}));
 };
 const stop=event=>{
  const p=point(event);
  if(connectRef.current){
   const source=connectRef.current.id,target=findTarget(p,source);
   connectRef.current=null;setConnecting(null);setHoverTarget(null);releaseCapture(event);
   if(target){setNetworkHint('');onConnect(source,target.id)}
   else setNetworkHint('Drop the purple handle onto another Evidence card to connect.');
   return;
  }
  if(dragRef.current){
   const drag=dragRef.current;dragRef.current=null;setDragging(null);releaseCapture(event);
   if(dragMoved.current){
    if(p)onPosition(drag.id,{x:Math.max(110,Math.min(width-110,p.x-drag.dx)),y:Math.max(65,Math.min(height-65,p.y-drag.dy))});
   }else{const item=evidence.find(e=>e.id===drag.id);if(item)onNode(item)}
  }
 };
 const cancel=event=>{connectRef.current=null;dragRef.current=null;setConnecting(null);setDragging(null);setHoverTarget(null);releaseCapture(event)};
 return <div className="network-canvas v5-network"><div className="v5-network-tools"><span>Drag nodes to organise · Drag the small circle on a node to another node to connect</span><button className="secondary" onClick={()=>setZoom(z=>Math.max(.6,+(z-.2).toFixed(1)))}>−</button><strong>{Math.round(zoom*100)}%</strong><button className="secondary" onClick={()=>setZoom(z=>Math.min(1.8,+(z+.2).toFixed(1)))}>+</button><button className="secondary" onClick={()=>setZoom(1)}>Reset zoom</button></div><div className="v5-network-scroll"><svg ref={svgRef} viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Interactive evidence relationship graph" style={{width:(zoom*100)+'%',minWidth:700,height:'auto',touchAction:'none',userSelect:'none',WebkitUserSelect:'none'}} onDragStart={event=>event.preventDefault()} onPointerMove={move} onPointerUp={stop} onPointerCancel={cancel} onLostPointerCapture={event=>{if(connectRef.current||dragRef.current)cancel(event)}}>
 {active.map(l=>{const a=nodes[l.source_id],b=nodes[l.target_id],color=edgeColors[l.relationship]||'#77839D',selected=selectedLink===l.id,dim=selectedLink&&selectedLink!==l.id,mx=(a.x+b.x)/2,my=(a.y+b.y)/2,label=l.relationship||'Related',labelWidth=label.length*6.1+20;return <g key={l.id} className="v10-edge" opacity={dim?.25:1}><line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="transparent" strokeWidth="22" className="v10-edge-hit" onClick={event=>{event.stopPropagation();chooseLink(l)}}/><line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={color} strokeWidth={selected?4:2.4} strokeDasharray={l.relationship==='Related'?'7 5':undefined} pointerEvents="none"/><g transform={`translate(${mx},${my})`} onClick={event=>{event.stopPropagation();chooseLink(l)}} className="v10-edge-label"><rect x={-labelWidth/2} y="-13" width={labelWidth} height="26" rx="11" fill={selected?color:'#fff'} stroke={color} strokeWidth="1.5"/><text textAnchor="middle" dominantBaseline="central" fontSize="10" fontWeight="700" fill={selected?'#fff':color}>{label}</text></g></g>})}
 {connecting&&<line x1={nodes[connecting.id]?.x||0} y1={nodes[connecting.id]?.y||0} x2={connecting.to.x} y2={connecting.to.y} stroke="#7362d5" strokeWidth="3" strokeDasharray="6 5" pointerEvents="none"/>}
 {evidence.map((e,i)=>{const p=nodes[e.id],summary=(e.analysis||e.quote||e.text||'No summary').trim();return <g key={e.id} className="v5-network-node" onPointerDown={event=>{if(event.button!==0)return;event.preventDefault();const pt=point(event);if(!pt)return;svgRef.current?.setPointerCapture(event.pointerId);dragMoved.current=false;const next={id:e.id,dx:pt.x-p.x,dy:pt.y-p.y,startX:pt.x,startY:pt.y};dragRef.current=next;setDragging(next)}}><rect x={p.x-104} y={p.y-51} width="208" height="102" rx="12" fill="#fff" stroke={hoverTarget===e.id?"#7561d9":"#DCD8E8"} strokeWidth={hoverTarget===e.id?3:1.5}/><rect x={p.x-91} y={p.y-37} width="5" height="13" rx="2" fill={themeColor(themes,e.theme)}/><text x={p.x-80} y={p.y-29} fontSize="11" fontWeight="bold" fill="#302b45">{String(e.theme||'Uncategorised').slice(0,27)}</text><text x={p.x-90} y={p.y-8} fontSize="10" fill="#4f4b63">{summary.slice(0,32)}</text><text x={p.x-90} y={p.y+7} fontSize="10" fill="#4f4b63">{summary.slice(32,64)}</text><text x={p.x-90} y={p.y+30} fontSize="10" fill={edgeColors[e.relationship]||'#77728E'}>{e.relationship||'Unclassified'} · View source ↗</text><circle cx={p.x+99} cy={p.y+1} r="9" fill="#7561d9" stroke="#fff" strokeWidth="2" className="v5-connection-handle" onPointerDown={event=>{if(event.button!==0)return;event.preventDefault();event.stopPropagation();dragRef.current=null;svgRef.current?.setPointerCapture(event.pointerId);const initial={id:e.id,to:{x:p.x+99,y:p.y+1}};connectRef.current=initial;setConnecting(initial)}} /></g>})}</svg></div>
 {networkHint&&<p className="v12-network-hint" role="status">{networkHint}</p>}
 <div className="network-edges v10-connection-detail">{selectedLink&&active.some(l=>l.id===selectedLink)?(()=>{const link=active.find(l=>l.id===selectedLink);const source=evidence.find(e=>e.id===link.source_id),target=evidence.find(e=>e.id===link.target_id);return <><div className="v10-detail-head"><h3>Connection Details</h3><button className="secondary" onClick={()=>{setSelectedLink(null);onEdge(null)}}>Close</button></div><strong style={{color:edgeColors[link.relationship]}}>{link.relationship}</strong><p>{link.rationale}</p><div className="v10-linked-evidence"><div><small>Source Evidence</small><p>{(source?.quote||source?.text||source?.analysis||'Source unavailable').slice(0,240)}</p></div><div><small>Target Evidence</small><p>{(target?.quote||target?.text||target?.analysis||'Target unavailable').slice(0,240)}</p></div></div></>})():<p className="hint">{active.length} verified connection{active.length===1?'':'s'}. Click a line or label to inspect it. Drag a purple handle to create a connection.</p>}</div>
 </div>
}
function AuthGate(){
 const [session,setSession]=useState(null);
 const [checking,setChecking]=useState(true);
 const [email,setEmail]=useState('');
 const [password,setPassword]=useState('');
 const [mode,setMode]=useState('signin');
 const [showLanding,setShowLanding]=useState(true);
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState('');
 const [notice,setNotice]=useState('');
 useEffect(()=>{
  if(!supabase){setChecking(false);return}
  let mounted=true;
  supabase.auth.getSession().then(({data,error})=>{if(!mounted)return;if(error)setError(error.message);setSession(data.session);setChecking(false)}).catch(e=>{if(mounted){setError(e.message);setChecking(false)}});
  const {data:{subscription}}=supabase.auth.onAuthStateChange((_event,nextSession)=>{if(mounted)setSession(nextSession)});
  return()=>{mounted=false;subscription.unsubscribe()};
 },[]);
 const submit=async event=>{event.preventDefault();if(!supabase||busy)return;setBusy(true);setError('');setNotice('');try{
  const result=mode==='signin'?await supabase.auth.signInWithPassword({email:email.trim(),password}):await supabase.auth.signUp({email:email.trim(),password});
  if(result.error)throw result.error;
  if(mode==='signup'&&!result.data.session)setNotice('Check your email to confirm your account, then sign in.');
  if(mode==='signup'&&result.data.session)setNotice('Account created.');
 }catch(e){setError(e.message||'Authentication failed')}finally{setBusy(false)}};
 if(checking)return <div className="v61-auth-loading">Checking your session…</div>;
 if(!supabase)return <div className="v61-auth-screen"><div className="v61-auth-card"><h1>Supabase setup required</h1><p>Create a root-level .env.local with VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY, then restart Vite.</p><p>No project data has been changed.</p></div></div>;
 if(!session){
  if(showLanding)return <EvitlasLanding onEnter={()=>setShowLanding(false)} onSignIn={()=>{setMode('signin');setShowLanding(false)}} onSignUp={()=>{setMode('signup');setShowLanding(false)}}/>;
  return <EvitlasAuth mode={mode} setMode={next=>{setMode(next);setError('');setNotice('')}} email={email} setEmail={setEmail} password={password} setPassword={setPassword} busy={busy} error={error} notice={notice} onSubmit={submit} onBack={()=>setShowLanding(true)}/>;
 }
 return <div className="v61-authenticated"><div className="v61-session-bar"><span>Signed in as <strong>{session.user.email}</strong></span><button className="secondary" onClick={async()=>{const {error}=await supabase.auth.signOut();if(error)setError(error.message)}}>Sign Out</button></div><div className="v61-local-warning">Projects and private PDFs are stored in Supabase; AI analysis runs through the Render backend. Verify AI evidence against original PDF sources.</div><App key={session.user.id} user={session.user}/></div>;
}
function App({user}){
 const [projects,setProjects]=useState([]);
 const [cloudError,setCloudError]=useState('');
 const [cloudSaving,setCloudSaving]=useState(false);
 const [cloudRetry,setCloudRetry]=useState(0);
 const cloudPending=useRef(new Set());
 const cloudDeleted=useRef(new Set());
 const cloudWrites=useRef(Promise.resolve());
 const [projectId,setProjectId]=useState(null);
 const [page,setPage]=useState('overview');
 const [settingsTab,setSettingsTab]=useState('general');
 const [highlightFilter,setHighlightFilter]=useState('all');
 const [highlightSearch,setHighlightSearch]=useState('');
 const [highlightPaperFilter,setHighlightPaperFilter]=useState('');
 const [highlightCandidates,setHighlightCandidates]=useState([]);
 const [highlightLoadError,setHighlightLoadError]=useState('');
 const [highlightLoading,setHighlightLoading]=useState(false);
 const [creating,setCreating]=useState(false);
 const [draft,setDraft]=useState({name:'',question:'',topics:''});
 const [draftFiles,setDraftFiles]=useState([]);
 const [suggestions,setSuggestions]=useState([]);
 const [draftStep,setDraftStep]=useState('details');
 const [creatingBusy,setCreatingBusy]=useState(false);
 const [createError,setCreateError]=useState('');
 const [selected,setSelected]=useState(null);
 const [assistant,setAssistant]=useState(false);
 const [assistantTab,setAssistantTab]=useState('highlights');
 const [editing,setEditing]=useState('');
 const [paperId,setPaperId]=useState(null);
 const [pdfUrls,setPdfUrls]=useState({});
 const [pageImageUrl,setPageImageUrl]=useState(null);
 const [legacyReader,setLegacyReader]=useState(false);
 const [message,setMessage]=useState('');
 const [blocks,setBlocks]=useState([]);
 const [pageSizes,setPageSizes]=useState([]);
 const [pageNumber,setPageNumber]=useState(1);
 const [matches,setMatches]=useState([]);
 const [busy,setBusy]=useState(false);
 const [analysisJob,setAnalysisJob]=useState(null);
 const [paperJobs,setPaperJobs]=useState({});
 const analysisStartRef=useRef(new Set());
 const [aiError,setAiError]=useState('');
 const [uploadStage,setUploadStage]=useState('');
 const [aiDetails,setAiDetails]=useState(null);
 const [health,setHealth]=useState(null);
 const [usage,setUsage]=useState(null);
 const [usageError,setUsageError]=useState('');
 const [cacheMessage,setCacheMessage]=useState('');
 const [showHighlights,setShowHighlights]=useState(true);
 const [activeThemes,setActiveThemes]=useState(null);
 const [syncReady,setSyncReady]=useState(false);
 const [zoom,setZoom]=useState(100);
 const [libraryOpen,setLibraryOpen]=useState(false);
 const [evidenceEditor,setEvidenceEditor]=useState(null);
 const [manualEvidenceOpen,setManualEvidenceOpen]=useState(false);
 const [evidenceEntryMode,setEvidenceEntryMode]=useState('manual');
 const [savedExcerpts,setSavedExcerpts]=useState([]);
 const [excerptsLoading,setExcerptsLoading]=useState(false);
 const [excerptsError,setExcerptsError]=useState('');
 const [selectedExcerptId,setSelectedExcerptId]=useState('');
 const [manualEvidence,setManualEvidence]=useState({sourceType:'web',sourceTitle:'',sourceUrl:'',quote:'',analysis:'',theme:'',relationship:'Unclassified'});
 const [evidenceDraft,setEvidenceDraft]=useState('');
 const [insightLimit,setInsightLimit]=useState(3);
 const [relationship,setRelationship]=useState('Unclassified');
 const [mapView,setMapView]=useState('rq');
 const [rqListFocus,setRqListFocus]=useState(null);
 const [rqDimensionDraft,setRqDimensionDraft]=useState('');
 const [rqActiveDimension,setRqActiveDimension]=useState(null);
 const [rqSynthesisBusy,setRqSynthesisBusy]=useState(false);
 const [rqSynthesisError,setRqSynthesisError]=useState('');
 const [rqSynthesisDraft,setRqSynthesisDraft]=useState(null);
 const [mapQuery,setMapQuery]=useState('');
 const [mapTheme,setMapTheme]=useState(null);
 const [mapSort,setMapSort]=useState('newest');
 const [mapThemeFilter,setMapThemeFilter]=useState([]);
 const [mapFiltersOpen,setMapFiltersOpen]=useState(false);
 const [mapManageOpen,setMapManageOpen]=useState(false);
 const [bulkMode,setBulkMode]=useState(false);
 const [mapPaperFilter,setMapPaperFilter]=useState('');
 const [mapRelationshipFilter,setMapRelationshipFilter]=useState('');
 const [mapYearFilter,setMapYearFilter]=useState('');
 const [mapAuthorFilter,setMapAuthorFilter]=useState('');
 const [mapYearTo,setMapYearTo]=useState('');
 const [selectedEvidenceIds,setSelectedEvidenceIds]=useState([]);
 const [duplicateReview,setDuplicateReview]=useState(false);
 const [bulkTheme,setBulkTheme]=useState('');
 const [bulkRelationship,setBulkRelationship]=useState('');
 const [focusOnly,setFocusOnly]=useState(true);
 const [draftSuggestBusy,setDraftSuggestBusy]=useState(false);
 const [draftSuggestionNotice,setDraftSuggestionNotice]=useState('');
 const [draftSuggestions,setDraftSuggestions]=useState([]);
 const [draftSelected,setDraftSelected]=useState([]);
 const [synthesis,setSynthesis]=useState(null);
 const [synthesisBusy,setSynthesisBusy]=useState(false);
 const [networkBusy,setNetworkBusy]=useState(false);
 const [networkProposals,setNetworkProposals]=useState([]);
 const [networkSelected,setNetworkSelected]=useState(null);
 const [manualSource,setManualSource]=useState('');
 const [manualTarget,setManualTarget]=useState('');
 const [manualRelation,setManualRelation]=useState('Related');
 const [manualRationale,setManualRationale]=useState('');
 const [networkNotice,setNetworkNotice]=useState('');
 const [pairSuggestBusy,setPairSuggestBusy]=useState(false);
 const [pairCaveat,setPairCaveat]=useState('');
 const [connectionReviewOpen,setConnectionReviewOpen]=useState(false);

 const [paperEditor,setPaperEditor]=useState(null);
 const [sourceFocus,setSourceFocus]=useState(null);
 const [focusedHighlight,setFocusedHighlight]=useState(null);
 const pdfScrollRef=useRef(null);
 const pdfCanvasRef=useRef(null);
 const sourceNavigationRef=useRef(null);
 const passageRequestRef=useRef(0);
 const sourceRequestRef=useRef(0);
 useEffect(()=>{apiFetch('/api/health').then(r=>r.json()).then(setHealth).catch(()=>setHealth(null));Promise.resolve()},[]);
 useEffect(()=>{setAnalysisJob(null);setCacheMessage('');const navigation=sourceNavigationRef.current;const isSourceNavigation=navigation?.paperId===paperId;setMatches([]);setBlocks([]);setPageSizes([]);if(!isSourceNavigation){setPageNumber(1);setSelected(null);setFocusedHighlight(null);setSourceFocus(null);setAiDetails(null)}else{setPageNumber(navigation.page);sourceNavigationRef.current=null}if(!paperId)return;apiFetch('/api/papers/'+paperId+'/blocks').then(async r=>{const d=await r.json();if(!r.ok)throw Error(d.detail);setBlocks(d.blocks);setPageSizes(d.pages)}).catch(e=>setAiError(e.message))},[paperId]);
 const runAnalysis=async()=>{
  if(!paperId||!project)return;
  const targetPaper=paperId, targetProject=projectId, key=targetProject+':'+targetPaper;
  if(analysisStartRef.current.has(key)||['queued','running'].includes(paperJobs[key]?.status))return;
  analysisStartRef.current.add(key);setAiError('');setCacheMessage('');
  try{
   const response=await apiFetch('/api/analyse/start',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({paper_id:targetPaper,question:project.question,themes:project.topics})});
   const job=await response.json();if(!response.ok)throw Error(job.detail||'Could not start analysis');
   setPaperJobs(prev=>({...prev,[key]:job}));
   if(projectId===targetProject&&paperId===targetPaper){setAnalysisJob(['queued','running'].includes(job.status)?job:null);setMatches(job.matches||[])}
  }catch(e){setAiError(e.message)}finally{analysisStartRef.current.delete(key)}
 };
 const cancelAnalysis=async()=>{
  if(!paperId||!project)return;
  const key=projectId+':'+paperId,job=paperJobs[key];
  if(!job||!['queued','running'].includes(job.status))return;
  try{
   const response=await apiFetch('/api/analyse/jobs/'+encodeURIComponent(job.id)+'/cancel',{method:'POST'});
   const result=await response.json();if(!response.ok)throw Error(result.detail||'Unable to stop analysis');
   setPaperJobs(prev=>({...prev,[key]:result}));setAnalysisJob(null);
   setCacheMessage('Analysis cancelled. Completed highlights remain available. An in-flight provider request may still incur tokens.');
   apiFetch('/api/usage').then(r=>r.json()).then(setUsage).catch(()=>{});
  }catch(e){setAiError(e.message)}
 };
 const inspect=async m=>{const request=++passageRequestRef.current;sourceRequestRef.current++;clearNativeSelection();setSourceFocus(null);setFocusedHighlight(highlightKey({...m,paperId}));setRelationship('Unclassified');setSelected({...m,source:project.papers.find(p=>p.id===paperId)?.name+' · page '+m.page,analysis:'',paperId});setEditing('');setAiDetails(null);setPageNumber(m.page);setAssistant(true);setAssistantTab('analysis');setBusy(true);setAiError('');try{const r=await apiFetch('/api/passage',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({paper_id:paperId,block_id:m.id,question:project.question,theme:m.theme})});const d=await r.json();if(request!==passageRequestRef.current)return;if(!r.ok)throw Error(d.detail);setAiDetails(d);setEditing(d.interpretation);setCacheMessage(d.cache_hit?'Passage analysis loaded from cache (0 new tokens)':'New passage analysis generated');apiFetch('/api/usage').then(r=>r.json()).then(setUsage).catch(()=>{})}catch(e){if(request===passageRequestRef.current)setAiError(e.message)}finally{if(request===passageRequestRef.current)setBusy(false)}};
 useEffect(()=>{
  let alive=true;
  setSyncReady(false);setCloudError('');
  (async()=>{
   try{
    const {data,error}=await supabase.from('projects').select('id,name,research_question,data').eq('user_id',user.id).order('created_at',{ascending:true});
    if(!alive)return;
    if(error)throw Error('Cloud load failed: '+error.message);
    let rows=data||[];
    // Supabase projects.id is UUID. The authenticated user's UUID is a stable,
    // account-specific UUID for their one starter project (not a string prefix).
    const starterId=user.id;
    const hasExample=rows.some(row=>row.id===starterId||row.data?.name==='Example Project — AI in Literature Reviews');
    if(!hasExample){
     const example={...makeStarterProject(),id:starterId};
     const {error:insertError}=await supabase.from('projects').upsert({
      id:example.id,user_id:user.id,name:example.name,
      research_question:example.question,data:example
     },{onConflict:'id',ignoreDuplicates:true});
     if(!alive)return;
     if(insertError){
      // Starter content is optional; never lock users out of their actual projects.
      setCloudError('Example project unavailable: '+insertError.message);
     }else{
      const {data:refreshed,error:reloadError}=await supabase.from('projects').select('id,name,research_question,data').eq('user_id',user.id).order('created_at',{ascending:true});
      if(!alive)return;
      if(reloadError)setCloudError('Example project refresh failed: '+reloadError.message);
      else rows=refreshed||rows;
     }
    }
    if(!alive)return;
    setProjects(normalizeSeedPapers(rows.map(row=>({...row.data,id:row.id,name:row.name,question:row.research_question}))));
    setSyncReady(true);
   }catch(e){if(alive)setCloudError(e.message)}
  })();
  return()=>{alive=false};
 },[user.id,cloudRetry]);
 useEffect(()=>{if(!syncReady||!cloudPending.current.size)return;const timer=setTimeout(()=>{const ids=[...cloudPending.current];const snapshots=projects.filter(p=>ids.includes(p.id)&&!cloudDeleted.current.has(p.id));cloudPending.current.clear();if(!snapshots.length)return;setCloudSaving(true);cloudWrites.current=cloudWrites.current.catch(()=>{}).then(async()=>{for(const p of snapshots){if(cloudDeleted.current.has(p.id))continue;const {data:remote,error:readError}=await supabase.from('projects').select('data,updated_at').eq('id',p.id).eq('user_id',user.id).maybeSingle();if(readError)throw readError;if(!remote){cloudPending.current.add(p.id);throw Error('Cloud project missing; refusing to recreate it silently')}const merged={...p,papers:[...new Map([...(remote.data?.papers||[]),...(p.papers||[])].map(item=>[item.id,item])).values()]};const {data:saved,error}=await supabase.from('projects').update({name:merged.name,research_question:merged.question||'',data:merged,updated_at:new Date().toISOString()}).eq('id',p.id).eq('user_id',user.id).eq('updated_at',remote.updated_at).select('id').maybeSingle();if(error||!saved){cloudPending.current.add(p.id);throw Error(error?.message||'Concurrent cloud update; retry after reloading')}}}).then(()=>{setCloudError('');setCloudSaving(false)}).catch(e=>{setCloudError('Cloud save failed: '+e.message);setCloudSaving(false)})},650);return()=>clearTimeout(timer)},[projects,syncReady,user.id]);
 const setCloudProjects=(fn)=>setProjects(prev=>{const next=typeof fn==='function'?fn(prev):fn;for(const p of next){const before=prev.find(x=>x.id===p.id);if(before!==p)cloudPending.current.add(p.id)}return next});
 useEffect(()=>()=>Object.values(pdfUrls).forEach(url=>URL.revokeObjectURL(url)),[]);
 useEffect(()=>{
  setPageImageUrl(null);
  if(!paperId||!pageSizes.length)return;
  // The default PDF.js reader downloads the original PDF from Supabase.
  // Do not fetch a duplicate Render JPEG on every page turn.
  const currentProject=projects.find(p=>p.id===projectId);
  const hasCloudPdf=Boolean(currentProject?.papers?.some(p=>p.id===paperId&&p.storagePath));
  if(hasCloudPdf&&!legacyReader)return;
  let active=true;let objectUrl=null;
  apiFetch('/api/papers/'+encodeURIComponent(paperId)+'/pages/'+pageNumber+'/image?scale=1.7')
   .then(async response=>{if(!response.ok)throw Error('PDF page could not be loaded');return response.blob()})
   .then(blob=>{objectUrl=URL.createObjectURL(blob);if(active)setPageImageUrl(objectUrl);else URL.revokeObjectURL(objectUrl)})
   .catch(error=>{if(active){setPageImageUrl(null);setAiError(error.message)}});
  return ()=>{active=false;if(objectUrl)URL.revokeObjectURL(objectUrl)};
 },[paperId,pageNumber,pageSizes,legacyReader,projectId,projects]);

 const project=projects.find(p=>p.id===projectId);
 const resetReader=()=>{setLegacyReader(false);passageRequestRef.current++;sourceRequestRef.current++;sourceNavigationRef.current=null;setPaperId(null);setBlocks([]);setPageSizes([]);setMatches([]);setSelected(null);setFocusedHighlight(null);setSourceFocus(null);setAiDetails(null);setAnalysisJob(null);setCacheMessage('');setAiError('');setPageNumber(1);setEditing('');setBusy(false);setAssistantTab('highlights')};
 const enterProject=(id)=>{resetReader();setProjectId(id);setPage('overview')};
 // Poll independently for each paper in the active project. The server owns the job lifecycle.
 const paperIds=project?.papers.map(p=>p.id).join('|')||'';
 const themeSignature=JSON.stringify(project?.topics||[]);
 useEffect(()=>{
  if(!projectId||!project)return;
  let disposed=false,fetching=false;
  const refresh=async()=>{
   if(fetching||disposed)return;fetching=true;
   try{
    const query=new URLSearchParams({question:project.question,themes:JSON.stringify(project.topics)});
    const entries=await Promise.all(project.papers.map(async p=>{
     try{
      const response=await apiFetch('/api/analyse/papers/'+encodeURIComponent(p.id)+'/job?'+query);
      if(!response.ok)throw Error('Could not retrieve analysis job');
      const data=await response.json();return [projectId+':'+p.id,data.job||null];
     }catch{return [projectId+':'+p.id,undefined]}
    }));
    if(!disposed)setPaperJobs(prev=>{const next={...prev};for(const [key,job] of entries){if(job===null)delete next[key];else if(job)next[key]=job}return next});
   }finally{fetching=false}
  };
  refresh();const timer=setInterval(refresh,1400);
  return ()=>{disposed=true;clearInterval(timer)};
 },[projectId,paperIds,project?.question,themeSignature]);
 useEffect(()=>{
  const job=paperId?paperJobs[projectId+':'+paperId]:null;
  setAnalysisJob(job&&['queued','running'].includes(job.status)?job:null);
  if(job){setMatches(job.matches||[]);if(job.status==='failed')setAiError(job.error||'Analysis failed');else if(job.status==='partial')setCacheMessage((job.message||'Partial results. Retry analysis to complete failed batches.')+(job.batch_errors?.length?' Failure categories: '+[...new Set(job.batch_errors.map(e=>e.category))].join(', '):''));}
 },[projectId,paperId,paperJobs]);
 const refreshUsage=async()=>{
   setUsage(null);setUsageError('');
   if(!projectId){setUsageError('Select a project to view usage.');return}
   try{
     const response=await apiFetch('/api/usage?project_id='+encodeURIComponent(projectId));
     const data=await response.json();
     if(!response.ok)throw Error(data.detail||'Usage request failed (HTTP '+response.status+')');
     setUsage(data);
   }catch(error){setUsageError(error.message)}
 };
 useEffect(()=>{if(page==='settings'&&settingsTab==='ai')refreshUsage()},[page,settingsTab,projectId]);
 const update=(fn)=>setCloudProjects(prev=>prev.map(p=>p.id===projectId?fn(p):p));
 const toast=(s)=>{setMessage(s);setTimeout(()=>setMessage(''),3200)};
 const openPrivatePdf=async(paper)=>{
  if(!paper?.storagePath){setAiError('This paper has no cloud PDF.');return}
  // Open synchronously on user click, before the asynchronous signed URL request.
  const preview=window.open('about:blank','_blank');
  if(!preview){setAiError('Allow pop-ups for this site to open cloud PDFs.');return}
  try{
   const expected=user.id+'/'+project.id+'/'+paper.id+'.pdf';
   if(paper.storagePath!==expected)throw Error('PDF path does not belong to this project');
   const {data,error}=await supabase.storage.from('research-pdfs').createSignedUrl(expected,60);
   if(error||!data?.signedUrl)throw Error(error?.message||'Could not generate private PDF link');
   preview.location.replace(data.signedUrl);
  }catch(e){preview.close();setAiError('Unable to open private PDF: '+e.message)}
 };
  const storePrivatePdf=async(file,projectId,paperId)=>{
  if(!supabase)throw Error('Supabase Storage is not configured');
  if(file.size>20*1024*1024)throw Error('PDF must be under 20 MB');
  if(file.type!=='application/pdf'&&!file.name.toLowerCase().endsWith('.pdf'))throw Error('Only PDF files are supported');
  const path=user.id+'/'+projectId+'/'+paperId+'.pdf';
  const {error}=await supabase.storage.from('research-pdfs').upload(path,file,{contentType:'application/pdf',upsert:false});
  if(error)throw Error('Private PDF cloud upload failed: '+error.message);
  return path;
 };
 const addProject=async()=>{if(!draft.name.trim()||!draft.question.trim())return;setCreatingBusy(true);setCreateError('');try{
  const id=crypto.randomUUID();
  const topics=[...new Set([...draft.topics.split(',').map(s=>s.trim()).filter(Boolean),...draftSelected])];
  const initial={id,name:draft.name.trim(),question:draft.question.trim(),topics,papers:[],evidence:[]};
  const {error:projectError}=await supabase.from('projects').insert({
    id,user_id:user.id,name:initial.name,research_question:initial.question,data:initial
  });
  if(projectError)throw Error('Could not create cloud project: '+projectError.message);
  setCloudProjects(prev=>[...prev,initial]);resetReader();setProjectId(id);setPaperId(null);
  setSuggestions([]);setCreating(false);setDraftStep('details');setPage('papers');
  const pendingFiles=[...draftFiles];setDraftFiles([]);setDraft({name:'',question:'',topics:''});setDraftSuggestions([]);setDraftSelected([]);
  if(pendingFiles.length){
    try{await uploadFilesForProject(pendingFiles,id)}
    catch(uploadError){
      // The project exists; keep it accessible and show an actionable error.
      setAiError('Project created, but PDF upload was incomplete: '+uploadError.message+'. Re-upload the missing papers from Paper Library.');
    }
  }
 }catch(e){setCreateError(e.message)}finally{setCreatingBusy(false)}};
 const uploadFilesForProject=async(files,targetProjectId)=>{
  // Persist each paper independently so a later failure does not lose earlier uploads.
  const added=[];
  for(const file of files){
    // Render Free can take 50+ seconds to wake. Wake it before sending PDF bytes,
    // then give the actual upload its own deadline.
    setUploadStage('Checking backend availability (free server may be waking up)');
    const configuredApi=(import.meta.env.VITE_API_BASE_URL||'').trim().replace(/\/$/,'');
    if(configuredApi){
      const wakeController=new AbortController();
      const wakeTimeout=setTimeout(()=>wakeController.abort(),90000);
      try{
        const health=await fetch(configuredApi+'/api/health',{signal:wakeController.signal,cache:'no-store'});
        if(!health.ok)throw Error('Backend health HTTP '+health.status);
      }catch(error){
        throw Error('Backend unavailable before PDF upload: '+(error.name==='AbortError'?'wake-up exceeded 90 seconds':error.message)+'. The Render API may be asleep, unreachable, or blocking this site via CORS. Retry after checking the backend status.');
      }finally{clearTimeout(wakeTimeout)}
    }
    setUploadStage('Connecting to backend / parsing PDF');
    const fd=new FormData();fd.append('file',file);
    const controller=new AbortController();
    const timeout=setTimeout(()=>controller.abort(),120000);
    let r,d;
    try{
      r=await apiFetch('/api/papers?project_id='+encodeURIComponent(targetProjectId),{method:'POST',body:fd,signal:controller.signal});
      const raw=await r.text();
      try{d=JSON.parse(raw)}catch{d={detail:raw.slice(0,240)||'Non-JSON backend response'}}
      if(!r.ok)throw Error('Backend HTTP '+r.status+': '+(d.detail||'PDF processing failed'));
    }catch(error){
      throw Error('PDF backend upload: '+(error.name==='AbortError'?'timed out after 120 seconds':error.message));
    }finally{clearTimeout(timeout)}
    let storagePath=null;
    try{
      setUploadStage('Uploading PDF to private cloud storage');
      storagePath=await storePrivatePdf(file,targetProjectId,d.id);
      const paper={...d,seed:false,size:file.size,storagePath};
      setUploadStage('Saving PDF metadata to Project');
      const {data:row,error:loadError}=await supabase.from('projects').select('data,updated_at').eq('id',targetProjectId).eq('user_id',user.id).single();
      if(loadError)throw Error('Cloud metadata read failed: '+loadError.message);
      const papers=[...(row.data?.papers||[])];
      if(!papers.some(p=>p.id===paper.id))papers.push(paper);
      const next={...row.data,papers};
      const {data:saved,error:saveError}=await supabase.from('projects').update({data:next,updated_at:new Date().toISOString()}).eq('id',targetProjectId).eq('user_id',user.id).eq('updated_at',row.updated_at).select('id').maybeSingle();
      if(saveError)throw Error('Cloud metadata save failed: '+saveError.message);
      if(!saved)throw Error('Project changed during upload; please retry to avoid overwriting another device.');
      added.push(paper);
    }catch(uploadError){
      // Best-effort compensation; never hide cleanup failures.
      if(storagePath){
        const {error:cleanupError}=await supabase.storage.from('research-pdfs').remove([storagePath]);
        if(cleanupError)throw Error(uploadError.message+'; cloud cleanup also failed: '+cleanupError.message);
      }
      throw uploadError;
    }
    const paper=added[added.length-1];
    setCloudProjects(prev=>prev.map(p=>p.id===targetProjectId?{...p,papers:[...(p.papers||[]).filter(x=>x.id!==paper.id),paper]}:p));
    setPaperId(paper.id);
    setUploadStage('PDF saved successfully');
  }
  return added;
 };
 const finishProject=()=>{setCreating(false);setDraftStep('details');setDraft({name:'',question:'',topics:''});setPage('papers')};
 const upload=async(files)=>{if(!files?.length)return;setBusy(true);setAiError('');try{await uploadFilesForProject(files,project.id);toast('PDF saved privately to cloud.')}catch(e){setAiError(e.message)}finally{setBusy(false);setUploadStage('')}};
 const deleteProject=async p=>{if(!window.confirm('Delete project "'+p.name+'" and its research records? This cannot be undone.'))return;cloudDeleted.current.add(p.id);cloudPending.current.delete(p.id);await cloudWrites.current.catch(()=>{});
 const paths=(p.papers||[]).map(paper=>paper.storagePath).filter(Boolean);
 if(paths.length){const {error:storageError}=await supabase.storage.from('research-pdfs').remove(paths);if(storageError){cloudDeleted.current.delete(p.id);setCloudError('Could not remove project PDFs: '+storageError.message);return}}
 const {error}=await supabase.from('projects').delete().eq('id',p.id).eq('user_id',user.id);if(error){cloudDeleted.current.delete(p.id);setCloudError('Delete failed: '+error.message);return}setProjects(old=>old.filter(x=>x.id!==p.id));if(projectId===p.id){setProjectId(null);setPaperId(null)}toast('Project deleted from cloud')};
 const deletePaper=async p=>{
  const linked=project.evidence.filter(e=>e.paperId===p.id).length;
  if(!window.confirm('Delete "'+p.name+'"? '+linked+' linked evidence records will also be removed.'))return;
  setAiError('');
  try{
    // Keep cloud metadata intact if the private Storage operation fails.
    if(p.storagePath){
      const expected=user.id+'/'+project.id+'/'+p.id+'.pdf';
      if(p.storagePath!==expected)throw Error('PDF storage path does not match this project');
      const {error}=await supabase.storage.from('research-pdfs').remove([p.storagePath]);
      if(error)throw Error('Cloud PDF deletion failed: '+error.message);
    }
    // Local cleanup is best-effort: a fresh device may have no local copy.
    const response=await apiFetch('/api/papers/'+encodeURIComponent(p.id),{method:'DELETE'});
    if(!response.ok && response.status!==404){
      const detail=await response.json().catch(()=>({}));
      setAiError('Cloud PDF removed, but local cleanup failed: '+(detail.detail||response.status)+'. Local cleanup may be required.');
    }
    update(pr=>({...pr,papers:pr.papers.filter(x=>x.id!==p.id),evidence:pr.evidence.filter(e=>e.paperId!==p.id),networkLinks:(pr.networkLinks||[]).filter(l=>!pr.evidence.some(e=>e.paperId===p.id&&(e.id===l.source_id||e.id===l.target_id)))}));
    if(paperId===p.id)setPaperId(project.papers.find(x=>x.id!==p.id)?.id||null);
    toast('Paper removed from project');
  }catch(error){setAiError(error.message)}
 };
 const editPaper=p=>setPaperEditor({...p});
 const savePaperMetadata=()=>{if(!paperEditor)return;const name=String(paperEditor.name||'').trim();if(!name){toast('Please enter a display name for this PDF.');return;}update(p=>({...p,papers:p.papers.map(x=>x.id===paperEditor.id?{...x,...paperEditor,name,metadata_status:'user_confirmed'}:x)}));setPaperEditor(null);toast('Paper name and metadata saved.')};
 const renameTheme=(oldName)=>{const name=window.prompt('Rename theme',oldName)?.trim();if(!name||name===oldName||project.topics.includes(name))return;update(p=>({...p,topics:p.topics.map(t=>t===oldName?name:t),evidence:p.evidence.map(e=>({...e,theme:e.theme===oldName?name:e.theme,themes:[...new Set([...(e.themes||[e.theme]).map(t=>t===oldName?name:t)])]}))}));setMatches([])};
 const deleteTheme=(name)=>{if(!window.confirm('Delete theme "'+name+'"? Its evidence will be moved to Uncategorised.'))return;update(p=>({...p,topics:p.topics.filter(t=>t!==name),evidence:p.evidence.map(e=>{const themes=(e.themes||[e.theme]).filter(t=>t!==name);return {...e,themes:themes.length?themes:['Uncategorised'],theme:e.theme===name?(themes[0]||'Uncategorised'):e.theme}})}));setMatches([])};
 const saveEvidence=()=>{if(!selected)return;const duplicate=existingEvidence(project,selected);if(duplicate){toast('Already saved. Open the existing evidence in Evidence Map.');return;}const record={...selected,id:crypto.randomUUID(),themes:[...new Set([...(selected.themeNames||[]),selected.theme].filter(Boolean))],analysis:editing||selected.analysis,relationship,verifiedAt:new Date().toISOString(),verified:!!selected.paperId};update(p=>existingEvidence(p,selected)?p:{...p,evidence:[...p.evidence,record]});clearHighlightFocus();toast('Verified evidence saved to Evidence Map.');};
 const savedSelected=selected?existingEvidence(project,selected):null;
 const highlightRecords=(()=>{const combined=new Map();for(const m of highlightCandidates){const key=highlightKey(m);if(key)combined.set(key,m)}for(const m of matches){const full={...m,paperId};const key=highlightKey(full);if(key)combined.set(key,full)}for(const e of project?.evidence||[]){const key=highlightKey(e);if(key&&!combined.has(key))combined.set(key,e)}for(const key of project?.rejected||[]){if(!combined.has(key)){const [paperId,page,...quote]=key.split('|');combined.set(key,{paperId,page:Number(page)||1,quote:quote.join('|'),theme:'Uncategorised'})}}return [...combined.values()].map(m=>({...m,reviewStatus:(project?.rejected||[]).includes(highlightKey(m))?'rejected':existingEvidence(project,m)?'verified':'pending'}))})();
 const visibleHighlightRecords=highlightRecords.filter(m=>(highlightFilter==='all'||m.reviewStatus===highlightFilter)&&(!highlightPaperFilter||m.paperId===highlightPaperFilter)&&[m.quote,m.text,m.theme,project?.papers.find(p=>p.id===m.paperId)?.name].some(v=>String(v||'').toLowerCase().includes(highlightSearch.trim().toLowerCase())));
 useEffect(()=>{if(!projectId||page!=='highlights')return;let cancelled=false;setHighlightLoading(true);setHighlightLoadError('');apiFetch('/api/projects/'+encodeURIComponent(projectId)+'/highlight-candidates').then(async r=>{const data=await r.json();if(!r.ok)throw Error(data.detail||'Could not load highlights');if(!cancelled)setHighlightCandidates(data.candidates||[])}).catch(e=>{if(!cancelled)setHighlightLoadError(e.message)}).finally(()=>{if(!cancelled)setHighlightLoading(false)});return ()=>{cancelled=true}},[projectId,page]);
 const openHighlightRecord=m=>{setPaperId(m.paperId);setPageNumber(Number(m.page)||1);setPage('papers');setAssistant(true);setAssistantTab('highlights');setSelected(null);setFocusedHighlight(highlightKey(m));setFocusOnly(false)};

 const visibleThemes=activeThemes===null?(project?.topics||[]):activeThemes;
 const rejected=project?.rejected||[];
 const visibleMatches=matches.filter(m=>visibleThemes.includes(m.theme)&&!rejected.includes(highlightKey({...m,paperId})));
 const displayMatches=Object.values(visibleMatches.reduce((acc,m)=>{const key=m.page+'|'+(m.quote||m.text||'').trim().toLowerCase();if(!acc[key])acc[key]={...m,themeNames:[m.theme]};else if(!acc[key].themeNames.includes(m.theme))acc[key].themeNames.push(m.theme);return acc},{})).map(m=>({...m,theme:[...m.themeNames].sort((a,b)=>project.topics.indexOf(a)-project.topics.indexOf(b))[0]}));
 const clearHighlightFocus=()=>{passageRequestRef.current++;sourceRequestRef.current++;setSelected(null);setFocusedHighlight(null);setSourceFocus(null);setAiDetails(null);setEditing('');setBusy(false);clearNativeSelection()};
 const rejectSelected=()=>{if(!selected)return;const key=highlightKey(selected);update(p=>({...p,rejected:[...new Set([...(p.rejected||[]),key])]}));clearHighlightFocus();toast('Highlight rejected and hidden. Restore it in Project Settings.');};
 const locateEvidence=async e=>{
   // Locating the already selected passage must not cancel its pending
   // analysis request or discard the interpretation loaded from cache.
   const samePassage=selected&&highlightKey(selected)===highlightKey(e);
   if(!samePassage){passageRequestRef.current++;setBusy(false);setAiDetails(null)}
   const sourceRequest=++sourceRequestRef.current;
   clearNativeSelection();setFocusedHighlight(highlightKey(e));
   sourceNavigationRef.current={paperId:e.paperId,page:e.page};
   setPaperId(e.paperId);setPageNumber(e.page);setPage('papers');setAssistant(true);setAssistantTab('analysis');
   setSelected(prev=>samePassage?prev:e);if(!samePassage)setEditing(e.analysis||'');setRelationship(e.relationship||'Unclassified');setFocusOnly(true);
   setSourceFocus(null);
   if(!e.paperId||!e.page||!(e.quote||e.text))return;
   try{
    const r=await apiFetch('/api/papers/'+e.paperId+'/locate',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({page:e.page,quote:e.quote||e.text,block_rect:e.rect||null})});
    const d=await r.json();if(!r.ok)throw Error(d.detail||'Cannot locate quote');
    if(sourceRequest!==sourceRequestRef.current)return;
    setSourceFocus({paperId:e.paperId,page:e.page,rects:d.rects||[],found:d.found});
    if(!d.found)toast('Source page opened; exact quote could not be located.');
   }catch(err){if(sourceRequest===sourceRequestRef.current)setAiError(err.message)}
 };
 useEffect(()=>{
   if(!sourceFocus||sourceFocus.paperId!==paperId||sourceFocus.page!==pageNumber||!pageSizes[pageNumber-1])return;
   const frame=requestAnimationFrame(()=>{
    const canvas=pdfCanvasRef.current,scroller=pdfScrollRef.current;
    if(!canvas||!scroller||!sourceFocus.rects[0])return;
    const rect=sourceFocus.rects[0],dims=pageSizes[pageNumber-1];
    scroller.scrollTo({top:canvas.offsetTop+rect[1]/dims.height*canvas.clientHeight-140,left:canvas.offsetLeft+rect[0]/dims.width*canvas.clientWidth-100,behavior:'smooth'});
   });
   return ()=>cancelAnimationFrame(frame);
 },[sourceFocus,paperId,pageNumber,pageSizes,zoom,page]);
 useEffect(()=>{if(!projectId)return;if(paperId&&!project?.papers.some(p=>p.id===paperId)){resetReader()}},[projectId,paperId,project?.papers]);
 const evidenceThemes=e=>Array.from(new Set((Array.isArray(e.themes)&&e.themes.length?e.themes:[e.theme]).filter(Boolean)));
 const loadSavedExcerpts=async()=>{
  if(!projectId||!supabase)return;
  setExcerptsLoading(true);setExcerptsError('');
  const {data,error}=await supabase.from('saved_excerpts').select('id,project_id,quote,note,source_title,source_url,captured_at') .eq('project_id',projectId).eq('user_id',user.id).order('captured_at',{ascending:false}).limit(200);
  if(error){setExcerptsError(error.message);setSavedExcerpts([]);}
  else setSavedExcerpts(data||[]);
  setExcerptsLoading(false);
 };
 useEffect(()=>{
  if(manualEvidenceOpen&&evidenceEntryMode==='excerpts')loadSavedExcerpts();
 },[manualEvidenceOpen,evidenceEntryMode,projectId]);
 const selectSavedExcerpt=id=>{
  setSelectedExcerptId(id);
  const excerpt=savedExcerpts.find(x=>x.id===id);
  if(!excerpt)return;
  setManualEvidence(p=>({...p,sourceType:'web',sourceTitle:excerpt.source_title||'',sourceUrl:excerpt.source_url||'',quote:excerpt.quote||'',analysis:excerpt.note||''}));
 };
 const createManualEvidence=()=>{
  const d=manualEvidence;
  const excerpt=evidenceEntryMode==='excerpts'?savedExcerpts.find(x=>x.id===selectedExcerptId):null;
  if(evidenceEntryMode==='excerpts'&&!excerpt){toast('Select a saved excerpt first.');return;}
  if(excerpt&&(excerpt.project_id!==projectId)){toast('This excerpt belongs to another project.');return;}
  if(excerpt&&(project.evidence||[]).some(e=>e.savedExcerptId===excerpt.id)){toast('This excerpt is already in the Evidence Map.');return;}
  if(!d.quote.trim()||!d.theme){toast('Enter evidence text and select a theme.');return;}
  if(d.sourceUrl.trim()){
   try{const url=new URL(d.sourceUrl);if(!['https:','http:'].includes(url.protocol))throw Error();}
   catch{toast('Source URL must be an HTTP(S) link.');return;}
  }
  const record={id:crypto.randomUUID(),...(excerpt?{savedExcerptId:excerpt.id,capturedAt:excerpt.captured_at}:{}),sourceType:d.sourceType,sourceTitle:d.sourceTitle.trim(),sourceUrl:d.sourceUrl.trim(),quote:d.quote.trim(),text:d.quote.trim(),analysis:d.analysis.trim(),theme:d.theme,themes:[d.theme],relationship:d.relationship,verificationStatus:'unverified',status:'unverified',verified:false,createdAt:new Date().toISOString()};
  update(p=>({...p,evidence:[...(p.evidence||[]),record]}));
  setManualEvidenceOpen(false);setSelectedExcerptId('');setEvidenceEntryMode('manual');
  setManualEvidence({sourceType:'web',sourceTitle:'',sourceUrl:'',quote:'',analysis:'',theme:'',relationship:'Unclassified'});
  setMapView('list');setMapTheme(null);toast('Unverified evidence added to this project.');
 };

 const themeMatches=(e,t)=>evidenceThemes(e).includes(t);
 const hasMapFilters=!!(mapQuery.trim()||mapThemeFilter.length||mapPaperFilter||mapRelationshipFilter||mapYearFilter||mapYearTo||mapAuthorFilter.trim()||(mapView==='list'&&rqListFocus));
 const mapRecords=(project?.evidence||[]).filter(e=>{
  const paper=project.papers.find(p=>p.id===e.paperId);
  if(mapView==='list'&&rqListFocus&&!themeMatches(e,rqListFocus))return false;
  if(mapThemeFilter.length&&!mapThemeFilter.some(t=>themeMatches(e,t)))return false;
  if(mapPaperFilter&&e.paperId!==mapPaperFilter)return false;
  if(mapRelationshipFilter&&(e.relationship||'Unclassified')!==mapRelationshipFilter)return false;
  const year=Number(paper?.year);
  if(mapYearFilter&&(!Number.isFinite(year)||year<Number(mapYearFilter)))return false;
  if(mapYearTo&&(!Number.isFinite(year)||year>Number(mapYearTo)))return false;
  if(mapAuthorFilter&&!String(paper?.authors||'').toLowerCase().includes(mapAuthorFilter.trim().toLowerCase()))return false;
  const fields=[e.text,e.quote,e.analysis,e.theme,...evidenceThemes(e),e.relationship,e.source,paper?.name,paper?.authors,paper?.year,paper?.venue];
  return fields.some(x=>String(x||'').toLowerCase().includes(mapQuery.trim().toLowerCase()));
 }).sort((a,b)=>mapSort==='paper'?String(project.papers.find(p=>p.id===a.paperId)?.name||'').localeCompare(String(project.papers.find(p=>p.id===b.paperId)?.name||'')):mapSort==='theme'?String(a.theme||'').localeCompare(String(b.theme||'')):mapSort==='oldest'?String(a.verifiedAt||'').localeCompare(String(b.verifiedAt||'')):String(b.verifiedAt||'').localeCompare(String(a.verifiedAt||'')));
 const rqDimensions=project?.researchDimensions||[];
 const rqMappedIds=dim=>new Set(dim.evidenceIds||[]);
 const rqMapEvidence=dim=>project.evidence.filter(e=>rqMappedIds(dim).has(e.id));
 const addRqDimension=()=>{const name=rqDimensionDraft.trim();if(!name||rqDimensions.some(d=>d.name.toLowerCase()===name.toLowerCase()))return;update(p=>({...p,researchDimensions:[...(p.researchDimensions||[]),{id:crypto.randomUUID(),name,evidenceIds:[],finding:'',gap:''}]}));setRqDimensionDraft('')};
 const editRqDimension=(id,patch)=>update(p=>({...p,researchDimensions:(p.researchDimensions||[]).map(d=>d.id===id?{...d,...patch}:d)}));
 const removeRqDimension=id=>{if(!window.confirm('Delete this research dimension? Evidence records will be preserved.'))return;update(p=>({...p,researchDimensions:(p.researchDimensions||[]).filter(d=>d.id!==id)}));if(rqActiveDimension===id)setRqActiveDimension(null)};
 const toggleRqEvidence=(dim,id,checked)=>update(p=>({...p,researchDimensions:(p.researchDimensions||[]).map(d=>d.id===dim?{...d,evidenceIds:checked?[...new Set([...(d.evidenceIds||[]),id])]:(d.evidenceIds||[]).filter(x=>x!==id)}:d)}));
 const resetMapFilters=()=>{setRqListFocus(null);setMapQuery('');setMapThemeFilter([]);setMapPaperFilter('');setMapRelationshipFilter('');setMapYearFilter('');setMapYearTo('');setMapAuthorFilter('');setMapTheme(null)};
 const duplicateGroups=Object.values((project?.evidence||[]).reduce((groups,e)=>{const key=highlightKey(e);(groups[key]??=[]).push(e);return groups},{})).filter(group=>group.length>1);
 const toggleEvidenceSelection=id=>setSelectedEvidenceIds(old=>old.includes(id)?old.filter(x=>x!==id):[...old,id]);
 const bulkUpdate=()=>{if(!selectedEvidenceIds.length)return;if(!bulkTheme&&!bulkRelationship)return;const ids=new Set(selectedEvidenceIds);update(p=>({...p,evidence:p.evidence.map(e=>!ids.has(e.id)?e:{...e,...(bulkTheme?{theme:bulkTheme,themes:[bulkTheme]}:{}),...(bulkRelationship?{relationship:bulkRelationship}:{})})}));setSelectedEvidenceIds([]);toast('Selected evidence updated.')};
 const bulkDelete=()=>{if(!selectedEvidenceIds.length||!window.confirm('Permanently delete '+selectedEvidenceIds.length+' selected evidence records and their connections?'))return;const ids=new Set(selectedEvidenceIds);update(p=>({...p,evidence:p.evidence.filter(e=>!ids.has(e.id)),networkLinks:(p.networkLinks||[]).filter(l=>!ids.has(l.source_id)&&!ids.has(l.target_id))}));setSelectedEvidenceIds([]);toast('Selected evidence deleted.')};
 const mergeDuplicateGroup=(group,keepId)=>{const ids=new Set(group.map(e=>e.id).filter(id=>id!==keepId));if(!window.confirm('Keep the selected evidence and remove '+ids.size+' duplicates? Connections will be redirected to the kept record.'))return;update(p=>{const links=(p.networkLinks||[]).map(l=>({...l,source_id:ids.has(l.source_id)?keepId:l.source_id,target_id:ids.has(l.target_id)?keepId:l.target_id})).filter(l=>l.source_id!==l.target_id);const seen=new Set();return {...p,evidence:p.evidence.filter(e=>!ids.has(e.id)),networkLinks:links.filter(l=>{const key=[l.source_id,l.target_id].sort().join('|');if(seen.has(key))return false;seen.add(key);return true})}});toast('Duplicates merged.')};
 const suggestThemesFromSeed=async()=>{const seed=project?.papers.find(p=>p.seed);if(!seed){toast('Choose a Primary Seed Paper first.');return;}setBusy(true);setAiError('');try{const response=await apiFetch('/api/themes/suggest',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({question:project.question,topics:project.topics,paper_ids:[seed.id]})});const result=await response.json();if(!response.ok)throw Error(result.detail||'Seed theme suggestion failed');setSuggestions(result.themes||[]);if(!(result.themes||[]).length)toast('No additional themes suggested for this Seed Paper.');else toast('Seed-based theme suggestions ready for review.')}catch(err){setAiError('Seed theme suggestions: '+err.message)}finally{setBusy(false)}};
 const suggestDraft=async()=>{if(!draft.question.trim())return;setDraftSuggestBusy(true);setCreateError('');setDraftSuggestionNotice('Generating themes from your research question...');try{const r=await apiFetch('/api/themes/suggest',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({question:draft.question,topics:draft.topics.split(',').map(x=>x.trim()).filter(Boolean),paper_ids:[]})});const d=await r.json();if(!r.ok)throw Error(d.detail||'Theme suggestions unavailable');setDraftSuggestions(d.themes||[]);setDraftSuggestionNotice((d.themes||[]).length+' suggestions available. Select any themes to add.');if(!(d.themes||[]).length)setCreateError('No suggestions returned. Try refining your research question.')}catch(e){setCreateError('Theme suggestions failed: '+e.message);setDraftSuggestionNotice('')}finally{setDraftSuggestBusy(false)}};
 const proposeNetwork=async()=>{
  if(project.evidence.length<2)return;
  setNetworkBusy(true);setAiError('');setNetworkNotice('');setNetworkProposals([]);
  try{
   const response=await apiFetch('/api/network/propose',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({question:project.question,evidence:project.evidence.map(e=>({id:e.id,theme:e.theme,quote:e.quote||e.text,analysis:e.analysis,source:e.source}))})});
   const data=await response.json();if(!response.ok)throw Error(data.detail||'Network suggestions failed');
   const savedPairs=new Set((project.networkLinks||[]).map(e=>[e.source_id,e.target_id].sort().join('|')));
   const newLinks=(data.links||[]).filter(e=>!savedPairs.has([e.source_id,e.target_id].sort().join('|')));setNetworkProposals(newLinks);if(!newLinks.length)setNetworkNotice('No new relationships were suggested. This can be a valid result for a small or inconclusive evidence set. You can create a reviewed connection below.');
   toast((data.links||[]).length+' suggested relationships. Review before adding.');
  }catch(err){setNetworkNotice('Could not generate connections: '+err.message)}finally{setNetworkBusy(false)}
 };
 const acceptNetworkLink=edge=>{
  if(!project.evidence.some(e=>e.id===edge.source_id)||!project.evidence.some(e=>e.id===edge.target_id))return;
  if((project.networkLinks||[]).some(l=>[l.source_id,l.target_id].sort().join('|')===[edge.source_id,edge.target_id].sort().join('|')))return;
  update(p=>({...p,networkLinks:[...(p.networkLinks||[]),{...edge,status:'verified',verifiedAt:new Date().toISOString()}]}));
  setNetworkProposals(old=>old.filter(e=>e.id!==edge.id));toast('Evidence relationship verified.');
 };
 const dismissNetworkLink=edge=>setNetworkProposals(old=>old.filter(e=>e.id!==edge.id));
 const removeNetworkLink=edge=>{if(!window.confirm('Remove this verified evidence relationship?'))return;update(p=>({...p,networkLinks:(p.networkLinks||[]).filter(e=>e.id!==edge.id)}));setNetworkSelected(null)};
 const generateSynthesis=async()=>{if(!project.evidence.length)return;setSynthesisBusy(true);setAiError('');try{const r=await apiFetch('/api/synthesis',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({question:project.question,evidence:project.evidence.map(e=>({id:e.id,theme:e.theme,quote:e.quote||e.text,interpretation:e.analysis,relationship:e.relationship||'Unclassified',source:e.source}))})});const d=await r.json();if(!r.ok)throw Error(d.detail||'Synthesis failed');setSynthesis({...d,projectId:project.id,sourceSignature:JSON.stringify(project.evidence.map(e=>[e.id,e.analysis,e.relationship]))})}catch(e){setAiError(e.message)}finally{setSynthesisBusy(false)}};
 const nav=[['overview','Overview',LayoutDashboard],['papers','Paper Library',BookOpen],['map','Evidence Map',Network],['writing','Academic Writing',FilePenLine],['settings','Project Settings',Settings]];
 if(!syncReady)return <div className="v61-auth-loading"><div><p>{cloudError||'Loading your cloud projects…'}</p>{cloudError&&<button className="secondary" onClick={()=>setCloudRetry(x=>x+1)}>Retry Cloud Load</button>}</div></div>;
 return <div className="app">
 <aside className="sidebar"><div className="brand"><div className="brandmark"><Network size={20}/></div><div><strong>Research Workspace</strong><small>V6.0</small></div></div>
 <button className="all-projects" onClick={()=>{setProjectId(null);setCreating(false)}}><ArrowLeft size={16}/> All projects</button>
 {project&&<><div className="project-chip"><span className="eyebrow">CURRENT PROJECT</span><strong>{project.name}</strong><small>{project.papers.length} papers · {project.evidence.length} verified</small></div><div className="nav-label">WORKSPACE</div><nav>{nav.map(([id,label,Icon])=><button key={id} className={page===id?'active':''} onClick={()=>{setPage(id);setSelected(null)}}><Icon size={17}/>{label}{id==='writing'&&<span className="future">Future</span>}</button>)}</nav></>}
 <div className="v61-cloud-status" role="status">{cloudSaving?'Saving…':cloudError?<><span>{cloudError}</span><button className="secondary" onClick={()=>setCloudProjects(prev=>prev.map(p=>({...p}))) }>Retry</button></>:'Projects synced'}</div>
 </aside>
 <main className="main"><header className="topbar"><div className="breadcrumb">{project?'My Projects  /  '+project.name:'My Projects'}</div></header>
 {!project?<div className="content"><div className="heading"><div><div className="eyebrow">YOUR RESEARCH SPACE</div><h1>My Projects</h1><p>Organise papers, verify findings, and connect evidence in one place.</p></div><button className="primary" onClick={()=>setCreating(true)}><Plus size={17}/> New project</button></div><div className="project-grid">{projects.map(p=><button className="project-card" key={p.id} onClick={()=>enterProject(p.id)}><div className="folder-icon"><FolderOpen size={24}/></div><strong>{p.name}</strong><p>{p.question}</p><div className="card-footer">{p.papers.length} papers · {p.evidence.length} evidence <ChevronRight size={17}/></div><span className="delete-project" onClick={e=>{e.stopPropagation();deleteProject(p)}}><Trash2 size={14}/> Delete project</span></button>)}</div>{creating&&<div className="modal-backdrop"><div className="modal"><div className="modal-head"><h2>{draftStep==='details'?'Create Research Project':'Review Research Themes'}</h2><button className="icon-btn" onClick={()=>{setCreating(false);setDraftStep('details')}}><X size={19}/></button></div>{draftStep==='details'?<><label>Project name<input value={draft.name} onChange={e=>setDraft({...draft,name:e.target.value})} placeholder="e.g. UV Exposure Research"/></label><label>Research question<textarea rows="3" value={draft.question} onChange={e=>setDraft({...draft,question:e.target.value})} placeholder="What would you like to investigate?"/></label><label>Initial research topics (comma-separated)<input value={draft.topics} onChange={e=>setDraft({...draft,topics:e.target.value})} placeholder="UV exposure, Sun protection"/></label><label className="file-drop">Upload research papers (PDF, multiple allowed)<input type="file" accept=".pdf,application/pdf" multiple onChange={e=>setDraftFiles(Array.from(e.target.files||[]))}/></label>{draftFiles.map((file,i)=><div className="draft-paper" key={i}><FileText size={15}/>{file.name}<button className="tiny" onClick={()=>setDraftFiles(old=>old.filter((_,j)=>j!==i))}>Remove</button></div>)}<div className="suggestion-box"><button className="secondary" disabled={draftSuggestBusy||!draft.question.trim()} onClick={suggestDraft}>{draftSuggestBusy?'Generating...':'✦ Suggest Themes with AI'}</button><p className="hint">Suggestions use your research question; select the ones to add. You can refine them after uploading papers.</p>{draftSuggestionNotice&&<p className="hint" role="status">{draftSuggestionNotice}</p>}<div className="suggestion-chips">{draftSuggestions.map(t=><button key={t.name} title={t.basis} className={'secondary '+(draftSelected.includes(t.name)?'selected-chip':'')} onClick={()=>setDraftSelected(old=>old.includes(t.name)?old.filter(x=>x!==t.name):[...old,t.name])}>{draftSelected.includes(t.name)?'✓ ':'+ '}{t.name}</button>)}</div></div><p className="hint">You can mark seed papers later in Paper Library. PDFs are uploaded when you create the project.</p>{createError&&<div className="notice error">{createError}</div>}<div className="modal-actions"><button className="secondary" onClick={()=>setCreating(false)}>Cancel</button><button className="primary" disabled={creatingBusy||!draft.name.trim()||!draft.question.trim()} onClick={addProject}>{creatingBusy?'Uploading and analysing...':'Create Project'}</button></div></>:<><p>Review AI suggestions based on your research question and uploaded papers. These are candidates, not established field-wide themes.</p>{suggestions.map((t,i)=><div className="suggestion" key={i}><strong>{t.name}</strong><p>{t.basis}</p><button className="secondary" onClick={()=>{update(pr=>({...pr,topics:pr.topics.includes(t.name)?pr.topics:[...pr.topics,t.name]}));setSuggestions(old=>old.filter((_,j)=>j!==i))}}>Add theme</button></div>)}<p className="hint">Your original topics remain editable in Project Settings.</p>{createError&&<div className="notice error">{createError}</div>}<div className="modal-actions"><button className="primary" onClick={finishProject}>Confirm & Open Workspace</button></div></>}</div></div>}</div>:
 <div className="content"><div className="heading"><div><div className="eyebrow">{page.toUpperCase()}</div><h1>{page==='highlights'?'Highlight Manager':nav.find(n=>n[0]===page)?.[1]}</h1><p>{page==='overview'?project.question:page==='papers'?'Your reading library and source-linked research assistant.':page==='highlights'?'Review AI candidates before promoting them to evidence.':page==='map'?'Evidence reviewed and approved by you.':page==='writing'?'Planned future module.':'Manage your research context and themes.'}</p></div>{page==='papers'&&<button className="secondary" onClick={()=>setPage('highlights')}><Highlighter size={16}/> Highlight Manager</button>}{page==='papers'&&<label className="primary upload-button"><Upload size={17}/> Upload PDF<input type="file" accept=".pdf,application/pdf" multiple hidden onChange={e=>{upload(e.target.files);e.target.value=''}}/></label>}</div>
 {page==='highlights'&&<section className="panel v5-highlight-manager"><div className="v5-section-heading"><div><h2>Highlight Manager</h2><p>AI candidates are not verified evidence until reviewed by you.</p></div><button className="secondary" onClick={()=>setPage('papers')}><BookOpen size={15}/> PDF Reader</button></div><div className="v5-summary-grid">{['pending','verified','rejected'].map(status=><button key={status} className={'v5-summary-stat '+(highlightFilter===status?'active':'')} onClick={()=>setHighlightFilter(highlightFilter===status?'all':status)}><strong>{highlightRecords.filter(m=>m.reviewStatus===status).length}</strong><span>{status==='pending'?'Pending Review':status==='verified'?'Verified Evidence':'Rejected'}</span></button>)}</div><div className="v5-review-toolbar"><input aria-label="Search highlights" placeholder="Search highlighted passages or themes..." value={highlightSearch} onChange={e=>setHighlightSearch(e.target.value)}/><select aria-label="Highlight status" value={highlightFilter} onChange={e=>setHighlightFilter(e.target.value)}>{['all','pending','verified','rejected'].map(t=><option key={t} value={t}>{t==='all'?'All statuses':t}</option>)}</select><select aria-label="Highlight paper" value={highlightPaperFilter} onChange={e=>setHighlightPaperFilter(e.target.value)}><option value="">All papers</option>{project.papers.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select></div>{highlightLoading&&<p className="hint">Loading cached highlights...</p>}{highlightLoadError&&<p className="notice">{highlightLoadError}</p>}<p className="hint">{visibleHighlightRecords.length} matching passages · Cached AI suggestions may come from earlier analysis contexts.</p><div className="v5-highlight-list">{visibleHighlightRecords.map((m,i)=><article className="v5-highlight-row" key={highlightKey(m)+i}><div className="v5-highlight-meta"><span>{project.papers.find(p=>p.id===m.paperId)?.name||'Unknown paper'} · Page {m.page}</span><span className={'v5-status '+m.reviewStatus}>{m.reviewStatus}</span></div><blockquote>{m.quote||m.text}</blockquote><div className="v5-highlight-actions"><span>{m.theme||'Uncategorised'}</span><button className="secondary" onClick={()=>openHighlightRecord(m)}>View in PDF ↗</button>{m.reviewStatus==='rejected'?<button className="secondary" onClick={()=>update(p=>({...p,rejected:(p.rejected||[]).filter(key=>key!==highlightKey(m))}))}>Restore</button>:m.reviewStatus==='verified'?<button className="secondary" onClick={()=>{setPage('map');setMapView('theme');setMapTheme(existingEvidence(project,m)?.theme||null)}}>View Evidence</button>:<button className="secondary" onClick={()=>{update(p=>({...p,rejected:[...new Set([...(p.rejected||[]),highlightKey(m)])]}))}}>Reject</button>}</div></article>)}{!visibleHighlightRecords.length&&<div className="empty">No highlights match your filters.</div>}</div></section>}
 {page==='overview'&&<><div className="stats"><div className="stat"><span>Research Papers</span><strong>{project.papers.length}</strong><small>Uploaded in this project</small></div><div className="stat"><span>Research Themes</span><strong>{project.topics.length}</strong><small>Customisable topics</small></div><div className="stat"><span>Verified Evidence</span><strong>{project.evidence.length}</strong><small>Human-reviewed records</small></div></div><div className="two-cols"><section className="panel"><h2>Primary Seed Paper</h2><p>The single anchor paper for AI-assisted theme discovery. Changing it does not delete existing evidence or automatically change your themes.</p><div className="seed-settings">{project.papers.find(p=>p.seed)?<><strong>★ {project.papers.find(p=>p.seed)?.title||project.papers.find(p=>p.seed)?.name}</strong><span>Primary Seed · {project.papers.find(p=>p.seed)?.year||'Year unknown'}</span><button className="secondary" disabled={busy} onClick={suggestThemesFromSeed}>{busy?'Generating...':'Suggest Themes from Seed Paper'}</button></>:<p className="hint">No Primary Seed selected. Choose one in Paper Library.</p>}</div>{suggestions.length>0&&<div className="seed-suggestions"><h3>Suggested Themes from Seed</h3>{suggestions.map(t=><div className="seed-suggestion" key={t.name}><div><strong>{t.name}</strong><p className="hint">{t.basis}</p></div><button className="secondary" disabled={project.topics.includes(t.name)} onClick={()=>update(pr=>({...pr,topics:[...pr.topics,t.name]}))}>{project.topics.includes(t.name)?'Added':'+ Add Theme'}</button></div>)}</div>}<h2>Research Themes</h2><p>Topics guiding your reading and analysis.</p><div className="tags">{project.topics.length?project.topics.map(t=><span className="tag theme-tinted" key={t} style={{background:themeColor(project.topics,t)+'40',color:'#29243D'}}>{t}</span>):<span className="muted">No themes yet. Add them in Project Settings.</span>}</div><button className="text-link" onClick={()=>setPage('settings')}>Manage themes →</button></section><section className="panel"><h2>Evidence Coverage</h2><p>Verified evidence by research theme. Select a theme to manage it.</p>{project.topics.map(t=><button className="coverage-row" key={t} onClick={()=>setPage('map')}><span className="theme-swatch" style={{background:themeColor(project.topics,t)}}/>{t}<strong>{project.evidence.filter(e=>e.theme===t).length}</strong><ChevronRight size={15}/></button>)}</section></div><section className="panel"><h2>Recent Verified Evidence</h2><p>Latest reviewed records only; automatic cross-paper synthesis is not yet implemented.</p>{project.evidence.length?<><div className="overview-insights">{project.evidence.slice(-insightLimit).reverse().map(e=><div className="evidence-row" key={e.id}><span className="tag theme-tinted" style={{background:themeColor(project.topics,e.theme)+'40',color:'#29243D'}}>{e.theme}</span><div className="insight-text">{e.analysis}</div></div>)}</div><div className="overview-footer"><span>Showing {Math.min(insightLimit,project.evidence.length)} of {project.evidence.length} reviewed records. Detailed records belong in Evidence Map.</span><button className="secondary" onClick={()=>setPage('map')}>View Evidence Map →</button></div></>:<div className="empty">No verified evidence yet. Review a passage in the Paper Library to get started.</div>}</section></>}
 {page==='overview'&&<section className="panel"><div className="map-title"><div><h2>AI Key Insights & Evidence Gaps</h2><p>AI synthesis uses verified records only. Gaps refer to this library, not the whole research field.</p></div><button className="primary" disabled={synthesisBusy||!project.evidence.length} onClick={generateSynthesis}>{synthesisBusy?'Generating...':'Generate Synthesis'}</button></div>{synthesis&&synthesis.projectId===project.id&&synthesis.sourceSignature===JSON.stringify(project.evidence.map(e=>[e.id,e.analysis,e.relationship]))&&<div className="two-cols"><div><h3>Key Insights</h3>{synthesis.insights?.map((x,i)=><div className="synthesis-item" key={i}>{x.text}<div className="synthesis-sources">{x.evidence_ids.map(id=>{const ev=project.evidence.find(e=>e.id===id);return ev?<button key={id} className="text-link" onClick={()=>locateEvidence(ev)}>View evidence · {ev.theme} ↗</button>:null})}</div></div>)}</div><div><h3>Evidence Gaps in Your Library</h3>{synthesis.gaps?.map((x,i)=><div className="synthesis-item" key={i}>{x.text}<div className="synthesis-sources">{x.evidence_ids.map(id=>{const ev=project.evidence.find(e=>e.id===id);return ev?<button key={id} className="text-link" onClick={()=>locateEvidence(ev)}>Related evidence · {ev.theme} ↗</button>:null})}</div></div>)}</div></div>}</section>}
 {uploadStage&&<div className="notice" role="status" style={{marginBottom:12}}>PDF upload: {uploadStage}</div>}{aiError&&<div className="notice" role="alert" style={{color:'#a43d3d',marginBottom:12}}>{aiError} <button type="button" style={{marginLeft:8}} onClick={()=>navigator.clipboard.writeText('PDF upload error: '+aiError+'\\nPage: '+location.origin+'\\nTime: '+new Date().toISOString())}>Copy error</button></div>}{page==='papers'&&<div className={"library-layout "+(!libraryOpen?"library-collapsed":"")}><section className="panel paper-list"><h2>Paper Library</h2><p>Upload PDFs and open them for reading.</p>{project.papers.map(p=><div className={'paper-item '+(paperId===p.id?'chosen':'')} key={p.id}><button onClick={()=>{setLegacyReader(false);setPaperId(p.id)}}><FileText size={18}/><span>{p.name}</span>{paperJobs[projectId+':'+p.id]&&<small className={'paper-job-status status-'+paperJobs[projectId+':'+p.id].status}>{({queued:'Queued',running:'Analysing',completed:'Completed',partial:'Partial',failed:'Failed',cancelled:'Cancelled'})[paperJobs[projectId+':'+p.id].status]||''}</small>}</button><button className={'tiny seed-toggle '+(p.seed?'seed-active':'')} title={p.seed?'Remove Primary Seed designation':'Set as the only Primary Seed Paper'} aria-pressed={!!p.seed} onClick={()=>{const already=!!p.seed;update(pr=>({...pr,papers:pr.papers.map(x=>({...x,seed:!already&&x.id===p.id}))}));toast(already?'Primary Seed removed.':(p.name+' is now the Primary Seed Paper.'))}}>{p.seed?'★ Primary Seed':'☆ Set as Seed'}</button><button className="icon-btn" title="Edit paper metadata" onClick={()=>editPaper(p)}><Pencil size={15}/></button><button className="icon-btn delete-paper" title="Delete PDF" onClick={()=>deletePaper(p)}><Trash2 size={15}/></button></div>)}{!project.papers.length&&<div className="empty">No PDFs uploaded yet. Upload a PDF to start source-grounded analysis.</div>}</section><section className="panel reader"><div className="reader-head"><div className="reader-title"><button className="secondary" onClick={()=>setLibraryOpen(v=>!v)}>{libraryOpen?"Hide Papers":"Show Papers"}</button><h2>PDF Reader</h2></div><button className="secondary" onClick={()=>{setAssistant(a=>!a);setAssistantTab('highlights')}}><Bot size={17}/> Assistant</button></div>{paperId&&!legacyReader?<div className="actual-reader pdfjs-first-reader">
  <div className="reader-controls">
    <button className="secondary" onClick={()=>setLegacyReader(true)}>Use legacy reader</button>
    <button className="secondary" onClick={()=>openPrivatePdf(project.papers.find(p=>p.id===paperId))}>Open Cloud PDF ↗</button>
    <button className="primary" disabled={busy||!!analysisJob||!project.topics.length} onClick={runAnalysis}>{analysisJob?'Analysing...':'AI Highlight PDF'}</button>
    {analysisJob&&<button className="secondary" onClick={cancelAnalysis}>Stop Analysis</button>}
  </div>
  {analysisJob&&<div className="notice" role="status">{analysisJob.message} · {analysisJob.completed_batches}/{analysisJob.total_batches||'?'} batches</div>}
  {!project?.papers?.find(p=>p.id===paperId)?.storagePath?<div className="notice" role="alert">This paper has no private cloud PDF path. PDF.js cannot open it yet. Re-upload this PDF or select “Use legacy reader” to view the older cached copy.</div>:null}
  {project?.papers?.find(p=>p.id===paperId)?.storagePath&&<PdfJsPreview key={paperId} paper={project.papers.find(p=>p.id===paperId)} supabase={supabase}
    page={pageNumber} onPageChange={setPageNumber} pageSize={pageSizes[pageNumber-1]}
    sourceFocus={sourceFocus?.paperId===paperId?sourceFocus:null}
    highlights={showHighlights?displayMatches.filter(m=>m.page===pageNumber).map(m=>({...m,color:themeColor(project.topics,m.theme)+'55'})):[]}
    onHighlightClick={m=>inspect(m)} selectedQuote={selected?.quote||selected?.text||''}
    onClose={()=>setLegacyReader(true)}/>}
  <div className="highlight-summary"><span>{displayMatches.length} highlights available · AI analysis is reused from V6.4</span></div>
 </div>:paperId&&pageSizes.length?<div className="actual-reader"><div className="reader-controls"><button className="secondary" type="button" onClick={()=>setLegacyReader(false)}>Switch to PDF.js</button><button className="secondary" disabled={pageNumber<=1} onClick={()=>setPageNumber(n=>n-1)}>Previous</button><span>Page {pageNumber} / {pageSizes.length}</span><button className="secondary" disabled={pageNumber>=pageSizes.length} onClick={()=>setPageNumber(n=>n+1)}>Next</button><button className="secondary" onClick={()=>setZoom(z=>Math.max(65,z-25))} aria-label="Zoom out">−</button><span className="zoom-label">{zoom}%</span><button className="secondary" onClick={()=>setZoom(z=>Math.min(250,z+25))} aria-label="Zoom in">+</button><button className="secondary" onClick={()=>setZoom(100)}>Fit Width</button><button className="secondary" onClick={()=>{const selectedPaper=project?.papers?.find(p=>p.id===paperId);if(selectedPaper?.storagePath)openPrivatePdf(selectedPaper);else setAiError("This paper has no cloud copy yet. Re-upload it to use private PDF access.")}}>Open Cloud PDF ↗</button><button className="primary" disabled={busy||!!analysisJob||!project.topics.length} onClick={runAnalysis}>{analysisJob?'Analysing...':'AI Highlight PDF'}</button>{analysisJob&&<button className="secondary" onClick={cancelAnalysis}>Stop Analysis</button>}</div>{analysisJob&&<div className="notice" role="status">{analysisJob.message}{analysisJob.batch_started_at?' · '+Math.max(0,Math.floor(Date.now()/1000-analysisJob.batch_started_at))+'s elapsed':''} · {analysisJob.completed_batches}/{analysisJob.total_batches||'?'} batches · {analysisJob.matches?.length||0} highlights ready</div>}<div className="pdf-scroll" ref={pdfScrollRef}><div className="pdf-canvas" ref={pdfCanvasRef} style={{width:zoom+'%',aspectRatio:pageSizes[pageNumber-1].width+'/'+pageSizes[pageNumber-1].height}}><img src={pageImageUrl||undefined} alt={'Original PDF page '+pageNumber}/>{sourceFocus?.paperId===paperId&&sourceFocus.page===pageNumber&&sourceFocus.rects.map((rect,i)=>{const dims=pageSizes[pageNumber-1];return <div key={'source-'+i} className="source-focus-rect" style={{left:rect[0]/dims.width*100+'%',top:rect[1]/dims.height*100+'%',width:(rect[2]-rect[0])/dims.width*100+'%',height:(rect[3]-rect[1])/dims.height*100+'%'}}/>})}{showHighlights&&displayMatches.filter(m=>m.page===pageNumber).flatMap(m=>{const dims=pageSizes[pageNumber-1];return (m.rects||[]).map((rect,i)=><button key={m.page+'-'+(m.quote||m.text)+'-'+i} title={m.themeNames.join(', ')+' — '+m.reason} className="pdf-highlight" style={{left:rect[0]/dims.width*100+'%',top:rect[1]/dims.height*100+'%',width:(rect[2]-rect[0])/dims.width*100+'%',height:(rect[3]-rect[1])/dims.height*100+'%',background:themeColor(project.topics,m.theme)+(focusedHighlight&&focusOnly&&focusedHighlight!==highlightKey({...m,paperId})?'14':'55'),outline:focusedHighlight===highlightKey({...m,paperId})?'2px solid '+themeColor(project.topics,m.theme):'none',zIndex:focusedHighlight===highlightKey({...m,paperId})?4:1}} onClick={()=>inspect(m)}/>)})}</div></div><div className="highlight-summary"><div className="highlight-controls"><label className="focus-toggle"><input type="checkbox" checked={focusOnly} onChange={e=>setFocusOnly(e.target.checked)}/> Focus selected highlight</label>{(selected||sourceFocus)&&<button className="secondary" onClick={clearHighlightFocus}>Clear selection</button>}{selected&&<button className="secondary" onClick={()=>locateEvidence(selected)}>Locate · page {selected.page}</button>}</div><div className="highlight-status">{cacheMessage&&<span className="cache-indicator">{cacheMessage}</span>}<span>{displayMatches.length} highlights available · Click highlights to inspect · Filter by theme in Assistant</span></div></div></div>:paperId?<div className="empty tall">Loading PDF... If unavailable, please re-upload the paper.</div>:<div className="reader-placeholder"><BookOpen size={40}/><h3>Choose a PDF to start reading</h3><p>Upload a text-based PDF to extract original passages, then run AI Highlight PDF.</p></div>}<div className="notice"><Info size={17}/> Highlights show only exact quotations located in the source PDF. Unsupported AI quotes are omitted. Zoom or open the original PDF for closer reading.</div></section>{assistant&&<section className="panel assistant"><div className="assistant-head"><div><Bot size={19}/><strong>Research Assistant</strong></div><button className="icon-btn" onClick={()=>setAssistant(false)}><X size={18}/></button></div><div className="tabs"><button className={assistantTab==='highlights'?'on':''} onClick={()=>setAssistantTab('highlights')}>Highlights</button><button className={assistantTab==='analysis'?'on':''} onClick={()=>setAssistantTab('analysis')}>Analysis</button></div>{assistantTab==='highlights'?<><h3>Research Themes</h3><p>Filter highlights by theme. Edit theme names in Evidence Map or Project Settings.</p><label className="theme-toggle"><input type="checkbox" checked={showHighlights} onChange={e=>setShowHighlights(e.target.checked)}/> Show highlights</label><div className="theme-filter-list">{project.topics.map(t=><label key={t} className="theme-toggle"><input type="checkbox" checked={visibleThemes.includes(t)} onChange={()=>setActiveThemes(old=>{const current=old===null?project.topics:old;return current.includes(t)?current.filter(x=>x!==t):[...current,t]})}/><span className="theme-swatch" style={{background:themeColor(project.topics,t)}}/>{t}</label>)}</div><div className="filter-actions"><button className="secondary" onClick={()=>setActiveThemes(null)}>Select All</button><button className="secondary" onClick={()=>setActiveThemes([])}>Clear All</button></div><p className="filter-count">{visibleThemes.length} / {project.topics.length} themes shown</p><button className="secondary full" onClick={()=>setPage('settings')}>Edit themes</button></>:selected?<><div className="tag" style={{borderLeft:'4px solid '+themeColor(project.topics,selected.theme)}}>{selected.theme}</div><button className="secondary" onClick={()=>locateEvidence(selected)}>Locate in PDF · Page {selected.page}</button><h3>Selected Passage</h3><blockquote>{selected.text}</blockquote>{cacheMessage&&<p className="cache-indicator">{cacheMessage}</p>}<h3>Relationship to Research Question</h3><select value={relationship} onChange={e=>setRelationship(e.target.value)}>{relationshipOptions.map(t=><option key={t}>{t}</option>)}</select><p className="hint">Select a relationship only after checking the original claim.</p><h3>Interpretation</h3><textarea rows="5" value={editing} onChange={e=>setEditing(e.target.value)}/><div className="hint">Source: {selected.source}</div>{busy&&<div className="hint">AI is analysing the selected original passage...</div>}{aiDetails&&<><h3>Relevance to RQ</h3><p>{aiDetails.relevance}</p><h3>Limitations / Caveats</h3><p>{aiDetails.limitations}</p></>}<div className="notice"><Info size={16}/>{selected.paperId?'Compare this analysis with the highlighted original PDF before confirming. Confirmation is your human review.':'Illustrative sample only; no original PDF source.'}</div>{savedSelected?<><div className="saved-evidence-notice"><Check size={16}/> Already Saved · This passage is in Evidence Map.</div><button className="secondary full" onClick={()=>{setPage('map');setMapView('theme');resetMapFilters();setMapTheme(savedSelected.theme)}}>View Saved Evidence →</button></>:<button className="primary full" disabled={busy||!editing.trim()} onClick={saveEvidence}><Check size={17}/> Confirm & Save</button>}<button className="secondary full" onClick={rejectSelected}>Reject & Hide Highlight</button></>:<div className="empty">Click an AI-highlighted passage in the PDF to inspect its analysis.</div>}</section>}</div>}
 {page==='map'&&<section className="panel v7-evidence-workspace"><div className="v7-workspace-heading"><div><h2>Evidence Workspace</h2><p>Find, review and connect verified research findings.</p></div><div className="v7-manage-wrap"><button className="primary" onClick={()=>{setManualEvidence(p=>({...p,theme:project.topics[0]||"Uncategorised"}));setManualEvidenceOpen(true)}}><Plus size={15}/> Add Evidence</button><button className="secondary" aria-expanded={mapManageOpen} onClick={()=>setMapManageOpen(v=>!v)}>Manage <ChevronDown size={15}/></button>{mapManageOpen&&<div className="v7-manage-menu"><button onClick={()=>{setMapManageOpen(false);setPage('settings');setSettingsTab('themes')}}>Manage Themes</button><button disabled={duplicateGroups.length===0} title={duplicateGroups.length===0?"No duplicate evidence found":"Review duplicate evidence"} onClick={()=>{setMapManageOpen(false);setDuplicateReview(v=>!v)}}>Review Duplicates ({duplicateGroups.length})</button><button onClick={()=>{setMapManageOpen(false);setMapView('list');setMapTheme(null);setBulkMode(true)}}>Bulk Management</button></div>}</div></div><div className="v6-search-top"><div className="v6-search-input"><Search size={18}/><input aria-label="Search verified evidence" placeholder="Search quotes, interpretations, papers, themes, authors..." value={mapQuery} onChange={e=>{setMapQuery(e.target.value);setMapTheme(null)}}/>{mapQuery&&<button className="secondary" onClick={()=>setMapQuery('')}>Clear</button>}</div><button className="secondary" aria-expanded={mapFiltersOpen} onClick={()=>setMapFiltersOpen(v=>!v)}><SlidersHorizontal size={16}/> Filters{hasMapFilters?' · Active':''}</button></div>
 {mapFiltersOpen&&<div className="v6-filter-panel v7-filter-panel"><div className="v7-filter-heading"><strong>Refine Results</strong><button className="secondary" onClick={()=>setMapFiltersOpen(false)}>Done <X size={14}/></button></div><label>Research Themes<div className="v6-theme-filter">{project.topics.map(t=><label key={t}><input type="checkbox" checked={mapThemeFilter.includes(t)} onChange={e=>{setMapTheme(null);setMapThemeFilter(old=>e.target.checked?[...old,t]:old.filter(x=>x!==t))}}/>{t}</label>)}</div></label><label>Paper<select value={mapPaperFilter} onChange={e=>{setMapPaperFilter(e.target.value);setMapTheme(null)}}><option value="">All papers</option>{project.papers.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select></label><label>Relationship<select value={mapRelationshipFilter} onChange={e=>{setMapRelationshipFilter(e.target.value);setMapTheme(null)}}><option value="">All relationships</option>{relationshipOptions.map(x=><option key={x} value={x}>{x}</option>)}</select></label><label>Year from<input type="number" placeholder="Any year" value={mapYearFilter} onChange={e=>setMapYearFilter(e.target.value)}/></label><label>Year to<input type="number" placeholder="Any year" value={mapYearTo} onChange={e=>setMapYearTo(e.target.value)}/></label><label>Author<input placeholder="Any author" value={mapAuthorFilter} onChange={e=>setMapAuthorFilter(e.target.value)}/></label><button className="secondary" onClick={resetMapFilters}>Clear all filters</button></div>}
 <div className="v6-results-toolbar"><div><strong>{mapView==='rq'?project.evidence.length:mapRecords.length} of {project.evidence.length} verified evidence</strong>{mapView!=='rq'&&hasMapFilters&&<span> · Filtered results</span>}</div><div className="tabs">{[['rq','RQ Map'],['list','List'],['theme','By Theme'],['paper','By Paper'],['network','Connections']].map(([id,label])=><button key={id} className={mapView===id?'on':''} onClick={()=>{setRqListFocus(null);setMapView(id);setMapTheme(null);setSelectedEvidenceIds([])}}>{label}</button>)}</div><select aria-label="Sort results" value={mapSort} onChange={e=>setMapSort(e.target.value)}><option value="newest">Newest</option><option value="oldest">Oldest</option><option value="paper">Paper</option><option value="theme">Theme</option></select></div>{mapView==='list'&&rqListFocus&&<div className="v53-rq-return" role="status"><div><strong>Viewing Evidence in {rqListFocus}</strong><span>Temporary view from RQ Map · {mapRecords.length} matching records</span></div><div><button className="secondary" onClick={()=>setRqListFocus(null)}>Clear Theme</button><button className="primary" onClick={()=>{setRqListFocus(null);setMapQuery('');setMapView('rq')}}>← Back to RQ Map</button></div></div>}{mapTheme&&<button className="secondary" onClick={()=>setMapTheme(null)}>← All {mapView==='paper'?'Papers':'Themes'}</button>}{duplicateReview&&<div className="v5-duplicate-review"><div className="v11-duplicate-heading"><h3>Duplicate Evidence Review</h3><button type="button" className="secondary" onClick={()=>setDuplicateReview(false)} aria-label="Close duplicate evidence review"><X size={16}/> Close</button></div><p>Existing duplicate records are not removed automatically. Select which record to retain; connected relationships will be redirected.</p>{duplicateGroups.length===0&&<p>No duplicate source passages found.</p>}{duplicateGroups.map((group,i)=><div className="v5-duplicate-group" key={i}><strong>{group[0].source||'Original passage'} · {group.length} records</strong><p>{(group[0].quote||group[0].text||'').slice(0,220)}</p>{group.map(e=><div className="v5-duplicate-option" key={e.id}><span>{e.theme} · {(e.analysis||'No interpretation').slice(0,110)}</span><button className="secondary" onClick={()=>mergeDuplicateGroup(group,e.id)}>Keep this record</button></div>)}</div>)}</div>}{mapView==='rq'&&<div className="v52-rq-map">
 <header className="v52-rq-question"><div><span>YOUR RESEARCH QUESTION</span><h3>{project.question}</h3></div><button className="secondary" onClick={()=>{setPage('settings');setSettingsTab('general')}}>Edit RQ</button></header>
 <div className="v52-rq-section-head"><div><h3>Research Themes</h3><p>Evidence is organised by your existing Themes. No second classification system is required.</p></div><button className="secondary" onClick={()=>{setPage('settings');setSettingsTab('themes')}}>Manage Themes</button></div>
 <div className="v52-theme-grid">{project.topics.map(t=>{const items=project.evidence.filter(e=>themeMatches(e,t));const papers=new Set(items.map(e=>e.paperId).filter(Boolean));return <article className="v52-theme-card" key={t}><div className="v52-theme-heading"><span className="v52-theme-dot" style={{background:themeColor(project.topics,t)}}/><h4>{t}</h4></div><div className="v52-theme-meta">{items.length} verified evidence · {papers.size} sources</div><div className="v52-theme-preview">{items.length?items.slice(0,2).map(e=><button key={e.id} className="v52-evidence-row" onClick={()=>{setRqListFocus(t);setMapView('list');setMapQuery((e.quote||e.text||'').slice(0,45));setMapThemeFilter([]);setMapPaperFilter('');setMapRelationshipFilter('');setMapYearFilter('');setMapYearTo('');setMapAuthorFilter('')}}>{(e.analysis||e.quote||e.text||'Evidence').slice(0,150)}</button>):<p>No verified evidence assigned yet.</p>}</div><button className="secondary" onClick={()=>{setRqListFocus(t);setMapView('list');setMapQuery('');setMapThemeFilter([]);setMapPaperFilter('');setMapRelationshipFilter('');setMapYearFilter('');setMapYearTo('');setMapAuthorFilter('')}}>View Evidence →</button></article>})}</div>
 <section className="v52-synthesis"><div className="v52-synthesis-heading"><div><h3>Research Synthesis</h3><p>AI suggests findings and gaps using verified source passages. Review all claims before accepting.</p></div><button className="primary" disabled={rqSynthesisBusy||!project.evidence.length} onClick={async()=>{setRqSynthesisBusy(true);setRqSynthesisError('');try{const response=await apiFetch('/api/synthesis',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({question:project.question,evidence:project.evidence.map(e=>({id:e.id,theme:e.theme,quote:e.quote||e.text||'',interpretation:e.analysis||e.interpretation||'',relationship:e.relationship||'Unclassified',source:project.papers.find(p=>p.id===e.paperId)?.name||''}))})});const result=await response.json();if(!response.ok)throw Error(result.detail||'Synthesis failed');setRqSynthesisDraft(result)}catch(error){setRqSynthesisError(error.message)}finally{setRqSynthesisBusy(false)}}}><Sparkles size={15}/>{rqSynthesisBusy?'Analysing…':'Generate AI Synthesis'}</button></div>
 {rqSynthesisError&&<p className="v52-error" role="alert">{rqSynthesisError}</p>}
 {rqSynthesisDraft&&<div className="v52-synthesis-results"><div className="v52-synthesis-column"><h4>Suggested Findings</h4>{(rqSynthesisDraft.insights||[]).map((item,i)=><div className="v52-synthesis-item" key={i}><p>{item.text}</p><small>Evidence: {(item.evidence_ids||[]).map(id=>{const e=project.evidence.find(x=>x.id===id);return e?(e.theme||id)+' · '+(project.papers.find(p=>p.id===e.paperId)?.name||'Source'):id}).join('; ')||'No cited evidence'}</small></div>)}</div><div className="v52-synthesis-column"><h4>Gaps in Current Library</h4>{(rqSynthesisDraft.gaps||[]).map((item,i)=><div className="v52-synthesis-item" key={i}><p>{item.text}</p><small>Relevant evidence: {(item.evidence_ids||[]).map(id=>project.evidence.find(e=>e.id===id)?.theme||id).join('; ')||'No direct supporting record'}</small></div>)}</div><div className="v52-synthesis-actions"><button className="secondary" onClick={()=>setRqSynthesisDraft(null)}>Discard Suggestions</button><button className="primary" onClick={()=>{update(p=>({...p,rqSynthesis:{...rqSynthesisDraft,reviewedAt:new Date().toISOString()}}));setRqSynthesisDraft(null)}}>Accept Reviewed Synthesis</button></div></div>}
 {!rqSynthesisDraft&&project.rqSynthesis&&<div className="v52-synthesis-results"><div className="v52-synthesis-column"><h4>Reviewed Findings</h4>{(project.rqSynthesis.insights||[]).map((x,i)=><p key={i}>{x.text}</p>)}</div><div className="v52-synthesis-column"><h4>Reviewed Research Gaps</h4>{(project.rqSynthesis.gaps||[]).map((x,i)=><p key={i}>{x.text}</p>)}</div><button className="secondary" onClick={()=>update(p=>({...p,rqSynthesis:null}))}>Remove Reviewed Synthesis</button></div>}
 {!rqSynthesisDraft&&!project.rqSynthesis&&<div className="v52-synthesis-empty"><strong>Turn verified evidence into research findings.</strong><p>Generate a draft synthesis to identify patterns and remaining questions. This only reflects the papers in your project.</p></div>}
 </section><p className="hint">Evidence can belong to multiple Themes. Evidence counts do not measure the strength or independence of research findings.</p></div>}
 <div className="evidence-management" style={{display:['network','rq'].includes(mapView)?'none':undefined}}>{mapView==='list'?<div className="v6-search-list v7-compact-list">{bulkMode&&<div className="v7-bulk-heading"><strong>{selectedEvidenceIds.length} selected</strong><select aria-label="Bulk theme" value={bulkTheme} onChange={e=>setBulkTheme(e.target.value)}><option value="">Move to theme...</option>{project.topics.map(t=><option key={t}>{t}</option>)}</select><select aria-label="Bulk relationship" value={bulkRelationship} onChange={e=>setBulkRelationship(e.target.value)}><option value="">Set relationship...</option>{relationshipOptions.map(t=><option key={t}>{t}</option>)}</select><button className="secondary" disabled={!selectedEvidenceIds.length||(!bulkTheme&&!bulkRelationship)} onClick={bulkUpdate}>Apply</button><button className="secondary" disabled={!selectedEvidenceIds.length} onClick={bulkDelete}>Delete selected</button><button className="secondary" onClick={()=>{setBulkMode(false);setSelectedEvidenceIds([])}}>Done</button></div>}{mapRecords.map(e=><article className="v6-result-card" key={e.id}>{bulkMode&&<label className="v7-bulk-check"><input type="checkbox" checked={selectedEvidenceIds.includes(e.id)} onChange={()=>toggleEvidenceSelection(e.id)}/> Select</label>}<div className="v6-result-meta"><strong>{evidenceThemes(e).join(' · ')}</strong><span style={relationshipStyle(e.relationship||'Unclassified')}>{e.relationship||'Unclassified'}</span></div><p>{highlightText(e.analysis||e.quote||e.text,mapQuery)}</p><div className="v7-result-bottom"><small>{highlightText(project.papers.find(p=>p.id===e.paperId)?.name||e.source||'Unknown paper',mapQuery)} · Page {e.page||'?'}</small><div className="v6-result-actions"><button className="secondary" onClick={()=>{setEvidenceEditor({...e,themes:evidenceThemes(e)});setEvidenceDraft(e.analysis||'')}}>Details</button>{e.paperId&&<button className="secondary" onClick={()=>locateEvidence(e)}>Source ↗</button>}</div></div></article>)}{!mapRecords.length&&<div className="empty">No matching evidence. Try clearing your filters.</div>}</div>:!mapTheme?<div className="evidence-theme-overview">{(mapView==='paper'?project.papers.filter(p=>!hasMapFilters||mapRecords.some(e=>e.paperId===p.id)).map(p=>({id:p.id,label:p.name,count:mapRecords.filter(e=>e.paperId===p.id).length})):([...new Set([...(hasMapFilters?[]:project.topics),...mapRecords.flatMap(e=>evidenceThemes(e))])]).filter(t=>!mapThemeFilter.length||mapThemeFilter.includes(t)).map(t=>({id:t,label:t,count:mapRecords.filter(e=>themeMatches(e,t)).length}))).map(t=><button className="evidence-theme-tile" key={t.id} onClick={()=>setMapTheme(t.id)}><span className="theme-swatch" style={{background:themeColor(project.topics,t.id)}}/><strong>{t.label}</strong><span className="evidence-theme-count">{t.count} verified</span><ChevronRight size={17}/></button>)}</div>:<><div className="evidence-detail-heading"><div><h3>{mapView==='paper'?project.papers.find(p=>p.id===mapTheme)?.name||mapTheme:mapTheme}</h3><p>{mapRecords.filter(e=>mapView==='paper'?e.paperId===mapTheme:themeMatches(e,mapTheme)).length} matching evidence · Search and sort using the controls above</p></div>{mapView==='theme'&&<div className="evidence-theme-actions"><button className="secondary" onClick={()=>renameTheme(mapTheme)}><Pencil size={14}/> Rename</button><button className="secondary" onClick={()=>deleteTheme(mapTheme)}><Trash2 size={14}/> Delete</button></div>}</div><div className="v5-bulk-bar"><label><input type="checkbox" checked={mapRecords.filter(e=>mapView==='paper'?e.paperId===mapTheme:themeMatches(e,mapTheme)).length>0&&mapRecords.filter(e=>mapView==='paper'?e.paperId===mapTheme:themeMatches(e,mapTheme)).every(e=>selectedEvidenceIds.includes(e.id))} onChange={event=>{const ids=mapRecords.filter(e=>mapView==='paper'?e.paperId===mapTheme:themeMatches(e,mapTheme)).map(e=>e.id);setSelectedEvidenceIds(old=>event.target.checked?[...new Set([...old,...ids])]:old.filter(id=>!ids.includes(id)))}}/> Select all in view</label><strong>{selectedEvidenceIds.length} selected</strong><select aria-label="Bulk move to theme" value={bulkTheme} onChange={e=>setBulkTheme(e.target.value)}><option value="">Move to theme...</option>{project.topics.map(t=><option key={t}>{t}</option>)}</select><select aria-label="Bulk relationship" value={bulkRelationship} onChange={e=>setBulkRelationship(e.target.value)}><option value="">Set relationship...</option>{relationshipOptions.map(t=><option key={t}>{t}</option>)}</select><button className="secondary" disabled={!selectedEvidenceIds.length||(!bulkTheme&&!bulkRelationship)} onClick={bulkUpdate}>Apply</button><button className="secondary" disabled={!selectedEvidenceIds.length} onClick={bulkDelete}>Delete selected</button></div><div className="evidence-detail-list v8-detail-list">{mapRecords.filter(e=>mapView==='paper'?e.paperId===mapTheme:themeMatches(e,mapTheme)).map(e=><article className="v8-evidence-row" key={e.id}><div className="v8-evidence-row-top"><label className="v8-row-check"><input type="checkbox" checked={selectedEvidenceIds.includes(e.id)} onChange={()=>toggleEvidenceSelection(e.id)}/> Select</label><span className="v8-relation-badge" style={relationshipStyle(e.relationship||'Unclassified')}>{e.relationship||'Unclassified'}</span></div><p className="v8-evidence-text">{highlightText(e.analysis||e.quote||e.text,mapQuery)}</p>{mapQuery&&<div className="evidence-search-quote"><small>Original passage</small><p>{highlightText(e.quote||e.text,mapQuery)}</p></div>}<div className="v8-evidence-row-bottom"><small>{highlightText([project.papers.find(p=>p.id===e.paperId)?.name||e.source,project.papers.find(p=>p.id===e.paperId)?.year,e.page?'Page '+e.page:null].filter(Boolean).join(' · '),mapQuery)}</small><div className="v8-row-actions"><button className="secondary" onClick={()=>{setEvidenceEditor({...e,themes:evidenceThemes(e)});setEvidenceDraft(e.analysis||'')}}>Details</button>{e.paperId&&<button className="secondary" onClick={()=>locateEvidence(e)}>Source ↗</button>}</div></div></article>)}{!mapRecords.some(e=>mapView==='paper'?e.paperId===mapTheme:themeMatches(e,mapTheme))&&<div className="empty">No matching evidence.</div>}</div></>}</div></section>}
 {page==='map'&&mapView==='network'&&<div className="network-view">
 <div className="map-title"><div><h2>Evidence Network</h2><p>Only human-verified links appear in the graph. AI suggestions require explicit confirmation.</p></div><button className="primary" disabled={networkBusy||project.evidence.length<2} onClick={proposeNetwork}><Sparkles size={15}/>{networkBusy?'Analysing relationships...':'Suggest Connections with AI'}</button></div>
 {networkNotice&&<div className="notice" role="status">{networkNotice}</div>}
 <div className="v13-review-launch"><div><strong>Create a reviewed connection</strong><p>Drag a purple handle between Evidence cards, or select two records manually.</p></div><button className="secondary" onClick={()=>{setPairCaveat('');setConnectionReviewOpen(true)}}><Plus size={15}/> New Connection</button></div>
 {connectionReviewOpen&&<div className="modal-backdrop" onMouseDown={e=>{if(e.target===e.currentTarget&&!pairSuggestBusy)setConnectionReviewOpen(false)}}><div className="modal v13-connection-modal" role="dialog" aria-modal="true" aria-labelledby="v13-connection-title"><div className="v13-modal-header"><div><span className="v13-eyebrow">EVIDENCE NETWORK</span><h2 id="v13-connection-title">Review Connection</h2><p>Compare two evidence records and verify their relationship before saving.</p></div><button className="icon-btn" aria-label="Close connection review" onClick={()=>setConnectionReviewOpen(false)}><X size={19}/></button></div><div className="v13-modal-content"><div className="v13-evidence-grid">{(()=>{const item=project.evidence.find(e=>e.id===manualSource);const paper=project.papers.find(p=>p.id===item?.paperId);return <div className="v13-evidence-preview"><div className="v13-preview-label"><span>SOURCE EVIDENCE</span><FileText size={15}/></div><strong>{item?.theme||'Select evidence'}</strong><p>{item?.quote||item?.text||'Choose an evidence record to review.'}</p><small>{paper?.name||item?.source||'Source unavailable'} · Page {item?.page||'?'}</small></div>})()}{(()=>{const item=project.evidence.find(e=>e.id===manualTarget);const paper=project.papers.find(p=>p.id===item?.paperId);return <div className="v13-evidence-preview"><div className="v13-preview-label"><span>TARGET EVIDENCE</span><FileText size={15}/></div><strong>{item?.theme||'Select evidence'}</strong><p>{item?.quote||item?.text||'Choose an evidence record to review.'}</p><small>{paper?.name||item?.source||'Source unavailable'} · Page {item?.page||'?'}</small></div>})()}</div><div className="v13-select-grid"><label>Source evidence<select value={manualSource} onChange={e=>{setManualSource(e.target.value);setPairCaveat('')}}><option value="">Select source...</option>{project.evidence.map(e=><option key={e.id} value={e.id}>{e.theme} · {(e.quote||e.text||'').slice(0,75)}</option>)}</select></label><label>Target evidence<select value={manualTarget} onChange={e=>{setManualTarget(e.target.value);setPairCaveat('')}}><option value="">Select target...</option>{project.evidence.map(e=><option key={e.id} value={e.id}>{e.theme} · {(e.quote||e.text||'').slice(0,75)}</option>)}</select></label></div><section className="v13-review-section"><h3>Relationship</h3><div className="v13-relation-options">{['Supporting','Contradictory','Related'].map(kind=><button type="button" key={kind} className={manualRelation===kind?'active':''} data-relation={kind.toLowerCase()} onClick={()=>setManualRelation(kind)}><strong>{kind}</strong><span>{kind==='Supporting'?'One claim reinforces the other':kind==='Contradictory'?'The claims directly conflict':'The claims address connected issues'}</span></button>)}</div></section><section className="v13-review-section"><div className="v13-review-heading"><h3>Reason for Connection</h3><span>Human-reviewed</span></div><textarea rows="4" value={manualRationale} onChange={e=>setManualRationale(e.target.value)} placeholder="Explain how these two original passages relate..."/><button className="secondary" disabled={pairSuggestBusy||!manualSource||!manualTarget||manualSource===manualTarget} onClick={async()=>{const source=project.evidence.find(e=>e.id===manualSource),target=project.evidence.find(e=>e.id===manualTarget);if(!source||!target)return;setPairSuggestBusy(true);setNetworkNotice('');setPairCaveat('');try{const response=await apiFetch('/api/network/suggest-pair',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({question:project.question,source,target})});const result=await response.json();if(!response.ok)throw Error(result.detail||'AI suggestion failed');setManualRelation(result.relationship);setManualRationale(result.rationale);setPairCaveat(result.caveat||'');setNetworkNotice(result.cache_hit?'AI suggestion loaded from cache. Review before saving.':'AI suggestion ready. Review before saving.')}catch(error){setNetworkNotice(error.message)}finally{setPairSuggestBusy(false)}}}>{pairSuggestBusy?'Suggesting…':'✦ Suggest Relationship & Reason with AI'}</button>{pairCaveat&&<p className="v13-ai-caveat"><strong>AI caveat:</strong> {pairCaveat}</p>}</section></div><div className="v13-modal-footer"><button className="secondary" onClick={()=>setConnectionReviewOpen(false)}>Cancel</button><button className="primary" disabled={!manualSource||!manualTarget||manualSource===manualTarget||manualRationale.trim().length<15||(project.networkLinks||[]).some(l=>[l.source_id,l.target_id].sort().join('|')===[manualSource,manualTarget].sort().join('|'))} onClick={()=>{update(p=>({...p,networkLinks:[...(p.networkLinks||[]),{id:crypto.randomUUID(),source_id:manualSource,target_id:manualTarget,relationship:manualRelation,rationale:manualRationale.trim(),status:'verified',verifiedAt:new Date().toISOString()}]}));setManualSource('');setManualTarget('');setManualRationale('');setPairCaveat('');setConnectionReviewOpen(false);setNetworkNotice('Reviewed relationship saved.')}}>Confirm & Save Connection</button></div></div></div>}<EvidenceNetwork key={project.id} evidence={mapRecords} links={(project.networkLinks||[]).filter(l=>project.evidence.some(e=>e.id===l.source_id)&&project.evidence.some(e=>e.id===l.target_id))} themes={project.topics} storedPositions={project.networkPositions||{}} onPosition={(id,pos)=>update(p=>({...p,networkPositions:{...(p.networkPositions||{}),[id]:pos}}))} onNode={locateEvidence} onEdge={setNetworkSelected} onConnect={(source,target)=>{if((project.networkLinks||[]).some(l=>[l.source_id,l.target_id].sort().join('|')===[source,target].sort().join('|'))){setNetworkNotice('These evidence records are already connected.');return;}setManualSource(source);setManualTarget(target);setManualRationale('');setPairCaveat('');setConnectionReviewOpen(true);setNetworkNotice('Connection selected. Choose a relationship and explain the evidence below before saving.');}}/>
 {networkSelected&&<div className="network-detail"><h3>Verified Relationship · {networkSelected.relationship}</h3><p>{networkSelected.rationale}</p><div className="filter-actions"><button className="secondary" onClick={()=>setNetworkSelected(null)}>Close</button><button className="secondary" onClick={()=>removeNetworkLink(networkSelected)}>Remove connection</button></div></div>}
 {networkProposals.length>0&&<div className="network-review"><h3>AI Suggested Connections · Pending Review ({networkProposals.length})</h3><p className="hint">Compare both original passages before confirming. Suggestions are not verified evidence.</p>{networkProposals.map(edge=>{const a=project.evidence.find(e=>e.id===edge.source_id),b=project.evidence.find(e=>e.id===edge.target_id);return <div className="network-proposal" key={edge.id}><strong>{edge.relationship}</strong><p>{edge.rationale}</p><div className="network-pair"><button className="text-link" onClick={()=>a&&locateEvidence(a)}>Source A: {(a?.quote||a?.text||'Missing source').slice(0,140)} ↗</button><button className="text-link" onClick={()=>b&&locateEvidence(b)}>Source B: {(b?.quote||b?.text||'Missing source').slice(0,140)} ↗</button></div><div className="filter-actions"><button className="primary" onClick={()=>acceptNetworkLink(edge)}>Confirm Connection</button><button className="secondary" onClick={()=>dismissNetworkLink(edge)}>Dismiss</button></div></div>})}</div>}
 </div>}
 {page==='settings'&&<div className="v5-settings-layout"><nav className="v5-settings-nav" aria-label="Settings sections">{[['general','General'],['themes','Research Themes'],['ai','AI & Usage'],['data','Data Management']].map(([id,label])=><button key={id} className={settingsTab===id?'active':''} onClick={()=>setSettingsTab(id)}>{label}<ChevronRight size={15}/></button>)}</nav><section className="panel v5-settings-panel">{settingsTab==='general'&&<><h2>General</h2><p>Manage the identity and research question of this project.</p><label>Project name<input value={project.name} onChange={e=>update(p=>({...p,name:e.target.value}))}/></label><label>Research Question<textarea rows="5" value={project.question} onChange={e=>update(p=>({...p,question:e.target.value}))}/></label><p className="hint">Changes are saved automatically. Updating your question does not reclassify verified evidence.</p></>}{settingsTab==='themes'&&<><h2>Research Themes</h2><p>Organise the topics used for AI highlighting and evidence review.</p><div className="v5-settings-themes">{project.topics.map(t=><div key={t}><span className="theme-swatch" style={{background:themeColor(project.topics,t)}}/><strong>{t}</strong><button className="secondary" onClick={()=>renameTheme(t)}><Pencil size={13}/> Rename</button><button className="secondary" onClick={()=>deleteTheme(t)}><Trash2 size={13}/> Delete</button></div>)}</div><form className="inline-form" onSubmit={e=>{e.preventDefault();const v=e.currentTarget.elements.topic.value.trim();if(v&&!project.topics.includes(v))update(p=>({...p,topics:[...p.topics,v]}));e.currentTarget.reset()}}><input name="topic" placeholder="New research theme"/><button className="primary"><Plus size={15}/> Add Theme</button></form></>}{settingsTab==='ai'&&<><div className="v5-section-heading"><div><h2>AI & Usage</h2><p>Durable Highlight usage for this project's papers, recorded after database migration. Other AI tasks are not yet included; this is not an invoice.</p></div><button className="secondary" onClick={refreshUsage}>Refresh</button></div>{usageError&&<p role="alert" className="notice">Usage unavailable: {usageError}</p>}{usage&&<p className="hint">{usage.note||'Usage covers new Highlight requests only.'}</p>}<div className="v5-summary-grid"><div className="v5-summary-stat"><strong>{usage?usage.total_tokens.toLocaleString():'—'}</strong><span>Total tokens</span></div><div className="v5-summary-stat"><strong>{usage?usage.requests:'—'}</strong><span>Model requests</span></div></div><div className="v5-usage-list">{usage?.by_task?.map(row=><div key={row.task_type}><span>{row.task_type.replaceAll('_',' ')}</span><strong>{row.total_tokens.toLocaleString()} tokens</strong><small>{row.requests} calls · {row.errors} errors</small></div>)}</div></>}{settingsTab==='data'&&<><h2>Data Management</h2><p>Review the data associated with this research project.</p><div className="v5-data-row"><div><strong>Research library</strong><p>{project.papers.length} papers · {project.evidence.length} verified evidence</p></div><button className="secondary" onClick={()=>setPage('papers')}>View Papers</button></div><div className="v5-data-row"><div><strong>Rejected Highlights</strong><p>{(project.rejected||[]).length} rejected candidates · Manage these in Highlight Manager.</p></div><button className="secondary" onClick={()=>{setHighlightFilter('rejected');setPage('highlights')}}>Manage Highlights</button></div><p className="hint">Back up backend/research.db and backend/uploads before making destructive changes.</p></>}</section></div>}

 {page==='writing'&&<section className="panel coming"><FilePenLine size={36}/><h2>Academic Writing — Future Development</h2><p>A manuscript editor, source-linked citations, and target venue formatting guidance are planned for a later release.</p><button className="secondary" onClick={()=>setPage('overview')}>Return to Overview</button></section>}
 </div>}
 </main>{paperEditor&&<div className="modal-backdrop"><div className="modal"><div className="modal-head"><h2>Paper Metadata</h2><button className="icon-btn" onClick={()=>setPaperEditor(null)}><X size={18}/></button></div><p className="hint">Change the name shown in Paper Library without renaming the uploaded PDF file or breaking source links. Review other metadata below.</p><label>Display name in Paper Library<input maxLength={180} value={paperEditor.name||''} onChange={e=>setPaperEditor(p=>({...p,name:e.target.value}))} placeholder="e.g. Sun Protection Behaviours — 2021"/></label>{[['title','Paper title'],['authors','Authors'],['year','Publication year'],['venue','Journal / Conference / Source'],['doi','DOI'],['url','Source URL']].map(([key,label])=><label key={key}>{label}<input value={paperEditor[key]||''} onChange={e=>setPaperEditor(p=>({...p,[key]:e.target.value}))}/></label>)}<div className="modal-actions"><button className="secondary" onClick={()=>setPaperEditor(null)}>Cancel</button><button className="primary" onClick={savePaperMetadata}>Save Metadata</button></div></div></div>}{manualEvidenceOpen&&<div className="modal-backdrop" onMouseDown={e=>{if(e.target===e.currentTarget)setManualEvidenceOpen(false)}}><form className="modal evidence-modal" role="dialog" aria-modal="true" aria-label="Add Evidence" onSubmit={e=>{e.preventDefault();createManualEvidence()}}><h2>Add Evidence</h2><p>Add a source or observation to the current project. New evidence starts unverified.</p><div className="evidence-entry-modes"><button type="button" className={evidenceEntryMode==='manual'?'primary':'secondary'} onClick={()=>{setEvidenceEntryMode('manual');setSelectedExcerptId('')}}>Manually</button><button type="button" className={evidenceEntryMode==='excerpts'?'primary':'secondary'} onClick={()=>setEvidenceEntryMode('excerpts')}>From Saved Excerpts</button></div>{evidenceEntryMode==='excerpts'&&<div className="saved-excerpt-picker"><label>Project saved excerpts<select value={selectedExcerptId} onChange={e=>selectSavedExcerpt(e.target.value)}><option value="">Select an excerpt</option>{savedExcerpts.map(x=><option key={x.id} value={x.id}>{(x.source_title||'Untitled source')+' — '+(x.quote||'').slice(0,90)}</option>)}</select></label>{excerptsLoading&&<p>Loading saved excerpts…</p>}{excerptsError&&<p role="alert">{excerptsError}</p>}<button type="button" className="secondary" onClick={loadSavedExcerpts}>Refresh excerpts</button><p>Source, original passage and note will be prefilled. You can review them before saving.</p></div>}<label>Source type<select value={manualEvidence.sourceType} onChange={e=>setManualEvidence(p=>({...p,sourceType:e.target.value}))}><option value="web">Website</option><option value="manual">Manual / Observation</option></select></label><label>Source title<input value={manualEvidence.sourceTitle} onChange={e=>setManualEvidence(p=>({...p,sourceTitle:e.target.value}))} placeholder="Article, interview or observation"/></label><label>Source URL (optional)<input type="url" value={manualEvidence.sourceUrl} onChange={e=>setManualEvidence(p=>({...p,sourceUrl:e.target.value}))} placeholder="https://..."/></label><label>Original quote / observation<textarea required rows={4} value={manualEvidence.quote} onChange={e=>setManualEvidence(p=>({...p,quote:e.target.value}))}/></label><label>Research theme<select required value={manualEvidence.theme} onChange={e=>setManualEvidence(p=>({...p,theme:e.target.value}))}>{[...new Set([...project.topics,'Uncategorised'])].map(t=><option key={t} value={t}>{t}</option>)}</select></label><label>Interpretation<textarea rows={3} value={manualEvidence.analysis} onChange={e=>setManualEvidence(p=>({...p,analysis:e.target.value}))}/></label><div className="modal-actions"><button type="button" className="secondary" onClick={()=>setManualEvidenceOpen(false)}>Cancel</button><button type="submit" className="primary">Add Unverified Evidence</button></div></form></div>}{evidenceEditor&&<div className="modal-backdrop" onMouseDown={e=>{if(e.target===e.currentTarget)setEvidenceEditor(null)}}><div className="modal evidence-modal v9-evidence-modal" role="dialog" aria-modal="true" aria-labelledby="evidence-edit-title"><div className="v9-modal-header"><div><span className="v9-eyebrow">EVIDENCE DETAILS</span><h2 id="evidence-edit-title">Edit Evidence</h2><p>Review the original source and refine your research interpretation.</p></div><button className="icon-btn" aria-label="Close evidence editor" onClick={()=>setEvidenceEditor(null)}><X size={19}/></button></div><div className="v9-modal-scroll"><section className="v9-modal-section"><div className="v9-section-heading"><strong>Original Passage</strong><span className="v9-readonly">Read-only</span></div><blockquote className="v9-source-quote" style={{borderLeftColor:themeColor(project.topics,evidenceEditor.theme)}}>{evidenceEditor.text||evidenceEditor.quote||'Original quote unavailable'}</blockquote><div className="v9-source-meta"><FileText size={14}/><span>{project.papers.find(p=>p.id===evidenceEditor.paperId)?.name||evidenceEditor.sourceTitle||evidenceEditor.source||'Manual source'}{evidenceEditor.paperId?' · Page '+(evidenceEditor.page||'?'):''}</span></div></section><section className="v9-modal-section"><div className="v9-section-heading"><strong>Relationship to Research Question</strong></div><div className="v9-relationship-picker" role="group" aria-label="Relationship to Research Question">{relationshipOptions.map(t=><button key={t} type="button" className={evidenceEditor.relationship===t?'active':''} style={evidenceEditor.relationship===t?relationshipStyle(t):undefined} onClick={()=>setEvidenceEditor(old=>({...old,relationship:t}))}>{t}</button>)}</div></section><section className="v9-modal-section"><div className="v9-section-heading"><strong>Research Themes</strong><span className="v9-section-note">Select one or more</span></div><div className="v9-theme-options">{[...new Set([...project.topics,'Uncategorised'])].map(t=><label key={t} className={(evidenceEditor.themes||[evidenceEditor.theme]).includes(t)?'selected':''}><input type="checkbox" checked={(evidenceEditor.themes||[evidenceEditor.theme]).includes(t)} onChange={ev=>setEvidenceEditor(old=>{const themes=ev.target.checked?[...new Set([...(old.themes||[old.theme]),t])]:(old.themes||[old.theme]).filter(x=>x!==t);return {...old,themes:themes.length?themes:[old.theme],theme:themes.includes(old.theme)?old.theme:(themes[0]||old.theme)}})}/><span className="theme-swatch" style={{background:themeColor(project.topics,t)}}/>{t}</label>)}</div></section><section className="v9-modal-section"><div className="v9-section-heading"><strong>Interpretation</strong><span className="v9-section-note">Editable</span></div><textarea aria-label="Evidence interpretation" rows="5" value={evidenceDraft} onChange={e=>setEvidenceDraft(e.target.value)} placeholder="Explain how this passage contributes to your research question..."/></section></div><div className="v9-modal-footer"><button className="secondary" onClick={()=>setEvidenceEditor(null)}>Cancel</button><button className="primary" disabled={!evidenceDraft.trim()} onClick={()=>{update(p=>({...p,evidence:p.evidence.map(x=>x.id===evidenceEditor.id?{...x,analysis:evidenceDraft.trim(),relationship:evidenceEditor.relationship||'Unclassified',theme:evidenceEditor.theme,themes:evidenceEditor.themes||[evidenceEditor.theme]}:x)}));setEvidenceEditor(null);toast('Evidence changes saved')}}>Save Changes</button></div></div></div>}{message&&<div className="toast">{message}</div>}
 </div>;
}
createRoot(document.getElementById('root')).render(<AuthGate/>);
