import {locateQuote} from './quoteMatch.mjs';
import * as pdfjs from './vendor/pdf.mjs';
pdfjs.GlobalWorkerOptions.workerSrc=chrome.runtime.getURL('vendor/pdf.worker.mjs');
const $=id=>document.getElementById(id);
const params=new URLSearchParams(location.search);
const projectId=params.get('project'),paperId=params.get('paper');
let documentPdf=null,page=1,renderTask=null,epoch=0,pageGeometry=null;
const message=text=>{$('message').textContent=text;};
function sourceRange(root,start,end){
 const walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT);
 let node,offset=0,first=null,last=null;
 while((node=walker.nextNode())){
  const next=offset+node.textContent.length;
  if(!first&&start<next)first={node,at:Math.max(0,start-offset)};
  if(first&&end<=next){last={node,at:Math.max(0,end-offset)};break;}
  offset=next;
 }
 if(!first||!last)return null;
 const range=document.createRange();range.setStart(first.node,first.at);range.setEnd(last.node,last.at);return range;
}
const PALETTE=['#E8B844','#67A7E8','#A783E8','#47B99A','#E48C98','#7D89D9'];
function selectionThemes(){return window.readerSelection?.nuscopePdfHighlights?.themes||[];}
function themeColor(theme,themes){
 const names=[...new Set([...themes,theme].filter(Boolean))].sort((a,b)=>a.localeCompare(b));
 return PALETTE[names.indexOf(theme)%PALETTE.length];
}
// Backend rects come from PyMuPDF's verified source search. Use only on
// unrotated, uncropped pages with matching top-left page coordinates.
function drawSourceRects(match,overlay,themes){
 const geometry=pageGeometry,rects=match.rects;
 if(!geometry||!Array.isArray(rects)||!rects.length||geometry.rotation!==0||geometry.x!==0||geometry.y!==0)return false;
 const {width,height,renderWidth,renderHeight}=geometry;
 if(!width||!height)return false;
 const valid=rects.filter(r=>Array.isArray(r)&&r.length===4&&r.every(Number.isFinite)&&r[0]>=0&&r[1]>=0&&r[2]>r[0]&&r[3]>r[1]&&r[2]<=width+.5&&r[3]<=height+.5);
 if(valid.length!==rects.length)return false;
 for(const r of valid){
  const marker=document.createElement('div');marker.className='mark';
  marker.style.left=(r[0]/width*renderWidth)+'px';
  marker.style.top=(r[1]/height*renderHeight)+'px';
  marker.style.width=((r[2]-r[0])/width*renderWidth)+'px';
  marker.style.height=((r[3]-r[1])/height*renderHeight)+'px';
  marker.style.background=themeColor(match.theme,themes)+'77';
  overlay.append(marker);
 }
 return valid.length>0;
}
function drawHighlights(){
 const layer=$('textLayer'),over=$('highlightLayer');
 let located=0,unmatched=0;
 over.replaceChildren();
 const text=layer.textContent||'';
 const themes=selectionThemes();
 const {nuscopePdfHighlights:selection}=window.readerSelection||{};
 if(!selection||selection.paperId!==paperId||selection.projectId!==projectId)return;
 for(const m of selection.matches||[]){
  if(!themes.includes(m.theme)||Number(m.page)!==page)continue;
  if(drawSourceRects(m,over,themes)){located++;continue;}
  const offsets=locateQuote(text,m.quote||m.text||'');
  if(!offsets){
   if(drawSourceRects(m,over,themes)){located++;continue;}
   unmatched++;continue;
  }
  const range=sourceRange(layer,offsets.start,offsets.end);
  if(!range){if(drawSourceRects(m,over,themes)){located++;continue;}unmatched++;continue;}
  const parent=layer.getBoundingClientRect();
  located++;
  for(const rect of range.getClientRects()){
   if(rect.width<1||rect.height<1)continue;
   const marker=document.createElement('div');marker.className='mark';
   marker.style.left=(rect.left-parent.left)+'px';marker.style.top=(rect.top-parent.top)+'px';
   marker.style.width=rect.width+'px';marker.style.height=rect.height+'px';marker.style.background=themeColor(m.theme,themes)+'55';over.append(marker);
  }
 }
 const summary=$('highlightStatus');
 if(summary)summary.textContent=located+' located highlight(s)'+(unmatched?' · '+unmatched+' quote(s) could not be located on this page':'');
}
async function render(){
 if(!documentPdf)return;
 const id=++epoch;
 try{
  if(renderTask){
   const previous=renderTask;renderTask=null;
   previous.cancel();
   try{await previous.promise;}catch{} // PDF.js releases its canvas after cancellation settles.
  }
  if(id!==epoch)return;
  const pdfPage=await documentPdf.getPage(page);
  if(id!==epoch)return;
  const viewport=pdfPage.getViewport({scale:1.35});
  const [x0,y0,x1,y1]=pdfPage.view;
  pageGeometry={x:x0,y:y0,width:x1-x0,height:y1-y0,renderWidth:viewport.width,renderHeight:viewport.height,rotation:viewport.rotation};
  const ratio=Math.min(devicePixelRatio||1,2);
  const canvas=$('pageCanvas');canvas.width=Math.ceil(viewport.width*ratio);canvas.height=Math.ceil(viewport.height*ratio);
  canvas.style.width=viewport.width+'px';canvas.style.height=viewport.height+'px';
  const layer=$('textLayer');layer.replaceChildren();layer.style.width=viewport.width+'px';layer.style.height=viewport.height+'px';
  layer.style.setProperty('--scale-factor',String(viewport.scale));
  const overlay=$('highlightLayer');overlay.style.width=viewport.width+'px';overlay.style.height=viewport.height+'px';
  const task=pdfPage.render({canvasContext:canvas.getContext('2d'),viewport,transform:[ratio,0,0,ratio,0,0]});
  renderTask=task;
  try{await task.promise;}finally{if(renderTask===task)renderTask=null;}
  if(id!==epoch)return;
  const content=await pdfPage.getTextContent();
  const textTask=new pdfjs.TextLayer({textContentSource:content,container:layer,viewport});
  await textTask.render();
  if(id!==epoch)return;
  $('pageStatus').textContent=page+' / '+documentPdf.numPages;
  $('prev').disabled=page===1;$('next').disabled=page===documentPdf.numPages;
  message('');
  drawHighlights();
 }catch(error){if(error?.name!=='RenderingCancelledException')message('Could not render PDF page: '+error.message);}
}
async function load(){
 try{
  if(!projectId||!paperId)throw Error('Missing project or paper ID.');
  const {nuscopeSession:storedSession}=await chrome.storage.local.get(['nuscopeSession']);
  let session=storedSession;
  // Public configuration is packaged with the extension, not read from arbitrary websites.
  const config=globalThis.NUSCOPE_PUBLIC_CONFIG||{};
  if(!session?.access_token)throw Error('Sign in through the NUScope side panel first.');
  const base=config.url;
  if(!/^https:\/\/[a-z0-9-]+\.supabase\.co$/i.test(base)||!config.key)throw Error('Invalid packaged NUScope connection.');
  if(Date.now()>=(session.expires_at||0)-60000){
   if(!session.refresh_token)throw Error('Session expired. Sign in again.');
   const response=await fetch(base+'/auth/v1/token?grant_type=refresh_token',{method:'POST',headers:{apikey:config.key,'Content-Type':'application/json'},body:JSON.stringify({refresh_token:session.refresh_token})});
   if(!response.ok)throw Error('Session expired. Sign in again in the side panel.');
   const refreshed=await response.json();
   session={access_token:refreshed.access_token,refresh_token:refreshed.refresh_token,expires_at:Date.now()+refreshed.expires_in*1000};
   await chrome.storage.local.set({nuscopeSession:session});
  }
  const userResponse=await fetch(base+'/auth/v1/user',{headers:{apikey:config.key,Authorization:'Bearer '+session.access_token}});
  if(!userResponse.ok)throw Error('Session expired. Sign in again in the side panel.');
  const user=await userResponse.json();
  const rowResponse=await fetch(base+'/rest/v1/projects?id=eq.'+encodeURIComponent(projectId)+'&select=data',{headers:{apikey:config.key,Authorization:'Bearer '+session.access_token}});
  if(!rowResponse.ok)throw Error('Project access denied.');
  const rows=await rowResponse.json();
  const paper=rows[0]?.data?.papers?.find(p=>p.id===paperId);
  if(!paper)throw Error('PDF not found in your selected project.');
  const expected=user.id+'/'+projectId+'/'+paperId+'.pdf';
  if(paper.storagePath!==expected)throw Error('PDF storage path does not match your project.');
  $('paperName').textContent=paper.name||'Untitled PDF';
  const pdfResponse=await fetch(base+'/storage/v1/object/authenticated/research-pdfs/'+expected,{headers:{apikey:config.key,Authorization:'Bearer '+session.access_token}});
  if(!pdfResponse.ok)throw Error('Could not download private PDF ('+pdfResponse.status+').');
  const bytes=new Uint8Array(await pdfResponse.arrayBuffer());
  const task=pdfjs.getDocument({data:bytes});documentPdf=await task.promise;
  await render();
 }catch(error){message(error.message);}
}
$('prev').addEventListener('click',()=>{if(page>1){page--;render();}});
$('next').addEventListener('click',()=>{if(documentPdf&&page<documentPdf.numPages){page++;render();}});
chrome.storage.local.get('nuscopePdfHighlights').then(value=>{window.readerSelection=value;const chosen=value.nuscopePdfHighlights;if(chosen?.projectId===projectId&&chosen?.paperId===paperId&&chosen.page)page=chosen.page;load();});
chrome.storage.onChanged.addListener((changes,area)=>{
 if(area!=='local'||!changes.nuscopePdfHighlights)return;
 window.readerSelection={nuscopePdfHighlights:changes.nuscopePdfHighlights.newValue};
 const selection=changes.nuscopePdfHighlights.newValue;
 if(selection?.paperId===paperId&&selection?.projectId===projectId){
  if(selection.page&&selection.page!==page){page=selection.page;render();}
  else drawHighlights();
 }
});
