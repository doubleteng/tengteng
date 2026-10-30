import {mkdir,copyFile,access} from 'node:fs/promises';
import {build} from 'esbuild';
process.chdir(new URL('.',import.meta.url).pathname);
for(const d of ['vendor/libredwg/dist','vendor/libredwg/wasm','vendor/rhino'])await mkdir(d,{recursive:true});
for(const [a,b] of [
 ['@mlightcad/libredwg-web/dist/libredwg-web.js','libredwg/dist/libredwg-web.js'],
 ['@mlightcad/libredwg-web/wasm/libredwg-web.js','libredwg/wasm/libredwg-web.js'],
 ['@mlightcad/libredwg-web/wasm/libredwg-web.wasm','libredwg/wasm/libredwg-web.wasm'],
 ['rhino3dm/rhino3dm.module.js','rhino/rhino3dm.module.js'],
 ['rhino3dm/rhino3dm.wasm','rhino/rhino3dm.wasm'],
 ['dxf-parser/LICENSE','DXF-LICENSE.txt']])await copyFile('node_modules/'+a,'vendor/'+b);
await build({entryPoints:['node_modules/dxf-parser/src/DxfParser.ts'],bundle:true,format:'esm',platform:'browser',outfile:'vendor/dxf-parser.mjs',minify:true});
for(const f of ['vendor/pdf.min.mjs','vendor/pdf.worker.min.mjs'])await access(f);
console.log('Browser assets ready. The app runs directly from index.html; no server build is required.');
