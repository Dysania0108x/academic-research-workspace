// Explicit import only. Never upload a PDF just because a tab is open.
(() => {
 const $=id=>document.getElementById(id);
 let candidate=null,busy=false;
 const info=$('currentPdfInfo'),button=$('importCurrentPdf');
 const reset=()=>{candidate=null;button.disabled=true;};
 $('detectCurrentPdf').addEventListener('click',async()=>{
  reset();info.textContent='Checking the active tab…';
  try{
   const [tab]=await chrome.tabs.query({active:true,currentWindow:true});
   const url=new URL(tab?.url||'');
   if(url.protocol!=='https:')throw Error('Only public HTTPS PDF URLs are supported.');
   if(url.username||url.password)throw Error('PDF URLs containing credentials are not supported.');
   if(!url.pathname.toLowerCase().endsWith('.pdf'))throw Error('This tab is not a direct .pdf URL. Open the PDF file URL first.');
   if(!globalThis.nuscopeCloud.selectedProject())throw Error('Select a project first.');
   candidate=url.href;
   button.disabled=false;
   info.textContent='Ready: '+url.pathname.split('/').pop()+'. Click Import to save it to the selected project.';
  }catch(error){info.textContent=error.message;}
 });
 button.addEventListener('click',async()=>{
  if(!candidate||busy)return;
  busy=true;button.disabled=true;
  try{
   const url=candidate;
   info.textContent='Downloading public PDF…';
   const response=await fetch(url,{credentials:'omit',redirect:'error',signal:AbortSignal.timeout(30000)});
   if(!response.ok)throw Error('PDF download failed (HTTP '+response.status+').');
   const size=Number(response.headers.get('content-length')||0);
   if(size>20*1024*1024)throw Error('PDF exceeds 20 MB.');
   const type=(response.headers.get('content-type')||'').toLowerCase();
   if(type&&!type.includes('pdf')&&!type.includes('octet-stream'))throw Error('The URL did not return a PDF.');
   const bytes=await response.arrayBuffer();
   if(bytes.byteLength>20*1024*1024||new TextDecoder().decode(bytes.slice(0,5))!=='%PDF-')throw Error('The downloaded file is not a valid PDF header or exceeds 20 MB.');
   info.textContent='Uploading to NUScope Project…';
   const paper=await globalThis.nuscopeCloud.importPublicPdf(bytes,url);
   $('pdfPaper').value=paper.id;
   $('pdfPaper').dispatchEvent(new Event('change'));
   info.textContent='Imported '+(paper.name||paper.title||'PDF')+'. You can now analyse it and review evidence.';
   reset();
  }catch(error){info.textContent='Import failed: '+error.message;}
  finally{busy=false;button.disabled=!candidate;}
 });
})();
