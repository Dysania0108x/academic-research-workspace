(() => {
  if (window.__nuscopeAssistantLoaded) return;
  window.__nuscopeAssistantLoaded = true;
  const host = document.createElement('div');
  host.id = 'nuscope-extension-root';
  const shadow = host.attachShadow({mode:'closed'});
  const style = document.createElement('style');
  style.textContent = `
    :host{all:initial}*{box-sizing:border-box}
    .launcher{position:fixed;left:var(--nx,calc(100vw - 74px));top:var(--ny,calc(100vh - 78px));touch-action:none;user-select:none;z-index:2147483647;border:1px solid #f7f0e3;background:#073b73;color:#fff;border-radius:999px;width:54px;height:54px;box-shadow:0 7px 24px #071d3b55;cursor:pointer;font:700 22px system-ui}
    .launcher:hover{background:#0d5596}
    .mini{position:fixed;left:var(--mx,calc(100vw - 360px));top:var(--my,calc(100vh - 440px));width:min(340px,calc(100vw - 40px));max-height:calc(100vh - 20px);overflow:auto;z-index:2147483647;background:#fffdf8;color:#183858;border:1px solid #e3dfd5;border-radius:18px;box-shadow:0 14px 50px #071d3b40;padding:18px;font:14px/1.45 system-ui}
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
  let panelOpen=false;
  let position={x:Math.max(8,innerWidth-74),y:Math.max(8,innerHeight-78)};
  const clamp=(n,min,max)=>Math.min(Math.max(n,min),max);
  function place(){
    position.x=clamp(position.x,8,Math.max(8,innerWidth-62));
    position.y=clamp(position.y,8,Math.max(8,innerHeight-62));
    launcher.style.setProperty('--nx',position.x+'px');
    launcher.style.setProperty('--ny',position.y+'px');
    mini.style.setProperty('--mx',clamp(position.x-290,8,Math.max(8,innerWidth-348))+'px');
    mini.style.setProperty('--my',clamp(position.y-355,8,Math.max(8,innerHeight-410))+'px');
  }
  chrome.storage.local.get('nuscopeLauncherPosition').then(({nuscopeLauncherPosition:p})=>{
    if(p&&Number.isFinite(p.x)&&Number.isFinite(p.y)){
      position={x:clamp(p.x,0,1)*Math.max(0,innerWidth-54),y:clamp(p.y,0,1)*Math.max(0,innerHeight-54)};
    }
    place();
  }).catch(()=>place());
  window.addEventListener('resize',place);
  function capture(){
    const value=window.getSelection()?.toString().trim()||'';
    if(value){selected=value.slice(0,10000);refresh();}
  }
  document.addEventListener('selectionchange',capture);
  document.addEventListener('mouseup',capture);
  document.addEventListener('keyup',capture);
  function refresh(){quote.textContent=selected||'No text selected. Select a passage to capture it.';}
  let drag=null,suppressClick=false;
  launcher.addEventListener('pointerdown',event=>{
    if(event.button!==0)return;
    drag={id:event.pointerId,x:event.clientX,y:event.clientY,startX:position.x,startY:position.y,moved:false};
    launcher.setPointerCapture(event.pointerId);
  });
  launcher.addEventListener('pointermove',event=>{
    if(!drag||drag.id!==event.pointerId)return;
    const dx=event.clientX-drag.x,dy=event.clientY-drag.y;
    if(Math.hypot(dx,dy)>5)drag.moved=true;
    if(!drag.moved)return;
    position={x:drag.startX+dx,y:drag.startY+dy};place();
  });
  launcher.addEventListener('pointerup',event=>{
    if(!drag||drag.id!==event.pointerId)return;
    suppressClick=drag.moved;
    drag=null;
    if(suppressClick)chrome.storage.local.set({nuscopeLauncherPosition:{x:position.x/Math.max(1,innerWidth-54),y:position.y/Math.max(1,innerHeight-54)}}).catch(()=>{});
  });
  launcher.addEventListener('pointercancel',()=>{drag=null;});
  launcher.addEventListener('click',()=>{
    if(suppressClick){suppressClick=false;return;}
    if(panelOpen){chrome.runtime.sendMessage({type:'TOGGLE_PANEL'},()=>{});return;}
    capture();refresh();mini.classList.toggle('hidden');
  });
  mini.querySelector('.close').addEventListener('click',()=>mini.classList.add('hidden'));
  mini.querySelector('.secondary').addEventListener('click',()=>{
    mini.classList.add('hidden');
    chrome.runtime.sendMessage({type:'TOGGLE_PANEL'},response=>{
      if(chrome.runtime.lastError||!response?.ok)status.textContent='Open NUScope using the extension toolbar icon.';
    });
  });
  chrome.runtime.onMessage.addListener(message=>{
    if(message?.type==='PANEL_STATE'){panelOpen=!!message.open;if(panelOpen)mini.classList.add('hidden');}
  });
  chrome.runtime.sendMessage({type:'GET_PANEL_STATE'},response=>{if(!chrome.runtime.lastError)panelOpen=!!response?.open;});
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
