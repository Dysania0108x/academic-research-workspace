import {themeChipStyle} from './themePalette.mjs';
// Review AI suggestions from the SAME FastAPI analysis job used by the Web App.
// This panel never labels AI matches as verified evidence.
(() => {
 const $=id=>document.getElementById(id);
 const themesBox=$('pdfThemes'),results=$('pdfHighlights'),notice=$('pdfNotice');
 let selectedThemes=new Set(),activeJob=null,pollTimer=null;
 const clearPoll=()=>{if(pollTimer){clearTimeout(pollTimer);pollTimer=null;}activeJob=null;$('cancelPdfAnalysis').hidden=true;};
 function refreshThemes(){
  clearPoll();results.replaceChildren();
  const projectId=$('projectSelect').value;
  const project=globalThis.nuscopeCloud?.selectedProject?.();
  const themes=project?.data?.topics||[];
  selectedThemes=new Set(themes);
  themesBox.replaceChildren();
  if(!projectId)return;
  for(const theme of themes){
   const label=document.createElement('label');label.className='pdf-theme';
   const input=document.createElement('input');input.type='checkbox';input.checked=true;
   input.addEventListener('change',()=>{input.checked?selectedThemes.add(theme):selectedThemes.delete(theme);clearPoll();results.replaceChildren();});
   Object.assign(label.style,themeChipStyle(themes,theme));
   label.append(input,document.createTextNode(' '+theme));themesBox.append(label);
  }
 }
 function render(job){
  results.replaceChildren();
  const count=document.createElement('p');count.className='meta';count.textContent=(job.matches||[]).length+' AI highlight candidate(s) · Not verified';
  results.append(count);
  for(const m of job.matches||[]){
   const card=document.createElement('article');card.className='item';
   const meta=document.createElement('strong');meta.textContent=(m.theme||'Uncategorised')+' · Page '+(m.page||'?');
   Object.assign(meta.style,themeChipStyle(globalThis.nuscopeCloud.selectedProject()?.data?.topics||[],m.theme));
   const quote=document.createElement('blockquote');quote.textContent=m.quote||m.text||'';
   const reason=document.createElement('p');reason.textContent=m.reason||'';
   const project=globalThis.nuscopeCloud.selectedProject();
   const paperId=$('pdfPaper').value;
   const key=[paperId,m.page,(m.quote||m.text||'').trim().replace(/\s+/g,' ').toLowerCase()].join('|');
   const rejected=(project?.data?.rejected||[]).includes(key);
   const saved=(project?.data?.evidence||[]).some(e=>e.paperId===paperId&&Number(e.page)===Number(m.page)&&
     (e.quote||e.text||'').trim().replace(/\s+/g,' ').toLowerCase()===(m.quote||m.text||'').trim().replace(/\s+/g,' ').toLowerCase());
   const state=document.createElement('p');state.className='meta';state.textContent=rejected?'Rejected':saved?'Added to Evidence Map':'Pending review';
   const note=document.createElement('textarea');note.placeholder='Interpretation (review before verifying)';note.value=m.reason||'';
   const actions=document.createElement('div');actions.className='pdf-review-actions';
   async function act(action){
     for(const button of actions.querySelectorAll('button'))button.disabled=true;
     try{
       await globalThis.nuscopeCloud.reviewPdf(paperId,m,action,note.value);
       state.textContent=action==='reject'?'Rejected':action==='restore'?'Pending review':'Added to Evidence Map';
       verify.disabled=action!=='restore';reject.disabled=action!=='restore';restore.disabled=action!=='reject';
       notice.textContent='Review saved to the shared NUScope project.';
       const stored=await chrome.storage.local.get('nuscopePdfHighlights');
       const current=stored.nuscopePdfHighlights;
       if(current?.projectId===$('projectSelect').value&&current?.paperId===paperId){
         const matches=(current.matches||[]).filter(x=>!(Number(x.page)===Number(m.page)&&(x.quote||x.text||'')===(m.quote||m.text||'')));
         await chrome.storage.local.set({nuscopePdfHighlights:{...current,matches:action==='reject'?matches:action==='restore'?[...matches,m]:current.matches}});
       }
     }catch(error){notice.textContent='Review failed: '+error.message;}
     finally{if(state.textContent==='Pending review'){verify.disabled=false;reject.disabled=false;restore.disabled=true;}else if(state.textContent==='Rejected'){verify.disabled=true;reject.disabled=true;restore.disabled=false;}else{verify.disabled=true;reject.disabled=true;restore.disabled=true;}}
   }
   const verify=document.createElement('button');verify.textContent='Verify & Add Evidence';verify.disabled=rejected||saved;
   verify.addEventListener('click',()=>act('save'));
   const reject=document.createElement('button');reject.textContent='Reject';reject.disabled=rejected||saved;
   reject.addEventListener('click',()=>act('reject'));
   const restore=document.createElement('button');restore.textContent='Restore';restore.disabled=!rejected;
   restore.addEventListener('click',()=>act('restore'));
   actions.append(verify,reject,restore);
   const focus=document.createElement('button');focus.textContent='View highlight in PDF ↗';
   focus.addEventListener('click',async()=>{
     const projectId=$('projectSelect').value;
     await chrome.storage.local.set({nuscopePdfHighlights:{
       projectId,paperId,page:Number(m.page),themes:globalThis.nuscopeCloud.selectedProject()?.data?.topics||[],matches:(job.matches||[]).filter(x=>{
         const k=[paperId,x.page,(x.quote||x.text||'').trim().replace(/\s+/g,' ').toLowerCase()].join('|');
         return !(globalThis.nuscopeCloud.selectedProject()?.data?.rejected||[]).includes(k);
       })
     }});
     await chrome.tabs.create({url:chrome.runtime.getURL('reader.html')+'?project='+encodeURIComponent(projectId)+'&paper='+encodeURIComponent(paperId)});
   });
   const details=document.createElement('details');details.className='highlight-details';
   const summary=document.createElement('summary');summary.className='highlight-summary';
   const excerpt=document.createElement('span');excerpt.className='highlight-excerpt';
   excerpt.textContent=(m.quote||m.text||'').trim();
   const status=document.createElement('span');status.className='highlight-status';
   status.textContent=state.textContent;
   const expanded=document.createElement('div');expanded.className='highlight-expanded';
   expanded.append(quote,reason,state,note,focus,actions);
   summary.append(meta,excerpt,status);
   details.append(summary,expanded);
   card.classList.add('highlight-compact');
   card.append(details);results.append(card);
   const observer=new MutationObserver(()=>{status.textContent=state.textContent;});
   observer.observe(state,{childList:true,characterData:true,subtree:true});
  }
 }
 async function poll(jobId,paperId){
  if(activeJob!==jobId||$('pdfPaper').value!==paperId)return;
  try{
   const job=await globalThis.nuscopeCloud.analysisJob(jobId);
   if(activeJob!==jobId)return;
   const timings=job.batch_timings||[];
   const last=timings[timings.length-1];
   const elapsed=job.batch_started_at?Math.max(0,Math.round(Date.now()/1000-job.batch_started_at)):null;
   notice.textContent=(job.message||job.status||'Analysing')+' · '+(job.completed_batches||0)+'/'+(job.total_batches||'?')+' batches'+(elapsed!==null?' · current batch '+elapsed+'s':'')+(last?' · previous '+last.seconds+'s'+(last.cached?' (cached)':''):'');
   // Keep the review form stable while background batches are still arriving.
   if(!['queued','running'].includes(job.status))render(job);
   if(['queued','running'].includes(job.status)){
    pollTimer=setTimeout(()=>poll(jobId,paperId),2500);
   }else{activeJob=null;$('cancelPdfAnalysis').hidden=true;notice.textContent='Analysis '+job.status+'. '+(job.matches||[]).length+' candidate(s). Review before adding evidence.';}
  }catch(error){activeJob=null;notice.textContent=error.message;}
 }
 $('analysePdf').addEventListener('click',async()=>{
  const paperId=$('pdfPaper').value;
  if(!paperId){notice.textContent='Select a project PDF first.';return;}
  const themes=[...selectedThemes];
  if(!themes.length){notice.textContent='Select at least one project theme.';return;}
  clearPoll();results.replaceChildren();
  $('analysePdf').disabled=true;
  notice.textContent='Starting analysis using the NUScope AI backend…';
  try{
   const job=await globalThis.nuscopeCloud.analysePdf(paperId,themes);
   activeJob=job.id;$('cancelPdfAnalysis').hidden=!['queued','running'].includes(job.status);if(!['queued','running'].includes(job.status))render(job);await poll(job.id,paperId);
  }catch(error){notice.textContent=error.message;}
  finally{$('analysePdf').disabled=false;}
 });
 $('cancelPdfAnalysis').addEventListener('click',async()=>{
  if(!activeJob)return;
  const jobId=activeJob;
  $('cancelPdfAnalysis').disabled=true;
  notice.textContent='Requesting cancellation…';
  try{
   const result=await globalThis.nuscopeCloud.cancelAnalysis(jobId);
   if(activeJob===jobId){clearPoll();notice.textContent=result.message||'Analysis cancelled. In-flight AI requests may still complete.';}
  }catch(error){notice.textContent='Cancellation failed: '+error.message;}
  finally{$('cancelPdfAnalysis').disabled=false;}
 });
 $('pdfPaper').addEventListener('change',()=>{clearPoll();results.replaceChildren();});
 document.addEventListener('nuscope-project-changed',refreshThemes);
 document.addEventListener('nuscope-connection-ready',refreshThemes);
 window.addEventListener('pagehide',clearPoll);
})();
