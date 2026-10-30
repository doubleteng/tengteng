import {analyzeAll,summary,probe} from './analysis.mjs?v=rooms-20261030';
let latest;
onmessage=e=>{const m=e.data;try{if(m.type==='analyze'){latest=analyzeAll(m.project);postMessage({type:'result',revision:m.revision,result:summary(latest)});}else if(m.type==='probe'){postMessage({type:'probe',request:m.request,result:probe(latest.raw[m.floor],m.point,m.site)});}}catch(err){postMessage({type:'error',revision:m.revision,error:err.message});}};
