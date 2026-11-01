import {strokeMask} from './import-quality.mjs?v=recognition-speed-2';
import {inside,segDist} from './geometry.mjs?v=recognition-speed-2';
import {ReadAhead,serviceUnavailable,smallerRegionNeeded,busyService,serialProgress} from './recognition-scheduling.mjs?v=recognition-speed-2';
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

// Long source components outside everything the response actually described
// trigger a smaller reread. One returned wall cannot certify an entire tile.
// This is a coverage alarm, never a classifier or a source of new walls.
export function hasUnresolvedStructure(detail,image){
 const {width:w,height:h,mask}=strokeMask(image),minimum=Math.max(28,Math.min(w,h)*.10),cell=8,cols=Math.ceil(w/cell),rows=Math.ceil(h/cell),known=new Uint8Array(cols*rows);
 const hasWalls=detail.elements.some(e=>e.kind==='wall'),lines=[],polygons=[];
 for(const e of detail.elements){
  const ps=e.points.map(([x,y])=>({x:x*w/1000,y:y*h/1000}));
  if(['wall','window','door','entrance','toilet-partition','toilet-door'].includes(e.kind))ps.slice(1).forEach((p,i)=>lines.push([ps[i],p]));
  else if(ps.length>=3&&(hasWalls||!['room','corridor','lobby'].includes(e.kind)))polygons.push(ps);
 }
 const tolerance=Math.max(cell*1.5,Math.max(w,h)*.012);
 for(let y=0;y<rows;y++)for(let x=0;x<cols;x++){
  const p={x:(x+.5)*cell,y:(y+.5)*cell};
  known[y*cols+x]=polygons.some(poly=>inside(p,poly))||lines.some(([a,b])=>segDist(p,a,b)<tolerance)?1:0;
 }
 const unseen=new Uint8Array(w*h);for(let y=0;y<h;y++)for(let x=0;x<w;x++)if(mask[y*w+x]&&!known[Math.floor(y/cell)*cols+Math.floor(x/cell)])unseen[y*w+x]=1;
 const queue=new Int32Array(w*h);
 for(let start=0;start<unseen.length;start++){
  if(!unseen[start])continue;let head=0,tail=1,minX=w,minY=h,maxX=0,maxY=0;queue[0]=start;unseen[start]=0;
  while(head<tail){const index=queue[head++],x=index%w,y=Math.floor(index/w);minX=Math.min(minX,x);maxX=Math.max(maxX,x);minY=Math.min(minY,y);maxY=Math.max(maxY,y);
   for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){if(!dx&&!dy||x+dx<0||x+dx>=w||y+dy<0||y+dy>=h)continue;const next=index+dy*w+dx;if(unseen[next]){unseen[next]=0;queue[tail++]=next;}}
  }
  if(tail>=minimum&&Math.hypot(maxX-minX,maxY-minY)>=minimum&&maxX>3&&maxY>3&&minX<w-4&&minY<h-4)return true;
 }
 return false;
}

export const coverageSummary=regions=>({version:1,total:regions.length,read:regions.filter(r=>r.state==='read').length,complete:regions.length>0&&regions.every(r=>r.state==='read'),regions:regions.map(({id,x,y,width,height,state,error})=>({id,x,y,width,height,state,...(error?{error:String(error).slice(0,180)}:{})}))});

function splitRegion(region){
 const c=region.core,wide=c.right-c.left>=c.bottom-c.top,mid=wide?(c.left+c.right)/2:(c.top+c.bottom)/2;
 return [0,1].map(i=>{const core={...c,...(wide?(i?{left:mid}:{right:mid}):(i?{top:mid}:{bottom:mid}))},px=(core.right-core.left)*.14,py=(core.bottom-core.top)*.14,x=Math.max(0,core.left-px),y=Math.max(0,core.top-py),right=Math.min(1000,core.right+px),bottom=Math.min(1000,core.bottom+py);return{id:region.id+'-'+i,x,y,width:right-x,height:bottom-y,core,spaceIds:[],state:'pending',attempts:0,depth:(region.depth||0)+1};});
}

// Checkpoints contain the full accumulated result and per-tile state. A failed
// region never deletes completed work or prevents later regions being read.
export async function readCoverage(run,{read,merge,onProgress=()=>{},cancelled=()=>false,concurrency=1}){
 const progress=serialProgress(onProgress);
 const request=async region=>{
  if(region.response)return region.response;
  for(let attempt=0;attempt<2;attempt++){
   if(cancelled())return null;
   region.state='reading';region.attempts=(region.attempts||0)+1;delete region.error;await progress(run,region);
   const started=Date.now();
   try{const detail=await read(region);region.durationMs=(region.durationMs||0)+Date.now()-started;region.response=detail;await progress(run,region);return detail;}
   catch(error){
    region.durationMs=(region.durationMs||0)+Date.now()-started;region.state='failed';region.error=error.message||String(error);await progress(run,region);
    if(attempt===1||serviceUnavailable(error)||smallerRegionNeeded(error))throw error;
   }
  }
 };
 const pool=new ReadAhead(request,{concurrency,cancelled});
 try{
  for(let index=0;index<run.regions.length;index++){
   const region=run.regions[index];if(region.state==='read')continue;if(cancelled())break;
   pool.prime(run.regions.slice(index).filter(r=>r.state!=='read'));
   let reply=await pool.take(region);if(!reply)break;
   // If only one shared slot is available, finish admitted work and fall back
   // to serial reads once; never increase the instructor's service limits.
   if(busyService(reply.error)&&pool.limit>1&&!cancelled()){
    pool.limit=1;await pool.settle();try{reply={value:await request(region)};pool.paused=false;}catch(error){reply={error};}
   }
   if(cancelled())break;
   if(reply.error){
    if(serviceUnavailable(reply.error))break;
    if(smallerRegionNeeded(reply.error)&&(region.depth||0)<2&&run.regions.length<64){run.regions.splice(index,1,...splitRegion(region));index--;await progress(run,region);}
    continue;
   }
   if(!reply.value)break;
   run.result=merge(run.result,reply.value,region).result;region.state='read';delete region.response;delete region.error;await progress(run,region);
  }
 }finally{
  await pool.close();
  for(const region of run.regions)if(region.state==='reading')region.state='pending';
  await progress(run,null);
 }
 return run;
}
