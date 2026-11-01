import {readFile,writeFile,mkdir,readdir} from 'node:fs/promises';
import path from 'node:path';
const root=path.resolve('teaching/egress'),out=path.join(root,'qa');
await mkdir(out,{recursive:true});
const tag='topology-rebuild-5';
for(const name of await readdir(path.join(root,'src'))){
 if(!name.endsWith('.mjs'))continue;
 let contents=await readFile(path.join(root,'src',name),'utf8');
 if(name==='app.mjs')contents=contents.replaceAll("'egress-site-lab'","'egress-recognition-qa'").replaceAll('egress-start-workflow-v1','egress-qa-start-workflow-v1');
 contents=contents.replace(/\.mjs\?v=[a-zA-Z0-9_-]+/g,'.mjs?v='+tag);
 await writeFile(path.join(out,name),contents);
}
let html=await readFile(path.join(root,'index.html'),'utf8');
html=html.replace('./src/app.mjs?v=wall-faces-1','./qa/app.mjs?v='+tag).replace('<title>Egress + Site Lab — Teng Teng</title>','<title>Recognition validation — Egress + Site Lab</title>');
await writeFile(path.join(root,'recognition-qa.html'),html);
