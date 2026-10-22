(() => {
  if (window.__nuscopeAssistantLoaded) return;
  window.__nuscopeAssistantLoaded = true;
  const host = document.createElement('div');
  host.id = 'nuscope-extension-root';
  const shadow = host.attachShadow({mode:'closed'});
  const style = document.createElement('style');
  style.textContent = `
    :host{all:initial}*{box-sizing:border-box}
    .launcher{position:fixed;right:20px;bottom:24px;z-index:2147483647;border:1px solid #f7f0e3;background:#073b73;color:#fff;border-radius:999px;width:54px;height:54px;box-shadow:0 7px 24px #071d3b55;cursor:pointer;font:700 22px system-ui}
    .launcher:hover{background:#0d5596}
    .mini{position:fixed;right:20px;bottom:88px;width:min(340px,calc(100vw - 40px));z-index:2147483647;background:#fffdf8;color:#183858;border:1px solid #e3dfd5;border-radius:18px;box-shadow:0 14px 50px #071d3b40;padding:18px;font:14px/1.45 system-ui}
    .hidden{display:none}.top{display:flex;justify-content:space-between;align-items:center;margin-bottom:12px}.top strong{font-size:17px}
    button{cursor:pointer}.close{border:0;background:transparent;color:#183858;font-size:21px}
    .selection{background:#f2f0ea;padding:10px;border-radius:9px;max-height:115px;overflow:auto;overflow-wrap:anywhere;margin-bottom:10px}
    textarea{width:100%;height:70px;resize:vertical;border:1px solid #d1d7dd;border-radius:8px;padding:9px;font:inherit}
    .actions{display:flex;gap:8px;margin-top:10px}.primary{flex:1;background:#ef7c00;color:#092f58;border:0;border-radius:30px;padding:10px;font-weight:700}.secondary{background:transparent;border:1px solid #b8c7d3;border-radius:30px;padding:10px;color:#073b73}
    .hint{font-size:12px;color:#66798a;margin-top:8px}
  `;
  const launcher=document.createElement('button');
  launcher.className='launcher';launcher.textContent='N';launcher.title='NUScope Assistant';launcher.setAttribute('aria-label','Open NUScope assistant');
  const mini=document.createElement('section');mini.className='mini hidden';
  mini.innerHTML='<div class="top"><strong>NUScope Assistant</strong><button class="close" aria-label="Close">×</button></div><div class="selection"></div><textarea placeholder="Add a research note (optional)" aria-label="Research note"></textarea><div class="actions"><button class="primary">Save excerpt</button><button class="secondary">Full panel ↗</button></div><div class="hint" role="status">Select text on the page, then open NUScope.</div>';
  const quote=mini.querySelector('.selection'),note=mini.querySelector('textarea'),status=mini.querySelector('.hint');
  let selected='';
  function capture(){const s=window.getSelection();const value=s?.toString().trim()||'';if(value)selected=value.slice(0,10000);}
  document.addEventListener('selectionchange',capture);
  function refresh(){quote.textContent=selected||'No text selected. Select a passage to capture it.';}
  launcher.addEventListener('click',()=>{capture();refresh();mini.classList.toggle('hidden');});
  mini.querySelector('.close').addEventListener('click',()=>mini.classList.add('hidden'));
  mini.querySelector('.secondary').addEventListener('click',()=>chrome.runtime.sendMessage({type:'OPEN_PANEL'},response=>{if(chrome.runtime.lastError||!response?.ok)status.textContent='Open NUScope using the extension toolbar icon.';}));
  mini.querySelector('.primary').addEventListener('click',async()=>{
    if(!selected){status.textContent='Select some text first.';return;}
    const entry={id:crypto.randomUUID(),quote:selected,note:note.value.trim(),title:document.title||location.hostname,url:location.href,capturedAt:new Date().toISOString()};
    try{
      const data=await chrome.storage.local.get({nuscopeCaptures:[]});
      await chrome.storage.local.set({nuscopeCaptures:[entry,...data.nuscopeCaptures].slice(0,500)});
      status.textContent='Saved locally. Open the full panel to review.';note.value='';
    }catch{status.textContent='Could not save. Please try again.';}
  });
  shadow.append(style,launcher,mini);
  (document.body||document.documentElement).appendChild(host);
})();
