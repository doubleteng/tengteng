import {refineSourceWalls} from './source-refinement.mjs?v=recognition-speed-1';
self.onmessage=e=>{try{self.postMessage({ok:true,result:refineSourceWalls(e.data.result,e.data.imageData)});}catch(error){self.postMessage({ok:false,error:error.message});}};
