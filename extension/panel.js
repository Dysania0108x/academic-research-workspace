const $=id=>document.getElementById(id);
let config={},session=null;
const status=message=>{$('status').textContent=message};
function validConfig(){const url=new URL(config.url);if(url.protocol!=='https:'||!/^https:\/\/[a-z0-9-]+\.supabase\.co$/i.test(url.origin))throw Error('Use a valid https://<project>.supabase.co URL');if(!config.key)throw Error('Publishable key required');return url.origin}
async function request(path,{method='GET',body,auth=true}={}){
  const origin=validConfig();
  const headers={'apikey':config.key,'Content-Type':'application/json'};
  if(auth){if(!session?.access_token)throw Error('Please sign in');headers.Authorization='Bearer '+session.access_token}
  const response=await fetch(origin+path,{method,headers,body:body===undefined?undefined:JSON.stringify(body)});
  const raw=await response.text();let data;try{data=raw?JSON.parse(raw):null}catch{data=null}
  if(!response.ok)throw Error(data?.msg||data?.message||data?.error_description||('Request failed ('+response.status+')'));
  return data;
}
async function refresh(){
  if(!session?.refresh_token)throw Error('Please sign in');
  session=await request('/auth/v1/token?grant_type=refresh_token',{method:'POST',body:{refresh_token:session.refresh_token},auth:false});
  await chrome.storage.local.set({session});
}
async function authorized(path,options){
  if(session?.expires_at && Date.now()/1000>session.expires_at-60)await refresh();
  return request(path,options);
}
async function loadProjects(){
  const rows=await authorized('/rest/v1/projects?select=id,name&order=created_at.desc&limit=100');
  $('project').replaceChildren();
  for(const row of rows){const option=document.createElement('option');option.value=row.id;option.textContent=row.name;$('project').append(option)}
  if(!rows.length)status('Create a Project in the Web App before capturing excerpts.');
}
function showSession(){
  $('capture').hidden=!session;$('login').hidden=!!session;$('logout').hidden=!session;
  $('password').value='';
}
$('login').addEventListener('click',async()=>{
  try{
    config={url:$('url').value.trim().replace(/\/$/,''),key:$('key').value.trim()};
    validConfig();status('Signing in...');
    const email=$('email').value.trim(),password=$('password').value;
    if(!email||!password)throw Error('Email and password required');
    session=await request('/auth/v1/token?grant_type=password',{method:'POST',body:{email,password},auth:false});
    await chrome.storage.local.set({config,session});showSession();await loadProjects();status('Signed in.');
  }catch(error){status(error.message)}
});
$('logout').addEventListener('click',async()=>{
  session=null;await chrome.storage.local.remove('session');showSession();status('Signed out on this device.');
});
$('read').addEventListener('click',async()=>{
  try{
    const [tab]=await chrome.tabs.query({active:true,currentWindow:true});
    if(!tab?.id||!/^https?:\/\//.test(tab.url||''))throw Error('Open a normal http(s) research page first');
    const results=await chrome.scripting.executeScript({target:{tabId:tab.id},func:()=>window.getSelection()?.toString()||''});
    $('title').value=(tab.title||'Untitled page').slice(0,500);
    $('sourceUrl').value=tab.url;
    $('excerpt').value=(results[0]?.result||'').trim().slice(0,10000);
    status($('excerpt').value?'Selection captured. Review before saving.':'No selected text. Highlight text on the page first.');
  }catch(error){status('Capture failed: '+error.message)}
});
$('save').addEventListener('click',async()=>{
  try{
    const project_id=$('project').value,title=$('title').value.trim(),source_url=$('sourceUrl').value.trim(),excerpt=$('excerpt').value.trim(),note=$('note').value.trim();
    if(!project_id)throw Error('Select a Project');
    if(!title||!excerpt)throw Error('Title and excerpt are required');
    const parsed=new URL(source_url);if(!['https:','http:'].includes(parsed.protocol))throw Error('Invalid source URL');
    if(title.length>500||source_url.length>2048||excerpt.length>10000||note.length>3000)throw Error('Capture exceeds field limits');
    await authorized('/rest/v1/research_clips',{method:'POST',body:{user_id:session.user.id,project_id,title,source_url,excerpt,note,status:'unverified'}});
    $('excerpt').value='';$('note').value='';status('Saved to research inbox as unverified.');
  }catch(error){status('Save failed: '+error.message)}
});
(async()=>{
  try{
    const saved=await chrome.storage.local.get(['config','session']);config=saved.config||{};session=saved.session||null;
    $('url').value=config.url||'';$('key').value=config.key||'';
    showSession();
    if(session){await authorized('/auth/v1/user');await loadProjects();status('Ready to capture.')}
  }catch(error){session=null;await chrome.storage.local.remove('session');showSession();status('Session expired or connection unavailable: '+error.message)}
})();
