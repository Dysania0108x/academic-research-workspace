const list=document.getElementById('items'),empty=document.getElementById('empty'),count=document.getElementById('count'),status=document.getElementById('status');
async function read(){const {nuscopeCaptures=[]}=await chrome.storage.local.get({nuscopeCaptures:[]});return nuscopeCaptures;}
async function render(){
  const entries=await read();list.replaceChildren();count.textContent=String(entries.length);empty.hidden=entries.length>0;
  for(const item of entries){
    const card=document.createElement('article');card.className='item';
    const title=document.createElement('strong');title.textContent=item.title||'Untitled source';
    const meta=document.createElement('div');meta.className='meta';meta.textContent=new Date(item.capturedAt).toLocaleString();
    const quote=document.createElement('blockquote');quote.textContent=item.quote||'';
    const note=document.createElement('p');note.className='note';note.textContent=item.note||'';
    const link=document.createElement('a');link.textContent='View source ↗';
    if(/^https?:\/\//.test(item.url||'')){link.href=item.url;link.target='_blank';link.rel='noopener noreferrer';}
    const remove=document.createElement('button');remove.className='remove';remove.textContent='Delete';
    remove.addEventListener('click',async()=>{if(!confirm('Delete this saved excerpt?'))return;await chrome.storage.local.set({nuscopeCaptures:(await read()).filter(e=>e.id!==item.id)});render();});
    card.append(title,meta,quote);if(item.note)card.append(note);if(link.href)card.append(link);card.append(document.createElement('br'),remove);list.append(card);
  }
}
document.getElementById('export').addEventListener('click',async()=>{
  const data=JSON.stringify({format:'nuscope-extension-v1',captures:await read()},null,2);
  const url=URL.createObjectURL(new Blob([data],{type:'application/json'}));
  const a=document.createElement('a');a.href=url;a.download='nuscope-captures.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
  status.textContent='Exported your local captures.';
});
document.getElementById('openApp').addEventListener('click',()=>chrome.tabs.create({url:'https://github.com/Dysania0108x/academic-research-workspace'}));
chrome.storage.onChanged.addListener((changes,area)=>{if(area==='local'&&changes.nuscopeCaptures)render();});
render().catch(()=>{status.textContent='Unable to load local captures.';});

const port=chrome.runtime.connect({name:'NUSCOPE_PANEL'});
chrome.tabs.query({active:true,currentWindow:true},tabs=>{
  if(tabs[0]?.id)port.postMessage({type:'REGISTER_PANEL',tabId:tabs[0].id});
});
port.onMessage.addListener(message=>{if(message?.type==='CLOSE_PANEL')window.close();});
