import {rasterLinework} from './pdf-plan.mjs?v=whole-plan-1';
self.onmessage=e=>{try{self.postMessage({ok:true,linework:rasterLinework(e.data)});}catch(error){self.postMessage({ok:false,error:error.message});}};
