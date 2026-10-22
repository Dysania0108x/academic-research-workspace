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
  async function loadProjects(preferred=''){
    updateAuth();
    try{
      await validSession();
      const rows=await request('/rest/v1/projects?select=id,name,research_question,data&order=created_at.asc',{headers:{Authorization:'Bearer '+session.access_token}});
      projects=Array.isArray(rows)?rows:[];
      const select=el('projectSelect');select.replaceChildren(new Option('Choose a project',''));
      for(const p of projects)select.add(new Option(p.name||p.data?.name||'Untitled project',p.id));
      if(preferred&&projects.some(p=>p.id===preferred))select.value=preferred;
      displayProject();status.textContent='Connected. '+projects.length+' project(s) available.';
      document.dispatchEvent(new Event('nuscope-project-changed'));
    }catch(error){status.textContent='Sync error: '+error.message;}
  }
  function displayProject(){
    const project=projects.find(p=>p.id===el('projectSelect').value);
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
    async promote(excerptId,theme,interpretation){
      await validSession();
      return request('/rest/v1/rpc/add_excerpt_evidence',{method:'POST',headers:{Authorization:'Bearer '+session.access_token,'Content-Type':'application/json'},body:JSON.stringify({p_excerpt_id:excerptId,p_theme:theme,p_interpretation:interpretation})});
    }
  };
  el('projectSelect').addEventListener('change',()=>document.dispatchEvent(new Event('nuscope-project-changed')));
  settings().then(()=>document.dispatchEvent(new Event('nuscope-connection-ready'))).catch(error=>{status.textContent='Initialization error: '+error.message;});

})();
