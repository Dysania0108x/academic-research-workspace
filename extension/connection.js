// Independent Supabase REST client for the extension. No Web App token scraping.
(() => {
  const el=id=>document.getElementById(id);
  const status=el('authStatus');
  let config=null,session=null,projects=[];
  const originOk=url=>{try{const u=new URL(url);return u.protocol==='https:'&&/^[a-z0-9-]+\.supabase\.co$/i.test(u.hostname)&&u.pathname==='/'&& !u.search&&!u.hash;}catch{return false;}};
  const settings=async()=>{
    const {nuscopeSupabaseConfig:c,nuscopeSession:s,nuscopeProjectId:p}=await chrome.storage.local.get(['nuscopeSupabaseConfig','nuscopeSession','nuscopeProjectId']);
    config=c||null;session=s||null;
    if(config){el('sbUrl').value=config.url;el('sbKey').value=config.key;}
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
  el('saveSettings').addEventListener('click',async()=>{
    const url=el('sbUrl').value.trim().replace(/\/$/,'');
    const key=el('sbKey').value.trim();
    if(!originOk(url+'/')||!key||/service_role|sb_secret_/i.test(key)){status.textContent='Use a valid HTTPS Supabase project URL and a publishable/anon key (never a secret key).';return;}
    config={url,key};session=null;projects=[];
    await chrome.storage.local.set({nuscopeSupabaseConfig:config});
    await chrome.storage.local.remove(['nuscopeSession','nuscopeProjectId']);
    updateAuth();status.textContent='Settings saved. Sign in with your NUScope account.';
  });
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
  settings().catch(error=>{status.textContent='Initialization error: '+error.message;});
})();
