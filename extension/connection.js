// Independent Supabase REST client for the extension. No Web App token scraping.
(() => {
  const el=id=>document.getElementById(id);
  const status=el('authStatus');
  let config=null,session=null,projects=[];
  const packaged=globalThis.NUSCOPE_PUBLIC_CONFIG||{};
  const originOk=url=>{try{const u=new URL(url);return u.protocol==='https:'&&/^[a-z0-9-]+\.supabase\.co$/i.test(u.hostname)&&u.pathname==='/'&& !u.search&&!u.hash;}catch{return false;}};
  const settings=async()=>{
    const {nuscopeSession:s,nuscopeProjectId:p}=await chrome.storage.local.get(['nuscopeSession','nuscopeProjectId']);
    config={url:String(packaged.url||'').replace(/\/$/,''),key:String(packaged.key||'')};session=s||null;
    if(!originOk(config.url+'/')||!config.key){el('configurationNotice').hidden=false;el('loginForm').hidden=true;status.textContent='Extension public configuration missing.';return;}
    if(session){await loadProjects(p||'');}else updateAuth();
  };
  const headers=()=>({'apikey':config.key,'Authorization':'Bearer '+session.access_token});
  async function request(path,options={}){
    if(!config||!originOk(config.url))throw Error('Configure a valid Supabase project URL first.');
    const response=await fetch(config.url+path,{...options,headers:{apikey:config.key,...options.headers}});
    const body=await response.json().catch(()=>({}));
    if(!response.ok)throw Error(body.msg||body.message||body.error_description||'Request failed ('+response.status+')');
    return body;
  }
  async function validSession(){
    if(!session?.access_token)throw Error('Sign in first.');
    if(Date.now()<(session.expires_at||0)-60000)return;
    if(!session.refresh_token)throw Error('Session expired. Sign in again.');
    const result=await request('/auth/v1/token?grant_type=refresh_token',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({refresh_token:session.refresh_token})});
    session={access_token:result.access_token,refresh_token:result.refresh_token,expires_at:Date.now()+result.expires_in*1000};
    await chrome.storage.local.set({nuscopeSession:session});
  }
  function updateAuth(){
    el('loginForm').hidden=!!session;
    el('logout').hidden=!session;
    el('projectSection').hidden=!session;
    status.textContent=session?'Connected to NUScope Supabase.':'Not connected. Your saved excerpts remain on this device.';
  }
  async function loadProjects(preferred='',notify=true){
    updateAuth();
    try{
      await validSession();
      const rows=await request('/rest/v1/projects?select=id,name,research_question,data&order=created_at.asc',{headers:{Authorization:'Bearer '+session.access_token}});
      projects=Array.isArray(rows)?rows:[];
      const select=el('projectSelect');select.replaceChildren(new Option('Choose a project',''));
      for(const p of projects)select.add(new Option(p.name||p.data?.name||'Untitled project',p.id));
      if(preferred&&projects.some(p=>p.id===preferred))select.value=preferred;
      displayProject();status.textContent='Connected. '+projects.length+' project(s) available.';
      if(notify)document.dispatchEvent(new Event('nuscope-project-changed'));
    }catch(error){status.textContent='Sync error: '+error.message;}
  }
  function displayProject(){
    const project=projects.find(p=>p.id===el('projectSelect').value);
    const pdfSection=el('pdfProject'),paperSelect=el('pdfPaper');
    pdfSection.hidden=!project;paperSelect.replaceChildren(new Option('Select a PDF',''));
    for(const paper of project?.data?.papers||[])paperSelect.add(new Option(paper.name||paper.title||'Untitled PDF',paper.id));
    el('pdfNotice').textContent=project?(paperSelect.options.length-1)+' project paper(s) available.':'';
    el('researchQuestion').textContent=project?'Research question: '+(project.data?.question||project.research_question||'Not set'):'Select a project created in the NUScope Web App.';
    el('projectThemes').replaceChildren();
    for(const theme of (Array.isArray(project?.data?.topics)?project.data.topics:[])){
      const chip=document.createElement('span');chip.textContent=String(theme);el('projectThemes').append(chip);
    }
    chrome.storage.local.set({nuscopeProjectId:project?.id||''}).catch(()=>{});
  }
  el('loginForm').addEventListener('submit',async event=>{
    event.preventDefault();
    try{
      const result=await request('/auth/v1/token?grant_type=password',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:el('sbEmail').value.trim(),password:el('sbPassword').value})});
      session={access_token:result.access_token,refresh_token:result.refresh_token,expires_at:Date.now()+result.expires_in*1000};
      await chrome.storage.local.set({nuscopeSession:session});
      el('sbPassword').value='';await loadProjects();
    }catch(error){status.textContent='Sign-in error: '+error.message;}
  });
  el('logout').addEventListener('click',async()=>{session=null;projects=[];await chrome.storage.local.remove(['nuscopeSession','nuscopeProjectId']);updateAuth();});
  el('refreshProjects').addEventListener('click',()=>loadProjects(el('projectSelect').value));
  el('projectSelect').addEventListener('change',displayProject);

  // Expose only narrowly scoped authenticated operations to this extension page.
  // Never expose access tokens to content scripts or ordinary web pages.
  globalThis.nuscopeCloud={
    selectedProject(){return projects.find(p=>p.id===el('projectSelect').value)||null;},
    async current(){
      await validSession();
      const id=el('projectSelect').value;
      const project=projects.find(p=>p.id===id);
      if(!project)throw Error('Select a NUScope project first.');
      const user=await request('/auth/v1/user',{headers:{Authorization:'Bearer '+session.access_token}});
      return {project,userId:user.id};
    },
    async list(projectId){
      await validSession();
      return request('/rest/v1/saved_excerpts?select=*&project_id=eq.'+encodeURIComponent(projectId)+'&order=captured_at.desc',{headers:{Authorization:'Bearer '+session.access_token}});
    },
    async save(item,projectId,userId){
      await validSession();
      return request('/rest/v1/saved_excerpts',{method:'POST',headers:{Authorization:'Bearer '+session.access_token,'Content-Type':'application/json',Prefer:'return=representation'},body:JSON.stringify({id:item.id,user_id:userId,project_id:projectId,quote:item.quote,note:item.note||'',source_title:item.title||'',source_url:item.url||'',captured_at:item.capturedAt||new Date().toISOString()})});
    },
    async analysePdf(paperId,themes){
      const {project}=await this.current();
      if(!(project.data?.papers||[]).some(p=>p.id===paperId))throw Error('Paper does not belong to selected project.');
      const apiBase=String(packaged.apiBase||'').replace(/\/$/,'');
      if(!apiBase)throw Error('AI API is not configured in the extension package. Set the public VITE_API_BASE_URL GitHub Actions variable and rebuild.');
      await validSession();
      const response=await fetch(apiBase+'/api/analyse/start',{
        method:'POST',
        headers:{'Authorization':'Bearer '+session.access_token,'Content-Type':'application/json'},
        body:JSON.stringify({paper_id:paperId,question:project.data?.question||project.research_question,themes})
      });
      const result=await response.json().catch(()=>({}));
      if(!response.ok)throw Error(result.detail||'AI analysis failed (HTTP '+response.status+')');
      return result;
    },
    async analysisJob(jobId){
      const apiBase=String(packaged.apiBase||'').replace(/\/$/,'');
      if(!apiBase)throw Error('AI API not configured.');
      await validSession();
      const response=await fetch(apiBase+'/api/analyse/jobs/'+encodeURIComponent(jobId),{
        headers:{'Authorization':'Bearer '+session.access_token}
      });
      const result=await response.json().catch(()=>({}));
      if(!response.ok)throw Error(result.detail||'Unable to load analysis job (HTTP '+response.status+')');
      return result;
    },
    async reviewPdf(paperId,match,action,interpretation=''){
      const {project}=await this.current();
      if(!(project.data?.papers||[]).some(p=>p.id===paperId))throw Error('PDF is not in this project.');
      if(!(project.data?.topics||[]).includes(match.theme))throw Error('Theme is no longer in the project.');
      await validSession();
      const result=await request('/rest/v1/rpc/review_pdf_highlight',{
        method:'POST',
        headers:{Authorization:'Bearer '+session.access_token,'Content-Type':'application/json'},
        body:JSON.stringify({p_project_id:project.id,p_paper_id:paperId,p_page:match.page,
          p_quote:match.quote||match.text,p_theme:match.theme,p_action:action,p_interpretation:interpretation})
      });
      await loadProjects(project.id,false);
      return result;
    },
    async pdfLink(paperId){
      const {project}=await this.current();
      const paper=(project.data?.papers||[]).find(p=>p.id===paperId);
      if(!paper)throw Error('Choose a paper from this project.');
      if(!paper.storagePath)throw Error('This PDF has no cloud file. Upload it in the NUScope Web App first.');
      const {userId}=await this.current();
      const expected=userId+'/'+project.id+'/'+paper.id+'.pdf';
      if(paper.storagePath!==expected)throw Error('Unexpected PDF storage path.');
      await validSession();
      const result=await request('/storage/v1/object/sign/research-pdfs/'+expected,{
        method:'POST',headers:{Authorization:'Bearer '+session.access_token,'Content-Type':'application/json'},
        body:JSON.stringify({expiresIn:60})
      });
      const path=result.signedURL||result.signedUrl;
      if(!path||!path.startsWith('/'))throw Error('Could not obtain a PDF viewing link.');
      return config.url+'/storage/v1'+path;
    },
    async promote(excerptId,theme,interpretation){
      await validSession();
      return request('/rest/v1/rpc/add_excerpt_evidence',{method:'POST',headers:{Authorization:'Bearer '+session.access_token,'Content-Type':'application/json'},body:JSON.stringify({p_excerpt_id:excerptId,p_theme:theme,p_interpretation:interpretation})});
    }
  };
  el('projectSelect').addEventListener('change',()=>document.dispatchEvent(new Event('nuscope-project-changed')));
  el('openProjectPdf').addEventListener('click',async()=>{
    const id=el('pdfPaper').value;
    if(!id){el('pdfNotice').textContent='Select a PDF first.';return;}
    // Open a blank tab synchronously to avoid pop-up blocking during signed URL generation.
    const tab=await chrome.tabs.create({url:'about:blank',active:true});
    try{
      const url=await globalThis.nuscopeCloud.pdfLink(id);
      await chrome.tabs.update(tab.id,{url});
      el('pdfNotice').textContent='Opened the original project PDF.';
    }catch(error){
      await chrome.tabs.remove(tab.id).catch(()=>{});
      el('pdfNotice').textContent=error.message;
    }
  });
  settings().then(()=>document.dispatchEvent(new Event('nuscope-connection-ready'))).catch(error=>{status.textContent='Initialization error: '+error.message;});

})();
