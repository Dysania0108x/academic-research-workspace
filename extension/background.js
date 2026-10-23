// Fetch only a user-selected HTTPS PDF from the active tab, without cookies.
chrome.runtime.onMessage.addListener((message,sender,respond)=>{
 if(message?.type!=='FETCH_PUBLIC_PDF')return;
 (async()=>{
  const url=new URL(message.url);
  if(url.protocol!=='https:'||!url.pathname.toLowerCase().endsWith('.pdf')||url.username||url.password)throw Error('Only direct public HTTPS PDFs are supported.');
  const tabs=await chrome.tabs.query({active:true,currentWindow:true});
  if(!tabs.some(t=>t.url===url.href))throw Error('Open this PDF in the active tab before importing.');
  const allowed=await chrome.permissions.contains({origins:[url.origin+'/*']});
  if(!allowed)throw Error('Permission required for the PDF website.');
  const response=await fetch(url.href,{credentials:'omit',redirect:'error',signal:AbortSignal.timeout(30000)});
  if(!response.ok)throw Error('Download failed (HTTP '+response.status+').');
  const len=Number(response.headers.get('content-length')||0);
  if(len>20*1024*1024)throw Error('PDF exceeds 20 MB.');
  const bytes=new Uint8Array(await response.arrayBuffer());
  if(bytes.length>20*1024*1024||String.fromCharCode(...bytes.slice(0,5))!=='%PDF-')throw Error('Not a supported PDF.');
  let binary='';
  for(let i=0;i<bytes.length;i+=8192)binary+=String.fromCharCode(...bytes.subarray(i,i+8192));
  return {ok:true,base64:btoa(binary)};
 })().then(respond).catch(error=>respond({error:error.message}));
 return true;
});
const panelPorts=new Map();
chrome.runtime.onInstalled.addListener(()=>chrome.sidePanel.setPanelBehavior({openPanelOnActionClick:true}).catch(console.error));
chrome.runtime.onStartup.addListener(()=>chrome.sidePanel.setPanelBehavior({openPanelOnActionClick:true}).catch(console.error));
function notify(tabId,open){chrome.tabs.sendMessage(tabId,{type:'PANEL_STATE',open}).catch(()=>{});}
chrome.runtime.onConnect.addListener(port=>{
  if(port.name!=='NUSCOPE_PANEL')return;
  const tabId=port.sender?.tab?.id;
  // Side panel pages have no sender.tab. They report the active tab explicitly.
  port.onMessage.addListener(message=>{
    if(message?.type!=='REGISTER_PANEL'||!Number.isInteger(message.tabId))return;
    const id=message.tabId;
    panelPorts.set(id,port);notify(id,true);
    port.onDisconnect.addListener(()=>{if(panelPorts.get(id)===port){panelPorts.delete(id);notify(id,false);}});
  });
});
chrome.runtime.onMessage.addListener((message,sender,sendResponse)=>{
  const tabId=sender.tab?.id;
  if(message?.type==='GET_PANEL_STATE'){sendResponse({open:!!panelPorts.get(tabId)});return;}
  if(message?.type!=='TOGGLE_PANEL')return;
  if(!tabId){sendResponse({ok:false});return;}
  const existing=panelPorts.get(tabId);
  if(existing){
    try{existing.postMessage({type:'CLOSE_PANEL'});sendResponse({ok:true});}
    catch(error){sendResponse({ok:false,error:error.message});}
  }else{
    chrome.sidePanel.open({tabId}).then(()=>sendResponse({ok:true})).catch(error=>sendResponse({ok:false,error:error.message}));
  }
  return true;
});
