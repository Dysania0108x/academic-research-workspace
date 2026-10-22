import {writeFileSync} from 'node:fs';
const url=(process.env.VITE_SUPABASE_URL||'').trim().replace(/\/$/,'');
const key=(process.env.VITE_SUPABASE_PUBLISHABLE_KEY||'').trim();
let parsed;
try { parsed=new URL(url); } catch { throw Error('Missing valid VITE_SUPABASE_URL'); }
if(parsed.protocol!=='https:' || !/^[a-z0-9-]+\.supabase\.co$/i.test(parsed.hostname) || parsed.pathname!=='/' || !key || /sb_secret_|service_role/i.test(key)) {
  throw Error('Use only the public NUScope Supabase URL and publishable key.');
}
writeFileSync('extension/config.js','globalThis.NUSCOPE_PUBLIC_CONFIG = '+JSON.stringify({url,key})+';\n');
console.log('Public NUScope extension configuration generated.');
