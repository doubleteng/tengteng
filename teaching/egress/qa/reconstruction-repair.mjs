import {compileRecognition,mergeDetail} from './recognition-pipeline.mjs?v=topology-rebuild-2';
import {openingHost} from './import-quality.mjs?v=topology-rebuild-2';
import {area,insideRoom,dist,roomPoint,segDist,edges} from './geometry.mjs?v=topology-rebuild-2';

const sourcePoint=(p,image)=>{
 const dx=p.x-(image.x||0),dy=p.y-(image.y||0),c=Math.cos(image.rotation||0),s=Math.sin(image.rotation||0);
 return [(c*dx+s*dy)/image.width*1000,(1-(-s*dx+c*dy)/image.height)*1000];
};

export function reconstructionQuality(result,image){
 const compiled=compileRecognition(result,image),model=compiled.model;
 const unhosted=(model.candidates||[]).filter(c=>!c.windowConflict&&openingHost(model.walls,c.points).error);
 const unopened=model.rooms.filter(r=>r.seedIds?.length&&!model.candidates.some(c=>!c.windowConflict&&c.points.some(p=>edges(r.points).some(([a,b])=>segDist(p,a,b)<.3)))&&!model.doors.some(d=>edges(r.points).some(([a,b])=>segDist(d,a,b)<.3)));
 const slivers=model.rooms.filter(r=>{
  if(r.seedIds?.length)return false;
  const a=area(r.points),perimeter=r.points.reduce((n,p,i)=>n+dist(p,r.points[(i+1)%r.points.length]),0);
  return perimeter>0&&4*Math.PI*a/(perimeter*perimeter)<.055;
 });
 const covered=model.spaceSeeds.filter(s=>model.rooms.some(r=>insideRoom(s.point,r))).map(s=>s.point);
 const score=compiled.pending.length*12+compiled.unmatchedWalls.length*5+unhosted.length*2+slivers.length*8+unopened.length*2;
 return {compiled,model,unhosted,unopened,slivers,covered,score,complete:compiled.complete&&unhosted.length===0&&slivers.length===0&&unopened.length===0};
}

// Read complete neighborhoods around actual graph failures. Crop ownership
// still belongs to the core; the larger image carries adjacent jambs and rooms.
export function reconstructionTargets(result,image,{limit=8}={}){
 const quality=reconstructionQuality(result,image),targets=[];
 const point=p=>({x:p[0],y:p[1]});
 const boundaries=result.elements.filter(e=>['wall','door','entrance'].includes(e.kind)).flatMap(e=>e.points.slice(1).map((b,i)=>[point(e.points[i]),point(b)]));
 const add=(point,width,height,priority,focus='architecture')=>{
  const cx=Math.max(0,Math.min(1000,point[0])),cy=Math.max(0,Math.min(1000,point[1]));
  width=Math.max(150,Math.min(520,width));height=Math.max(150,Math.min(520,height));
  const left=Math.max(0,cx-width/2),top=Math.max(0,cy-height/2),right=Math.min(1000,cx+width/2),bottom=Math.min(1000,cy+height/2);
  const duplicate=targets.find(t=>Math.hypot((t.cx-cx)/Math.min(t.width,width),(t.cy-cy)/Math.min(t.height,height))<.45);
  if(duplicate){duplicate.priority+=priority;if(focus==='architecture')duplicate.focus=focus;return;}
  const marginX=(right-left)*.16,marginY=(bottom-top)*.16,x=Math.max(0,left-marginX),y=Math.max(0,top-marginY);
  targets.push({cx,cy,priority,focus,width:Math.min(1000,right+marginX)-x,height:Math.min(1000,bottom+marginY)-y,x,y,core:{left,top,right,bottom},spaceIds:[]});
 };
 for(const seed of quality.compiled.pending){
  const source=result.elements.find(e=>e.id===seed.recognition?.sourceId),ps=source?.points||[];
  if(ps.length){
   const xs=ps.map(p=>p[0]),ys=ps.map(p=>p[1]),width=Math.max(...xs)-Math.min(...xs),height=Math.max(...ys)-Math.min(...ys);
   if(width>440||height>440){
    // A crop at the centroid of a hall cannot see its missing perimeter.
    // Read the actual unsupported boundary neighborhoods first.
    for(let i=0;i<ps.length;i++){
     const a=ps[i],b=ps[(i+1)%ps.length],length=Math.hypot(b[0]-a[0],b[1]-a[1]),count=Math.max(1,Math.ceil(length/220));
     for(let j=0;j<count;j++){const t=(j+.5)/count,p=[a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t];if(!boundaries.some(([u,v])=>segDist(point(p),u,v)<8))add(p,280,280,5);}
    }
    add([(Math.max(...xs)+Math.min(...xs))/2,(Math.max(...ys)+Math.min(...ys))/2],width+80,height+80,1);
   }else add([(Math.max(...xs)+Math.min(...xs))/2,(Math.max(...ys)+Math.min(...ys))/2],width+80,height+80,4);
  }else add(sourcePoint(seed.point,image),220,220,4);
 }
 for(const c of quality.unhosted){const p=sourcePoint({x:(c.points[0].x+c.points[1].x)/2,y:(c.points[0].y+c.points[1].y)/2},image);add(p,220,220,2);}
 for(const w of quality.compiled.unmatchedWalls)add(sourcePoint({x:(w.a.x+w.b.x)/2,y:(w.a.y+w.b.y)/2},image),220,220,4);
 for(const r of quality.unopened){const ps=r.points.map(p=>sourcePoint(p,image)),xs=ps.map(p=>p[0]),ys=ps.map(p=>p[1]);add(sourcePoint(roomPoint(r),image),Math.max(...xs)-Math.min(...xs)+90,Math.max(...ys)-Math.min(...ys)+90,2,'openings');}
 for(const r of quality.slivers)add(sourcePoint(roomPoint(r),image),180,180,1);
 return targets.sort((a,b)=>b.priority-a.priority).slice(0,limit).map((t,i)=>({...t,id:'repair-'+i}));
}

export function improvesReconstruction(before,after){
 if(after.compiled.unmatchedWalls.length>before.compiled.unmatchedWalls.length)return false;
 // A new response cannot earn a lower failure count by erasing a previously
 // enclosed space or degrading its connectivity.
 if(before.covered.some(point=>!after.model.rooms.some(r=>insideRoom(point,r))))return false;
 if(after.slivers.length>before.slivers.length)return false;
 return after.score<before.score;
}

// The caller owns persistence and cancellation. Rejected responses never
// replace the best saved model, and a provider failure never destroys progress.
export async function repairReconstruction(run,{image,read,fit,onProgress=()=>{},cancelled=()=>false,maxCalls=12}){
 let fitted=await fit(run.result),quality=reconstructionQuality(fitted,image);
 const ledger=run.repairs??=[],attempted=new Set();let calls=0;
 if(run.regions?.some(r=>r.state!=='read'))return {result:fitted,quality,incompleteCoverage:true};
 for(let round=0;round<3&&!quality.complete&&calls<maxCalls;round++){
  const targets=reconstructionTargets(fitted,image,{limit:8});let accepted=0;
  for(const target of targets){
   if(cancelled()||calls>=maxCalls)return {result:fitted,quality,cancelled:cancelled()};
   const key=target.focus+':'+[target.x,target.y,target.width,target.height].map(n=>Math.round(n/5)*5).join(':');
   if(attempted.has(key))continue;attempted.add(key);
   const region={...target,id:'repair-'+ledger.length},entry={key,region,state:'reading'};ledger.push(entry);calls++;
   await onProgress({run,entry,calls,quality});
   try{
    const detail=await read(region);entry.detail=detail;if(cancelled()){entry.state='cancelled';return {result:fitted,quality,cancelled:true};}
    const candidate=mergeDetail(run.result,detail,region).result;
    const proposed=await fit(candidate);if(cancelled()){entry.state='cancelled';return {result:fitted,quality,cancelled:true};}
    const next=reconstructionQuality(proposed,image);
    entry.before=quality.score;entry.after=next.score;
    if(improvesReconstruction(quality,next)){run.result=candidate;fitted=proposed;quality=next;entry.state='accepted';accepted++;}
    else entry.state='rejected';
   }catch(error){
    entry.state='failed';entry.error=String(error.message||error).slice(0,220);
    if(/quota|allowance|access|session|429|busy|connect/i.test(entry.error)){await onProgress({run,entry,calls,quality});return {result:fitted,quality,error:entry.error};}
   }
   await onProgress({run,entry,calls,quality});
   if(quality.complete)break;
  }
  if(!accepted)break;
 }
 return {result:fitted,quality};
}
