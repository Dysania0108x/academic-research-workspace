chrome.runtime.onInstalled.addListener(() => {
  chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(console.error);
});
chrome.runtime.onStartup.addListener(() => {
  chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(console.error);
});
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type !== 'OPEN_PANEL') return;
  if (!sender.tab?.id) { sendResponse({ok:false}); return; }
  chrome.sidePanel.open({tabId:sender.tab.id}).then(() => sendResponse({ok:true}))
    .catch(error => sendResponse({ok:false,error:error.message}));
  return true;
});
