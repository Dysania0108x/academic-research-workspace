// Must match src/main.jsx themePalette and themeColor ordering.
export const THEME_PALETTE=['#E8B844','#67A7E8','#A783E8','#47B99A','#E48C98','#7D89D9'];
export function themeColor(themes,name){
 const names=[...new Set([...(themes||[]),name].filter(Boolean))].sort((a,b)=>a.localeCompare(b));
 return THEME_PALETTE[names.indexOf(name)%THEME_PALETTE.length];
}
export function themeChipStyle(themes,name){
 const color=themeColor(themes,name);
 return {backgroundColor:color+'2b',borderColor:color,color:'#073b73'};
}
