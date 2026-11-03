import {eligibleCaptures,assignCaptureProject} from './captureRules.mjs';
// Local captures remain intact; cloud sync is explicit and project-scoped.
(() => {
 const $=id=>document.getElementById(id);
 const box=document.createElement('section');box.className='connection excerpts-workspace';
 box.innerHTML='<h2>Project excerpts</h2><p id="cloudInfo">Sign in and choose a project to save your captured passages.</p><button id="syncLocal" type="button">Save to Project & Evidence Map</button><button id="loadCloud" type="button">Refresh project excerpts</button><div id="cloudList"></div>';
 $('localExcerptsSection').before(box);
 // Keep the primary save action beside Open NUScope, as requested in user testing.
 $('openApp').before($('syncLocal'));
 const info=$('cloudInfo'),list=$('cloudList');
 let busy=false,loading=false;
 const message=text=>{info.textContent=text;};
 async function current(){return globalThis.nuscopeCloud.current();}
 async function load(force=false){
  if(loading||(busy&&!force))return;
  loading=true;
  try{
   const {project}=await current();
   const activeProjectId=project.id;
   const entries=await globalThis.nuscopeCloud.list(project.id);
   if(globalThis.nuscopeCloud.selectedProject()?.id!==activeProjectId)return;
   list.replaceChildren();
   message(entries.length+' saved excerpt(s) in '+project.name+'.');
   for(const entry of entries){
    const card=document.createElement('article');card.className='item excerpt-compact';
    const details=document.createElement('details');
    const summary=document.createElement('summary');
    const title=document.createElement('strong');title.textContent=entry.source_title||'Untitled';
    const quote=document.createElement('blockquote');quote.textContent=entry.quote;
    const note=document.createElement('p');note.className='note';note.textContent=entry.note||'';
    const source=document.createElement('a');source.textContent='View original source ↗';
    try{const url=new URL(entry.source_url||'');if(url.protocol==='https:'||url.protocol==='http:'){source.href=url.href;source.target='_blank';source.rel='noopener noreferrer';}}catch{}
    const label=document.createElement('p');label.className='meta';label.textContent=entry.evidence_id?'Added to Evidence Map':'Not added to Evidence Map';
    const preview=document.createElement('span');preview.className='excerpt-preview';preview.textContent=entry.quote||'';
    const body=document.createElement('div');body.className='excerpt-body';
    summary.append(title,preview,label);
    body.append(quote,note);
    if(source.href)body.append(source);
    details.append(summary,body);card.append(details);list.append(card);
   }
  }catch(error){message('Excerpt refresh failed: '+error.message);}
  finally{loading=false;}
 }
 $('syncLocal').addEventListener('click',async()=>{
  if(busy)return;
  busy=true;$('syncLocal').disabled=true;
  try{
   const {project,userId}=await current();
   const {nuscopeCaptures=[]}=await chrome.storage.local.get({nuscopeCaptures:[]});
   const eligible=eligibleCaptures(nuscopeCaptures,project.id);
   const legacy=eligible.filter(e=>!e.projectId).length;
   if(!eligible.length){message('No excerpts for this project. Captures from other projects are excluded.');return;}
   if(!confirm('Save '+eligible.length+' captured passage(s) to "'+project.name+'"?'+(legacy?' Includes '+legacy+' older unassigned capture(s).':'')))return;
   // Save each capture first, then promote the same excerpt to evidence.
   // A retry must not duplicate either record if the first operation succeeded.
   let saved=0,added=0,failed=0;
   let existing=await globalThis.nuscopeCloud.list(project.id);
   const byId=new Map(existing.map(e=>[e.id,e]));
   for(const entry of eligible){
    try{
     let cloud=byId.get(entry.id);
     if(!cloud){
      try{
       const created=await globalThis.nuscopeCloud.save(entry,project.id,userId);
       cloud=Array.isArray(created)?created[0]:created;
       saved++;
      }catch(error){
       // A previously saved capture may exist after an interrupted request.
       existing=await globalThis.nuscopeCloud.list(project.id);
       cloud=existing.find(e=>e.id===entry.id);
       if(!cloud)throw error;
      }
     }
     // Bind an older unassigned local capture to its first saved project.
     // Otherwise the same UUID appears eligible in every project on later syncs.
     if(!entry.projectId){
      const {nuscopeCaptures:latest=[]}=await chrome.storage.local.get({nuscopeCaptures:[]});
      const updated=assignCaptureProject(latest,entry.id,project.id);
      await chrome.storage.local.set({nuscopeCaptures:updated});
      entry.projectId=project.id;
     }
     if(!cloud?.evidence_id){
      await globalThis.nuscopeCloud.promote(entry.id,'Uncategorised',entry.note||'');
      added++;
     }
     byId.set(entry.id,{...cloud,evidence_id:cloud?.evidence_id||'promoted'});
    }catch(error){
     failed++;
     message('Saved '+saved+' excerpt(s), added '+added+' to Evidence Map; '+failed+' failed. '+error.message);
    }
   }
   await load(true);
   if(!failed)message('Saved to '+project.name+' and Evidence Map. '+added+' new evidence record(s); existing entries were not duplicated.');
   else message('Partially completed: '+added+' added to Evidence Map, '+failed+' failed. Retry to finish without duplicating saved excerpts.');

  }catch(error){message(error.message);}
  finally{busy=false;$('syncLocal').disabled=false;}
 });
 $('loadCloud').addEventListener('click',load);
 document.addEventListener('nuscope-project-changed',load);
 document.addEventListener('nuscope-connection-ready',load);
 document.addEventListener('nuscope-shared-project-updated',()=>{
  // Preserve draft interpretations and theme selections while user is editing.
  if(busy||box.contains(document.activeElement)&&['TEXTAREA','SELECT','INPUT'].includes(document.activeElement?.tagName))return;
  load();
 });
 // Saved excerpts live in a separate Supabase table, not projects.data.
 // Refresh them independently, even when the project metadata has not changed.
 const excerptTimer=setInterval(()=>{
  if(document.hidden||busy||loading)return;
  if(box.contains(document.activeElement)&&['TEXTAREA','SELECT','INPUT'].includes(document.activeElement?.tagName))return;
  load();
 },30000);
 window.addEventListener('pagehide',()=>clearInterval(excerptTimer));
 chrome.storage.onChanged.addListener((changes,area)=>{if(area==='local'&&changes.nuscopeCaptures){message('New passage captured locally. Choose Save to Project & Evidence Map when ready.');}});
})();
