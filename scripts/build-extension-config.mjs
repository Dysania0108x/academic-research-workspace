import {readFileSync,writeFileSync} from 'node:fs';
const url=(process.env.VITE_SUPABASE_URL||'').trim().replace(/\/$/,'');
const key=(process.env.VITE_SUPABASE_PUBLISHABLE_KEY||'').trim();
let parsed;
try { parsed=new URL(url); } catch { throw Error('Missing valid VITE_SUPABASE_URL'); }
if(parsed.protocol!=='https:' || !/^[a-z0-9-]+\.supabase\.co$/i.test(parsed.hostname) || parsed.pathname!=='/' || !key || /sb_secret_|service_role/i.test(key)) {
  throw Error('Use only the public NUScope Supabase URL and publishable key.');
}
const apiBase=(process.env.VITE_API_BASE_URL||'').trim().replace(/\/$/,'');
let apiOrigin='';
if(apiBase){
 const parsedApi=new URL(apiBase);
 if(parsedApi.protocol!=='https:'||parsedApi.username||parsedApi.password||parsedApi.search||parsedApi.hash)throw Error('VITE_API_BASE_URL must be an HTTPS API URL without credentials or query parameters.');
 apiOrigin=parsedApi.origin;
}
writeFileSync('extension/config.js','globalThis.NUSCOPE_PUBLIC_CONFIG = '+JSON.stringify({url,key,apiBase})+';\\n');
const manifestPath='extension/manifest.json';
const manifest=JSON.parse(readFileSync(manifestPath,'utf8'));
manifest.host_permissions=[url+'/*',...(apiOrigin?[apiOrigin+'/*']:[])];
writeFileSync(manifestPath,JSON.stringify(manifest,null,2)+'\\n');
console.log('Public NUScope extension configuration generated.');
