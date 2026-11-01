import {refineSourceWalls} from './source-refinement.mjs?v=recognition-speed-2';
self.onmessage=e=>{try{self.postMessage({ok:true,result:refineSourceWalls(e.data.result,e.data.imageData)});}catch(error){self.postMessage({ok:false,error:error.message});}};
