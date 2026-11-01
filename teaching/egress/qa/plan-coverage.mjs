import {strokeMask} from './import-quality.mjs?v=topology-rebuild-4';
// Tile the sheet, not the rooms already found by a first model response.
// Each core owns its geometry; overlapping margins provide reading context.
export function coverageRegions(width,height,{tilePixels=1100,maxAxis=6}={}){
 if(!(width>0&&height>0))throw Error('The source image has no dimensions.');
 const minimum=width*height>500000&&Math.min(width,height)>=600?2:1;
 const nx=Math.min(maxAxis,Math.max(minimum,Math.ceil(width/tilePixels))),ny=Math.min(maxAxis,Math.max(minimum,Math.ceil(height/tilePixels))),out=[];
 for(let y=0;y<ny;y++)for(let x=0;x<nx;x++){
  const core={left:x*1000/nx,top:y*1000/ny,right:(x+1)*1000/nx,bottom:(y+1)*1000/ny},px=140/nx,py=140/ny;
  const left=Math.max(0,core.left-px),top=Math.max(0,core.top-py),right=Math.min(1000,core.right+px),bottom=Math.min(1000,core.bottom+py);
  out.push({id:`tile-${y}-${x}`,x:left,y:top,width:right-left,height:bottom-top,core,spaceIds:[],state:'pending',attempts:0});
 }
 return out;
}

// A reversible rendering adjustment for model input, never a wall detector.
// Keep source pixels unchanged for geometric evidence and the student's underlay.
export function enhancePlanContrast(image){
 const data=new Uint8ClampedArray(image.data);
 for(let i=0;i<data.length;i+=4){const a=data[i+3]/255,g=255*(1-a)+a*(data[i]*.2126+data[i+1]*.7152+data[i+2]*.0722),v=Math.round(Math.max(0,255-(255-g)*3));data[i]=data[i+1]=data[i+2]=v;data[i+3]=255;}
 return {width:image.width,height:image.height,data};
}

// A blank/context-only reply is not accepted as completion when long source
// strokes remain. This triggers another reading; it never creates a wall.
export function hasUnresolvedStructure(detail,image){
 if(detail.elements.some(e=>e.kind==='wall'))return false;
 const {width:w,height:h,mask}=strokeMask(image),minimum=Math.max(28,Math.min(w,h)*.07);let lines=0;
 for(let y=0;y<h;y+=2){let run=0,gap=0;for(let x=0;x<w;x++){if(mask[y*w+x]){run++;gap=0;}else if(++gap>1)run=0;if(run>=minimum){lines++;break;}}}
 for(let x=0;x<w;x+=2){let run=0,gap=0;for(let y=0;y<h;y++){if(mask[y*w+x]){run++;gap=0;}else if(++gap>1)run=0;if(run>=minimum){lines++;break;}}}
 return lines>=3;
}

export const coverageSummary=regions=>({version:1,total:regions.length,read:regions.filter(r=>r.state==='read').length,complete:regions.length>0&&regions.every(r=>r.state==='read'),regions:regions.map(({id,x,y,width,height,state,error})=>({id,x,y,width,height,state,...(error?{error:String(error).slice(0,180)}:{})}))});

function splitRegion(region){
 const c=region.core,wide=c.right-c.left>=c.bottom-c.top,mid=wide?(c.left+c.right)/2:(c.top+c.bottom)/2;
 return [0,1].map(i=>{const core={...c,...(wide?(i?{left:mid}:{right:mid}):(i?{top:mid}:{bottom:mid}))},px=(core.right-core.left)*.14,py=(core.bottom-core.top)*.14,x=Math.max(0,core.left-px),y=Math.max(0,core.top-py),right=Math.min(1000,core.right+px),bottom=Math.min(1000,core.bottom+py);return{id:region.id+'-'+i,x,y,width:right-x,height:bottom-y,core,spaceIds:[],state:'pending',attempts:0,depth:(region.depth||0)+1};});
}

// Checkpoints contain the full accumulated result and per-tile state. A failed
// region never deletes completed work or prevents later regions being read.
export async function readCoverage(run,{read,merge,onProgress=()=>{},cancelled=()=>false}){
 for(let index=0;index<run.regions.length;index++){
  const region=run.regions[index];
  if(region.state==='read')continue;
  for(let attempt=0;attempt<2;attempt++){
   if(cancelled())return run;
   region.state='reading';region.attempts=(region.attempts||0)+1;delete region.error;await onProgress(run,region);
   try{
    const detail=await read(region);if(cancelled()){region.state='pending';return run;}
    const merged=merge(run.result,detail,region);run.result=merged.result;region.state='read';delete region.error;await onProgress(run,region);break;
   }catch(error){
    region.state='failed';region.error=error.message||String(error);await onProgress(run,region);
    if(/quota|allowance|configured|access|session|429|busy|connect/i.test(region.error))return run;
   }
  }
  if(region.state==='failed'&&/truncated|no architectural walls/i.test(region.error)&&(region.depth||0)<2&&run.regions.length<64){run.regions.splice(index,1,...splitRegion(region));index--;await onProgress(run,region);}
 }
 return run;
}
