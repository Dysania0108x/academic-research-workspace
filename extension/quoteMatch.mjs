// Match exact PDF.js text-layer quotations without guessing coordinates.
export function locateQuote(text, quote) {
  const original=String(text||'');
  const needle=String(quote||'').replace(/\s+/g,' ').trim().toLocaleLowerCase();
  if(!needle)return null;
  let normalized='',offsets=[],space=false;
  for(let i=0;i<original.length;i++){
    const ch=original[i],isSpace=/\s/.test(ch);
    if(isSpace&&space)continue;
    normalized+=isSpace?' ':ch.toLocaleLowerCase();
    offsets.push(i);space=isSpace;
  }
  const start=normalized.indexOf(needle);
  if(start<0)return null;
  return {start:offsets[start],end:offsets[start+needle.length-1]+1};
}
