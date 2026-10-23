import {eligibleCaptures} from './captureRules.mjs';
// Local captures remain intact; cloud sync is explicit and project-scoped.
(() => {
 const $=id=>document.getElementById(id);
 const box=document.createElement('section');box.className='connection excerpts-workspace';
 box.innerHTML='<h2>Project excerpts</h2><p id="cloudInfo">Sign in and choose a project to sync.</p><button id="syncLocal" type="button">Sync local excerpts to project</button><button id="loadCloud" type="button">Refresh project excerpts</button><div id="cloudList"></div>';
 $('localExcerptsSection').before(box);
 const info=$('cloudInfo'),list=$('cloudList');
 let busy=false;
 const message=text=>{info.textContent=text;};
 async function current(){return globalThis.nuscopeCloud.current();}
 async function load(){
  try{
   const {project}=await current();
   const entries=await globalThis.nuscopeCloud.list(project.id);
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
    if(!entry.evidence_id){
     const theme=document.createElement('select');theme.setAttribute('aria-label','Evidence theme');
     theme.add(new Option('Choose theme',''));
     for(const t of project.data?.topics||[])theme.add(new Option(t,t));
     const interpretation=document.createElement('textarea');interpretation.placeholder='Interpretation (optional)';interpretation.value=entry.note||'';
     const button=document.createElement('button');button.className='remove';button.textContent='Add to Evidence Map';
     button.addEventListener('click',async()=>{
      if(!theme.value){message('Choose a theme first.');return;}
      button.disabled=true;
      try{await globalThis.nuscopeCloud.promote(entry.id,theme.value,interpretation.value);await load();}
      catch(error){message('Could not add evidence: '+error.message);button.disabled=false;}
     });
     body.append(theme,interpretation,button);
    }
    details.append(summary,body);card.append(details);list.append(card);
   }
  }catch(error){list.replaceChildren();message(error.message);}
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
   if(!confirm('Upload '+eligible.length+' excerpt(s) to "'+project.name+'"?'+(legacy?' Includes '+legacy+' older unassigned capture(s).':'')))return;
   let synced=0;
   for(const entry of eligible){
    try{await globalThis.nuscopeCloud.save(entry,project.id,userId);synced++;}
    catch(error){
     // Already synced excerpts remain unchanged; other errors are reported.
     if(!/409|duplicate key/i.test(error.message)){message('Synced '+synced+'; stopped: '+error.message);return;}
    }
   }
   await load();message('Local excerpts synced to '+project.name+'. Originals remain on this device.');
  }catch(error){message(error.message);}
  finally{busy=false;$('syncLocal').disabled=false;}
 });
 $('loadCloud').addEventListener('click',load);
 document.addEventListener('nuscope-project-changed',load);
 document.addEventListener('nuscope-connection-ready',load);
 chrome.storage.onChanged.addListener((changes,area)=>{if(area==='local'&&changes.nuscopeCaptures){message('New local capture saved. Sync it to the selected project when ready.');}});
})();
