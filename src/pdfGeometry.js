/** Map unrotated PyMuPDF top-left rectangles onto an uncropped PDF.js page. */
export function mapPdfRect(rect, sourceSize, renderedSize) {
  if (!Array.isArray(rect) || rect.length !== 4 || !rect.every(Number.isFinite)) return null;
  if (!sourceSize || !renderedSize || ![sourceSize.width,sourceSize.height,renderedSize.width,renderedSize.height].every(v=>Number.isFinite(v)&&v>0)) return null;
  const [x0,y0,x1,y1]=rect;
  if(x0<0||y0<0||x1<=x0||y1<=y0||x1>sourceSize.width+0.5||y1>sourceSize.height+0.5)return null;
  // PDF.js page dimensions must agree with PyMuPDF, otherwise crops/rotations
  // can make a superficially plausible percentage highlight point to wrong text.
  const a=sourceSize.width/sourceSize.height,b=renderedSize.width/renderedSize.height;
  if(Math.abs(a-b)>0.002)return null;
  return {left:(100*x0/sourceSize.width)+'%',top:(100*y0/sourceSize.height)+'%',
    width:(100*(x1-x0)/sourceSize.width)+'%',height:(100*(y1-y0)/sourceSize.height)+'%'};
}
