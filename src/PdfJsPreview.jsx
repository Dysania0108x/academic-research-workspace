import React,{useEffect,useRef,useState} from 'react';

// Experimental reader kept separate from the existing evidence-coordinate reader.
// PDF.js 4.10.38 is pinned; production bundling will replace the CDN dependency.
const LIB='https://cdn.jsdelivr.net/npm/pdfjs-dist@4.10.38/build/pdf.mjs';
const WORKER='https://cdn.jsdelivr.net/npm/pdfjs-dist@4.10.38/build/pdf.worker.mjs';
let loader;
function loadPdfjs(){
  if(!loader)loader=import(/* @vite-ignore */ LIB).then(lib=>{lib.GlobalWorkerOptions.workerSrc=WORKER;return lib});
  return loader;
}
export default function PdfJsPreview({paper,supabase,page,onPageChange,onClose}){
  const canvas=useRef(null),textLayer=useRef(null),documentRef=useRef(null);
  const [status,setStatus]=useState('Loading original PDF…'),[count,setCount]=useState(0);
  const [zoom,setZoom]=useState(1.25);
  useEffect(()=>{
    let active=true,task;
    (async()=>{
      try{
        if(!paper?.storagePath)throw Error('This paper has no cloud PDF');
        const {data,error}=await supabase.storage.from('research-pdfs').download(paper.storagePath);
        if(error)throw error;
        const bytes=new Uint8Array(await data.arrayBuffer());
        const lib=await loadPdfjs();
        task=lib.getDocument({data:bytes});
        const doc=await task.promise;
        if(!active){await doc.destroy();return}
        documentRef.current=doc;setCount(doc.numPages);setStatus('');
      }catch(error){if(active)setStatus('Reader unavailable: '+error.message)}
    })();
    return()=>{active=false;const doc=documentRef.current;documentRef.current=null;if(doc)doc.destroy().catch(()=>{});else task?.destroy?.()};
  },[paper?.storagePath,supabase]);
  useEffect(()=>{
    const doc=documentRef.current;
    if(!doc||!canvas.current||!textLayer.current||page<1||page>count)return;
    let cancelled=false,renderTask;
    (async()=>{
      try{
        const pdfPage=await doc.getPage(page);
        if(cancelled)return;
        const viewport=pdfPage.getViewport({scale:zoom});
        const surface=canvas.current;
        const context=surface.getContext('2d');
        const ratio=Math.min(window.devicePixelRatio||1,2);
        surface.width=Math.ceil(viewport.width*ratio);surface.height=Math.ceil(viewport.height*ratio);
        surface.style.width=viewport.width+'px';surface.style.height=viewport.height+'px';
        const layer=textLayer.current;layer.replaceChildren();
        layer.style.width=viewport.width+'px';layer.style.height=viewport.height+'px';
        renderTask=pdfPage.render({canvasContext:context,viewport,transform:[ratio,0,0,ratio,0,0]});
        await renderTask.promise;
        const content=await pdfPage.getTextContent();
        if(cancelled)return;
        for(const item of content.items){
          if(!item.str)continue;
          const transform=viewport.transform;
          const t=[transform[0]*item.transform[0]+transform[2]*item.transform[1],
                   transform[1]*item.transform[0]+transform[3]*item.transform[1],
                   transform[0]*item.transform[2]+transform[2]*item.transform[3],
                   transform[1]*item.transform[2]+transform[3]*item.transform[3],
                   transform[0]*item.transform[4]+transform[2]*item.transform[5]+transform[4],
                   transform[1]*item.transform[4]+transform[3]*item.transform[5]+transform[5]];
          const fontSize=Math.hypot(t[2],t[3]);
          const span=document.createElement('span');
          span.textContent=item.str;
          span.style.cssText='position:absolute;white-space:pre;transform-origin:0 0;color:transparent;user-select:text;pointer-events:auto;';
          span.style.left=t[4]+'px';span.style.top=(t[5]-fontSize)+'px';
          span.style.fontSize=fontSize+'px';
          span.style.fontFamily='sans-serif';
          layer.append(span);
          const actual=span.getBoundingClientRect().width;
          if(actual>0&&item.width>0)span.style.transform='scaleX('+(item.width*zoom/actual)+')';
        }
      }catch(error){if(!cancelled&&error?.name!=='RenderingCancelledException')setStatus('Page rendering failed: '+error.message)}
    })();
    return()=>{cancelled=true;renderTask?.cancel();textLayer.current?.replaceChildren()};
  },[page,count,zoom]);
  return <section className="pdfjs-preview">
    <div className="pdfjs-toolbar">
      <strong>PDF.js Reader (Preview)</strong>
      <button onClick={()=>onPageChange(Math.max(1,page-1))} disabled={page<=1}>Previous</button>
      <span>{page} / {count||'…'}</span>
      <button onClick={()=>onPageChange(Math.min(count,page+1))} disabled={page>=count}>Next</button>
      <button onClick={()=>setZoom(z=>Math.max(.7,z-.2))}>−</button>
      <button onClick={()=>setZoom(z=>Math.min(2.5,z+.2))}>+</button>
      <button onClick={onClose}>Old Reader</button>
    </div>
    {status&&<p role="status">{status}</p>}
    <div className="pdfjs-scroll"><div className="pdfjs-page"><canvas ref={canvas}/><div ref={textLayer} className="pdfjs-text-layer"/></div></div>
  </section>;
}
