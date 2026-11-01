import {readFile,writeFile,mkdir,readdir} from 'node:fs/promises';
import path from 'node:path';
const root=path.resolve('teaching/egress'),out=path.join(root,'qa');
await mkdir(out,{recursive:true});
const tag='recognition-speed-2';
for(const name of await readdir(path.join(root,'src'))){
 if(!name.endsWith('.mjs'))continue;
 let contents=await readFile(path.join(root,'src',name),'utf8');
 if(name==='app.mjs')contents=contents.replaceAll("'egress-site-lab'","'egress-recognition-qa'").replaceAll('egress-start-workflow-v1','egress-qa-start-workflow-v1');
 contents=contents.replace(/\.mjs\?v=[a-zA-Z0-9_-]+/g,'.mjs?v='+tag);
 contents=contents.replaceAll('./plan-coverage.mjs?v='+tag,'./plan-coverage.mjs?v=recognition-speed-3');
 contents=contents.replaceAll('./recognition-errors.mjs?v='+tag,'./recognition-errors.mjs?v=recognition-error-1');
 await writeFile(path.join(out,name),contents);
}
let html=await readFile(path.join(root,'index.html'),'utf8');
html=html.replace(/\.\/src\/app\.mjs\?v=[a-zA-Z0-9_-]+/g,'./qa/app.mjs?v=recognition-error-1').replace('<title>Egress + Site Lab — Teng Teng</title>','<title>Recognition validation — Egress + Site Lab</title>');
await writeFile(path.join(root,'recognition-qa.html'),html);
