import {compileRecognition,mergeDetail} from './recognition-pipeline.mjs?v=recognition-speed-2';
import {openingHost} from './import-quality.mjs?v=recognition-speed-2';
import {area,insideRoom,dist,roomPoint,segDist,edges} from './geometry.mjs?v=recognition-speed-2';
import {ReadAhead,serviceUnavailable,busyService,serialProgress} from './recognition-scheduling.mjs?v=recognition-speed-2';

const sourcePoint=(p,image)=>{
 const dx=p.x-(image.x||0),dy=p.y-(image.y||0),c=Math.cos(image.rotation||0),s=Math.sin(image.rotation||0);
 return [(c*dx+s*dy)/image.width*1000,(1-(-s*dx+c*dy)/image.height)*1000];
};

export function reconstructionQuality(result,image){
 const compiled=compileRecognition(result,image),model=compiled.model;
 const unhosted=(model.candidates||[]).filter(c=>!c.windowConflict&&openingHost(model.walls,c.points).error);
 // A semantic doorway merely projected onto a solid wall is not evidence of
 // an opening. Once fitted to pixels, only a located jamb gap can satisfy
 // this check; otherwise a hallucinated door would improve the repair score.
 const located=c=>!result.sourceRefinement||c.recognition?.reviewed||c.openingEvidence?.located===true;
 const unopened=model.rooms.filter(r=>r.seedIds?.length&&!model.candidates.some(c=>located(c)&&!c.windowConflict&&c.points.some(p=>edges(r.points).some(([a,b])=>segDist(p,a,b)<.3)))&&!model.doors.some(d=>edges(r.points).some(([a,b])=>segDist(d,a,b)<.3)));
 const slivers=model.rooms.filter(r=>{
  if(r.seedIds?.length)return false;
  const a=area(r.points),perimeter=r.points.reduce((n,p,i)=>n+dist(p,r.points[(i+1)%r.points.length]),0);
  return perimeter>0&&4*Math.PI*a/(perimeter*perimeter)<.055;
 });
 const covered=model.spaceSeeds.filter(s=>model.rooms.some(r=>insideRoom(s.point,r))).map(s=>s.point);
 const score=compiled.pending.length*12+compiled.pendingFeatures.length*4+compiled.unmatchedWalls.length*5+unhosted.length*2+slivers.length*8+unopened.length*2;
 return {compiled,model,unhosted,unopened,slivers,covered,score,complete:compiled.complete&&unhosted.length===0&&slivers.length===0&&unopened.length===0};
}

// Read complete neighborhoods around actual graph failures. Crop ownership
// still belongs to the core; the larger image carries adjacent jambs and rooms.
export function reconstructionTargets(result,image,{limit=8,quality=reconstructionQuality(result,image)}={}){
 const targets=[];
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
 for(const f of quality.compiled.pendingFeatures){
  const ps=f.points.map(p=>sourcePoint(p,image)),xs=ps.map(p=>p[0]),ys=ps.map(p=>p[1]);
  add([(Math.min(...xs)+Math.max(...xs))/2,(Math.min(...ys)+Math.max(...ys))/2],Math.max(...xs)-Math.min(...xs)+100,Math.max(...ys)-Math.min(...ys)+100,3);
 }
 for(const w of quality.compiled.unmatchedWalls)add(sourcePoint({x:(w.a.x+w.b.x)/2,y:(w.a.y+w.b.y)/2},image),220,220,4);
 for(const r of quality.unopened){
  const ps=r.points.map(p=>sourcePoint(p,image)),xs=ps.map(p=>p[0]),ys=ps.map(p=>p[1]),width=Math.max(...xs)-Math.min(...xs),height=Math.max(...ys)-Math.min(...ys);
  if(width>440||height>440){
   // The center of a large hall does not contain its doors. Inspect every
   // perimeter neighborhood and let the saved ledger continue across batches.
   for(let i=0;i<ps.length;i++){
    const a=ps[i],b=ps[(i+1)%ps.length],count=Math.max(1,Math.ceil(Math.hypot(b[0]-a[0],b[1]-a[1])/240));
    for(let j=0;j<count;j++){const t=(j+.5)/count;add([a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t],280,280,2,'openings');}
   }
  }else add(sourcePoint(roomPoint(r),image),width+90,height+90,2,'openings');
 }
 for(const r of quality.slivers)add(sourcePoint(roomPoint(r),image),180,180,1);
 return targets.sort((a,b)=>b.priority-a.priority).slice(0,limit).map((t,i)=>({...t,id:'repair-'+i}));
}

export function improvesReconstruction(before,after){
 if(after.compiled.unmatchedWalls.length>before.compiled.unmatchedWalls.length)return false;
 // A new response cannot earn a lower failure count by erasing a previously
 // enclosed space or degrading its connectivity.
 if(before.covered.some(point=>!after.model.rooms.some(r=>insideRoom(point,r))))return false;
 // Preserving seed points is not enough: two previously separate rooms can
 // still swallow each other's points after an accidental divider deletion.
 // Reject that merge, and reject newly created cells without a semantic seed.
 const unseeded=q=>q.model.rooms.filter(r=>!r.seedIds?.length).length;
 if(unseeded(after)>unseeded(before))return false;
 const owners=new Map();
 for(let i=0;i<before.model.rooms.length;i++){
  const room=before.model.rooms[i],seeds=before.model.spaceSeeds.filter(s=>insideRoom(s.point,room));
  const witnesses=seeds.length?seeds.map(s=>s.point):[roomPoint(room)];
  for(const point of witnesses){
   const index=after.model.rooms.findIndex(r=>insideRoom(point,r));if(index<0)continue;
   if(owners.has(index)&&owners.get(index)!==i)return false;owners.set(index,i);
  }
 }
 if(after.slivers.length>before.slivers.length)return false;
 return after.score<before.score;
}

// The caller owns persistence and cancellation. Rejected responses never
// replace the best saved model, and a provider failure never destroys progress.
export async function repairReconstruction(run,{image,read,fit,onProgress=()=>{},cancelled=()=>false,maxCalls=12,concurrency=1}){
 let fitted=await fit(run.result),quality=reconstructionQuality(fitted,image);
 const ledger=run.repairs??=[],keyFor=t=>'v2:'+t.focus+':'+[t.x,t.y,t.width,t.height].map(n=>Math.round(n/5)*5).join(':'),attempted=new Set(ledger.filter(e=>['accepted','rejected'].includes(e.state)&&e.key?.startsWith('v2:')).map(e=>e.key));let calls=0;
 const progress=serialProgress(onProgress);
 if(run.regions?.some(r=>r.state!=='read'))return {result:fitted,quality,incompleteCoverage:true};
 for(let round=0;round<3&&!quality.complete&&calls<maxCalls;round++){
  const unique=new Set(attempted),targets=reconstructionTargets(fitted,image,{limit:Infinity,quality}).filter(t=>{const key=keyFor(t);if(unique.has(key))return false;unique.add(key);return true;}).slice(0,Math.min(8,maxCalls-calls));
  if(!targets.length)break;
  const entries=new Map();
  const request=async target=>{
   const key=keyFor(target),saved=ledger.find(e=>e.key===key&&e.detail&&['ready','cancelled'].includes(e.state));
   const entry=saved||{key,region:{...target,id:'repair-'+ledger.length},state:'reading'};entries.set(target,entry);
   if(saved)return saved.detail;
   if(calls>=maxCalls){entry.state='pending';throw Error('Detail request budget reached. Completed details are saved.');}
   ledger.push(entry);calls++;await progress({run,entry,calls,quality});const started=Date.now();
   try{entry.detail=await read(entry.region);entry.state='ready';return entry.detail;}
   catch(error){entry.state='failed';entry.error=String(error.message||error).slice(0,220);throw error;}
   finally{entry.durationMs=Date.now()-started;await progress({run,entry,calls,quality});}
  };
  const pool=new ReadAhead(request,{concurrency,cancelled});
  try{for(let index=0;index<targets.length;index++){
   const target=targets[index];if(cancelled())return {result:fitted,quality,cancelled:true};
   pool.prime(targets.slice(index));let reply=await pool.take(target);if(!reply)break;
   if(busyService(reply.error)&&pool.limit>1&&calls<maxCalls&&!cancelled()){
    pool.limit=1;concurrency=1;await pool.settle();try{reply={value:await request(target)};pool.paused=false;}catch(error){reply={error};}
   }
   const entry=entries.get(target),region=entry.region;
   if(cancelled())return {result:fitted,quality,cancelled:true};
   attempted.add(entry.key);
   try{
    if(reply.error)throw reply.error;
    const detail=reply.value;
    // Opening inventory has no mandate to redraw all partitions in a tile.
    // Try its portals first. Source fitting can recover real short jamb walls
    // from those positions. Only consider the complete returned wall set when
    // that smaller update cannot improve the model, under the same safeguards.
    const portals=detail.elements.filter(e=>['door','entrance','window','toilet-door'].includes(e.kind));
    const variants=region.focus==='openings'&&portals.length&&portals.length<detail.elements.length?[{detail:{...detail,elements:portals},strategy:'openings-only'},{detail,strategy:'with-host-walls'}]:[{detail,strategy:'full-detail'}];
    entry.before=quality.score;entry.state='rejected';entry.proposals=[];
    for(const variant of variants){
     const candidate=mergeDetail(run.result,variant.detail,region).result;
     const proposed=await fit(candidate);if(cancelled()){entry.state='cancelled';return {result:fitted,quality,cancelled:true};}
     const next=reconstructionQuality(proposed,image);entry.after=next.score;entry.proposals.push({strategy:variant.strategy,score:next.score});
     if(improvesReconstruction(quality,next)){run.result=candidate;fitted=proposed;quality=next;entry.state='accepted';entry.strategy=variant.strategy;break;}
    }
   }catch(error){
    entry.state='failed';entry.error=String(error.message||error).slice(0,220);
    if(serviceUnavailable(entry.error)||/request budget/.test(entry.error)){await progress({run,entry,calls,quality});return {result:fitted,quality,error:entry.error};}
   }
   await progress({run,entry,calls,quality});
   if(quality.complete)break;
  }}finally{await pool.close();await progress({run,entry:null,calls,quality});}
 }
 return {result:fitted,quality};
}
