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
