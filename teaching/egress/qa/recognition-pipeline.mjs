import {normalizeArchitecturalElements} from './architectural-elements.mjs?v=topology-rebuild-1';
import {materializeInterpretation} from './semantic-plan.mjs?v=wall-faces-1';
import {roomPoint,inside,area,segDist,dist} from './geometry.mjs?v=auto-enclosure-1';
import {sanitaryKinds} from './sanitary-elements.mjs?v=door-detection-1';
import {windowOverlaps} from './door-evidence.mjs?v=auto-enclosure-1';

const spaceKinds=['room','corridor','lobby'];
const midpoint=e=>{const p=roomPoint({points:e.points.map(([x,y])=>({x,y}))});return [p.x,p.y];};

// The review and application both compile this exact wall graph. Semantic
// polygons remain label hints, never an alternative source of usable area.
export function compileRecognition(result,image,{elevation=null}={}){
 const model=materializeInterpretation(result,{...image,calibrated:true},{elevation});
 const expected=normalizeArchitecturalElements(result.elements).filter(e=>spaceKinds.includes(e.kind));
 const pending=model.pendingSpaces||[];
 const unmatchedWalls=model.walls.filter(w=>!w.recognition?.reviewed&&w.recognition?.sourceCheck&&(w.recognition.sourceCheck.coverage<.55||w.recognition.sourceCheck.missingPixels>30));
 const roomBySource=new Map(model.rooms.filter(r=>r.recognition?.sourceId).map(r=>[r.recognition.sourceId,r]));
 return {model,expected:expected.length,pending,unmatchedWalls,roomBySource,complete:result.coverage?.complete!==false&&expected.length>0&&pending.length===0&&unmatchedWalls.length===0&&model.outline.length>=3};
}

function clip(a,b,r){
 let lo=0,hi=1;const dx=b[0]-a[0],dy=b[1]-a[1];
 for(const [p,q] of [[-dx,a[0]-r.left],[dx,r.right-a[0]],[-dy,a[1]-r.top],[dy,r.bottom-a[1]]]){
  if(!p){if(q<0)return null;continue;}const t=q/p;if(p<0)lo=Math.max(lo,t);else hi=Math.min(hi,t);if(lo>hi)return null;
 }return [lo,hi];
}

export function mergeDetail(result,detail,region){
 const core=region.core||{left:region.x,top:region.y,right:region.x+region.width,bottom:region.y+region.height},within=p=>p[0]>=core.left&&p[0]<=core.right&&p[1]>=core.top&&p[1]<=core.bottom;
 const map=p=>[region.x+p[0]/1000*region.width,region.y+p[1]/1000*region.height];
 const lineKinds=['wall','window','door','entrance','toilet-partition','toilet-door'];
 const mapped=[];
 for(const e of detail.elements){
  const object={...e,id:'detail-'+region.id+'-'+e.id,confirmed:false,points:e.points.map(map),...(e.swingPoint?{swingPoint:map(e.swingPoint)}:{})};
  const cropEdge=p=>Math.min(p[0],p[1],1000-p[0],1000-p[1])<8;
  if(['wall','window','toilet-partition'].includes(e.kind)){
   for(let i=1;i<e.points.length;i++){
    const a=e.points[i-1],b=e.points[i];
    // A line along a crop edge is not evidence of a physical enclosure.
    if((Math.abs(a[0]-b[0])<3&&(a[0]<8||a[0]>992))||(Math.abs(a[1]-b[1])<3&&(a[1]<8||a[1]>992)))continue;
    const aa=map(a),bb=map(b),range=clip(aa,bb,core);if(!range)continue;
    const mix=t=>[aa[0]+(bb[0]-aa[0])*t,aa[1]+(bb[1]-aa[1])*t],points=range.map(mix);
    if(Math.hypot(points[1][0]-points[0][0],points[1][1]-points[0][1])<.2)continue;
    mapped.push({...object,id:object.id+'-'+i,points});
   }
  }else if(within(midpoint(object))){
   // A clipped space can supply a name, but its artificial crop edge must
   // never be used as a source-wall search band.
   object.partial=!lineKinds.includes(e.kind)&&e.points.some(cropEdge);mapped.push(object);
  }
 }
 if(!mapped.length)return {result,accepted:false};
 const point=([x,y])=>({x,y}),segments=e=>e.points.slice(1).map((b,i)=>[point(e.points[i]),point(b)]);
 const nearby=(a,b,tol=4)=>{
  const [p,q]=a,[u,v]=b,la=dist(p,q),lb=dist(u,v);if(!la||!lb)return false;
  return Math.abs((q.x-p.x)*(v.y-u.y)-(q.y-p.y)*(v.x-u.x))/(la*lb)<.06&&Math.min(segDist(p,u,v),segDist(q,u,v),segDist(u,p,q),segDist(v,p,q))<tol;
 };
 const newer=mapped.filter(e=>e.kind==='wall').flatMap(segments),elements=[];
 for(const e of result.elements){
  if(e.confirmed){elements.push(e);continue;}
  if(['door','entrance'].includes(e.kind)&&e.points.every(within)&&windowOverlaps(...e.points.slice(0,2).map(point),mapped.filter(v=>v.kind==='toilet-door').map(v=>({...v,points:v.points.map(point)})),3))continue;
  if(e.kind==='wall'){
   // Replace only where the detail actually supplies a parallel wall. Keep
   // unmatched old walls: a partial response cannot erase a whole core.
   for(let i=1;i<e.points.length;i++){
    const a=e.points[i-1],b=e.points[i],range=clip(a,b,core),mix=t=>[a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t];
    const replacement=range&&newer.some(pair=>nearby([point(mix(range[0])),point(mix(range[1]))],pair)&&dist(...pair)>=Math.hypot(...mix(range[1]).map((v,j)=>v-mix(range[0])[j]))*.65);
    if(!replacement)elements.push(e.points.length===2?e:{...e,id:e.id+'-segment-'+i,points:[a,b]});
    else{if(range[0]>.001)elements.push({...e,id:e.id+'-before-'+i,points:[a,mix(range[0])]});if(range[1]<.999)elements.push({...e,id:e.id+'-after-'+i,points:[mix(range[1]),b]});}
   }
  }else elements.push(e);
 }
 const equalSpace=(a,b)=>{
  if(!spaceKinds.includes(a.kind)||!spaceKinds.includes(b.kind))return false;
  const aa=a.points.map(point),bb=b.points.map(point),ac=midpoint(a),bc=midpoint(b);
  const mutual=inside(point(ac),bb)&&inside(point(bc),aa),ratio=Math.min(area(aa),area(bb))/Math.max(1,area(aa),area(bb));
  return mutual&&(ratio>.55||a.label.toLowerCase()===b.label.toLowerCase());
 };
 for(const e of mapped){
  const duplicate=elements.findIndex(old=>{
   if(equalSpace(e,old))return true;if(old.kind!==e.kind)return false;
   if(lineKinds.includes(e.kind))return segments(e).every(([a,b])=>segments(old).some(([u,v])=>segDist(a,u,v)<3&&segDist(b,u,v)<3));
   const a=midpoint(e),b=midpoint(old);return Math.hypot(a[0]-b[0],a[1]-b[1])<5;
  });
  if(duplicate>=0){const old=elements[duplicate];if(!old.confirmed&&!e.partial)elements[duplicate]=e;}
  else elements.push(e);
 }
 return {result:{...result,elements},accepted:true};
}
