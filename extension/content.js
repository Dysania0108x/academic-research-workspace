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
    .launcher svg{display:block;width:34px;height:29px;margin:auto;pointer-events:none}
    .mini{position:fixed;left:var(--mx,calc(100vw - 360px));top:var(--my,calc(100vh - 440px));width:min(340px,calc(100vw - 40px));max-height:calc(100vh - 20px);overflow:auto;z-index:2147483647;background:#fffdf8;color:#183858;border:1px solid #e3dfd5;border-radius:18px;box-shadow:0 14px 50px #071d3b40;padding:18px;font:14px/1.45 system-ui}
    .hidden{display:none}.top{display:flex;justify-content:space-between;align-items:center;margin-bottom:12px}.top strong{font-size:17px}
    button{cursor:pointer}.close{border:0;background:transparent;color:#183858;font-size:21px}
    .selection{background:#f2f0ea;padding:10px;border-radius:9px;max-height:115px;overflow:auto;overflow-wrap:anywhere;margin-bottom:10px}
    textarea{width:100%;height:70px;resize:vertical;border:1px solid #d1d7dd;border-radius:8px;padding:9px;font:inherit}
    .actions{display:flex;gap:8px;margin-top:10px}.primary{flex:1;background:#ef7c00;color:#092f58;border:0;border-radius:30px;padding:10px;font-weight:700}.secondary{background:transparent;border:1px solid #b8c7d3;border-radius:30px;padding:10px;color:#073b73}
    .hint{font-size:12px;color:#66798a;margin-top:8px}
  `;
  const launcher=document.createElement('button');
  launcher.className='launcher';launcher.innerHTML="<svg viewBox=\"0 0 240 200\" fill=\"none\" xmlns=\"http://www.w3.org/2000/svg\" aria-hidden=\"true\"><path d=\"M41.7707 80.5024L142.23 22.5024C159.448 12.5614 181.466 18.461 191.407 35.6794L211.407 70.3204C221.348 87.5387 215.448 109.556 198.23 119.497L97.7707 177.497C80.5523 187.438 58.5348 181.539 48.5938 164.32L28.5938 129.679C18.6528 112.461 24.5523 90.4434 41.7707 80.5024ZM54.5027 98.555C46.8496 102.973 44.2278 112.758 48.6463 120.411L66.6463 151.588C71.0648 159.241 80.8496 161.863 88.5027 157.445L185.498 101.445C193.151 97.0262 195.772 87.2414 191.354 79.5883L173.354 48.4114C168.935 40.7583 159.151 38.1365 151.498 42.555L54.5027 98.555Z\" fill-rule=\"evenodd\" clip-rule=\"evenodd\" fill=\"url(#nx0)\"/><path d=\"M33.5938 138.34C42.1918 147.232 52.254 150.66 65.6463 149.857L66.6463 151.589C71.0648 159.242 80.8496 161.863 88.5027 157.445L105.823 147.445C99.1989 163.971 91.4405 176.533 82.1643 182.466C68.772 183.27 55.5938 176.445 48.5938 164.321L33.5938 138.34Z\" fill=\"url(#nx1)\"/><path d=\"M123.178 33.5024L142.23 22.5024C159.449 12.5614 181.466 18.461 191.407 35.6794L206.407 61.6601C196.077 53.7678 185.515 49.4736 174.355 50.1435L173.355 48.4114C168.936 40.7583 159.151 38.1365 151.498 42.555L134.178 52.555C140.704 41.8588 138.802 32.5646 123.178 33.5024Z\" fill=\"url(#nx2)\"/><defs><linearGradient id=\"nx0\" x1=\"35.1104\" y1=\"88.9665\" x2=\"204.756\" y2=\"108.801\" gradientUnits=\"userSpaceOnUse\"><stop stop-color=\"#FF9400\"/><stop offset=\".48\" stop-color=\"#FF7900\"/><stop offset=\"1\" stop-color=\"#F96A00\"/></linearGradient><linearGradient id=\"nx1\" x1=\"45.5937\" y1=\"159.124\" x2=\"109.395\" y2=\"169.631\" gradientUnits=\"userSpaceOnUse\"><stop stop-color=\"#A44300\"/><stop offset=\"1\" stop-color=\"#F97900\"/></linearGradient><linearGradient id=\"nx2\" x1=\"137.9\" y1=\"25.0024\" x2=\"204.273\" y2=\"55.964\" gradientUnits=\"userSpaceOnUse\"><stop stop-color=\"#F98200\"/><stop offset=\".6\" stop-color=\"#C65C00\"/><stop offset=\"1\" stop-color=\"#A94400\"/></linearGradient></defs></svg>";launcher.title='NUScope Assistant';launcher.setAttribute('aria-label','Open NUScope assistant');
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
      status.textContent='Excerpt saved on this device. It has not been synced to a NUScope project.';note.value='';
    }catch{status.textContent='Could not save. Please try again.';}
  });
  shadow.append(style,launcher,mini);
  (document.body||document.documentElement).appendChild(host);
})();
