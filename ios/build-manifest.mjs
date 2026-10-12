// Small exact allowlist for the static overlay; generated manifest is not public.
import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
const paths = ['ios/index.html','ios/collect-core.mjs','ios/collect-page.mjs','ios/ResearchOS-Collect.shortcut','ios/Dockerfile','ios/deploy-fdu.py'];
const files = paths.map(path=>{const data=readFileSync(path);return {path,size_bytes:data.length,sha256:createHash('sha256').update(data).digest('hex')};});
writeFileSync('ios/release-manifest.json',JSON.stringify({release:'iphone-auto-20261012-v2',files},null,2)+'\n');
console.log(JSON.stringify({files:files.map(f=>({path:f.path,size_bytes:f.size_bytes})),total_bytes:files.reduce((sum,f)=>sum+f.size_bytes,0)}));
