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
export default function PdfJsPreview({paper,supabase,page,onPageChange,onClose,pageSize,highlights=[],sourceFocus,onHighlightClick}){
  const canvas=useRef(null),textLayer=useRef(null),documentRef=useRef(null);
  const [status,setStatus]=useState('Loading original PDF…'),[count,setCount]=useState(0);
  const [zoom,setZoom]=useState(1.5);
  const [rotation,setRotation]=useState(0);
  const [renderedPage,setRenderedPage]=useState(null);
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
    setRenderedPage(null);
    (async()=>{
      try{
        const pdfPage=await doc.getPage(page);
        if(cancelled)return;
        const viewport=pdfPage.getViewport({scale:zoom});
        setRotation(pdfPage.rotate||0);
        const surface=canvas.current;
        const context=surface.getContext('2d');
        const ratio=Math.min(window.devicePixelRatio||1,2.5);
        surface.width=Math.ceil(viewport.width*ratio);surface.height=Math.ceil(viewport.height*ratio);
        surface.style.width=viewport.width+'px';surface.style.height=viewport.height+'px';
        const layer=textLayer.current;layer.replaceChildren();
        layer.style.width=viewport.width+'px';layer.style.height=viewport.height+'px';
        layer.style.setProperty('--scale-factor',String(viewport.scale));
        renderTask=pdfPage.render({canvasContext:context,viewport,transform:[ratio,0,0,ratio,0,0]});
        await renderTask.promise;
        const content=await pdfPage.getTextContent();
        if(cancelled)return;
        // Use PDF.js' own TextLayer for accurate text selection and glyph metrics.
        // Hand-positioning spans does not correctly handle rotation or embedded fonts.
        const lib=await loadPdfjs();
        const textTask=new lib.TextLayer({
          textContentSource:content,
          container:layer,
          viewport,
        });
        await textTask.render();
        if(cancelled)layer.replaceChildren();
        else setRenderedPage(page);
      }catch(error){if(!cancelled&&error?.name!=='RenderingCancelledException')setStatus('Page rendering failed: '+error.message)}
    })();
    return()=>{cancelled=true;renderTask?.cancel();textLayer.current?.replaceChildren()};
  },[page,count,zoom]);
  // PyMuPDF rectangles use top-left page coordinates. For unrotated pages,
  // normalized coordinates are invariant under PDF.js zoom and HiDPI rendering.
  // Rotated/cropped PDFs need explicit viewport transforms before overlay release.
  const canOverlay=rotation===0 && pageSize?.width>0 && pageSize?.height>0 && renderedPage===page;
  const rectStyle=rect=>{
    if(!Array.isArray(rect)||rect.length!==4||!rect.every(Number.isFinite))return null;
    const [x0,y0,x1,y1]=rect;
    if(x1<=x0||y1<=y0)return null;
    return {left:(x0/pageSize.width*100)+'%',top:(y0/pageSize.height*100)+'%',
      width:((x1-x0)/pageSize.width*100)+'%',height:((y1-y0)/pageSize.height*100)+'%'};
  };
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
    {rotation!==0&&<p role="status">Highlight overlays are disabled for rotated pages until coordinate transforms are verified.</p>}
    <div className="pdfjs-scroll"><div className="pdfjs-page"><canvas ref={canvas}/><div ref={textLayer} className="pdfjs-text-layer textLayer"/>
      {canOverlay&&<div className="pdfjs-highlight-layer">
        {highlights.flatMap((highlight,index)=>(highlight.rects||[]).map((rect,rectIndex)=>{
          const style=rectStyle(rect);
          return style?<button type="button" key={'highlight-'+index+'-'+rectIndex}
            className="pdfjs-highlight-rect" style={{...style,background:highlight.color||'#a783e855'}}
            title={highlight.theme||'AI highlight'} aria-label={'View '+(highlight.theme||'highlight')}
            onClick={()=>onHighlightClick?.(highlight)}/>:null;
        }))}
        {sourceFocus?.page===page&&(sourceFocus.rects||[]).map((rect,index)=>{
          const style=rectStyle(rect);
          return style?<div key={'source-'+index} className="pdfjs-source-rect" style={style}/>:null;
        })}
      </div>}</div></div>
  </section>;
}
