// Review AI suggestions from the SAME FastAPI analysis job used by the Web App.
// This panel never labels AI matches as verified evidence.
(() => {
 const $=id=>document.getElementById(id);
 const themesBox=$('pdfThemes'),results=$('pdfHighlights'),notice=$('pdfNotice');
 let selectedThemes=new Set(),activeJob=null,pollTimer=null;
 const clearPoll=()=>{if(pollTimer){clearTimeout(pollTimer);pollTimer=null;}activeJob=null;};
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
       notice.textContent='Review saved to the shared NUScope project.';
     }catch(error){notice.textContent='Review failed: '+error.message;}
     finally{for(const button of actions.querySelectorAll('button'))button.disabled=false;}
   }
   const verify=document.createElement('button');verify.textContent='Verify & Add Evidence';verify.disabled=rejected||saved;
   verify.addEventListener('click',()=>act('save'));
   const reject=document.createElement('button');reject.textContent='Reject';reject.disabled=rejected||saved;
   reject.addEventListener('click',()=>act('reject'));
   const restore=document.createElement('button');restore.textContent='Restore';restore.disabled=!rejected;
   restore.addEventListener('click',()=>act('restore'));
   actions.append(verify,reject,restore);
   card.append(meta,quote,reason,state,note,actions);results.append(card);
  }
 }
 async function poll(jobId,paperId){
  if(activeJob!==jobId||$('pdfPaper').value!==paperId)return;
  try{
   const job=await globalThis.nuscopeCloud.analysisJob(jobId);
   if(activeJob!==jobId)return;
   notice.textContent=(job.message||job.status||'Analysing')+' · '+(job.completed_batches||0)+'/'+(job.total_batches||'?')+' batches';
   render(job);
   if(['queued','running'].includes(job.status)){
    pollTimer=setTimeout(()=>poll(jobId,paperId),2500);
   }else{activeJob=null;notice.textContent='Analysis '+job.status+'. '+(job.matches||[]).length+' candidate(s). Review before adding evidence.';}
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
   activeJob=job.id;render(job);await poll(job.id,paperId);
  }catch(error){notice.textContent=error.message;}
  finally{$('analysePdf').disabled=false;}
 });
 $('pdfPaper').addEventListener('change',()=>{clearPoll();results.replaceChildren();});
 document.addEventListener('nuscope-project-changed',refreshThemes);
 document.addEventListener('nuscope-connection-ready',refreshThemes);
 window.addEventListener('pagehide',clearPoll);
})();
