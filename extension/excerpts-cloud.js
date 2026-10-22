// Local captures remain intact; cloud sync is explicit and project-scoped.
(() => {
 const $=id=>document.getElementById(id);
 const box=document.createElement('section');box.className='connection';
 box.innerHTML='<h2>Project excerpts</h2><p id="cloudInfo">Sign in and choose a project to sync.</p><button id="syncLocal" type="button">Sync local excerpts to project</button><button id="loadCloud" type="button">Refresh project excerpts</button><div id="cloudList"></div>';
 $('items').parentNode.insertBefore(box,$('items'));
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
    const card=document.createElement('article');card.className='item';
    const title=document.createElement('strong');title.textContent=entry.source_title||'Untitled';
    const quote=document.createElement('blockquote');quote.textContent=entry.quote;
    const note=document.createElement('p');note.className='note';note.textContent=entry.note||'';
    const label=document.createElement('p');label.className='meta';label.textContent=entry.evidence_id?'Added to Evidence Map':'Not added to Evidence Map';
    card.append(title,quote,note,label);
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
     card.append(theme,interpretation,button);
    }
    list.append(card);
   }
  }catch(error){list.replaceChildren();message(error.message);}
 }
 $('syncLocal').addEventListener('click',async()=>{
  if(busy)return;
  busy=true;$('syncLocal').disabled=true;
  try{
   const {project,userId}=await current();
   const {nuscopeCaptures=[]}=await chrome.storage.local.get({nuscopeCaptures:[]});
   // Legacy local captures have no project association. Require explicit user action.
   if(!nuscopeCaptures.length){message('No local excerpts to sync.');return;}
   if(!confirm('Upload '+nuscopeCaptures.length+' local excerpt(s) to project "'+project.name+'"?'))return;
   let synced=0;
   for(const entry of nuscopeCaptures){
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
})();
