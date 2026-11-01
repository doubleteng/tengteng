import {materializeInterpretation} from './semantic-plan.mjs?v=opening-identity-1';
import {roomPoint} from './geometry.mjs?v=portal-network-1';

const spaceKinds=['room','corridor','lobby'];
const box=points=>({left:Math.min(...points.map(p=>p[0])),top:Math.min(...points.map(p=>p[1])),right:Math.max(...points.map(p=>p[0])),bottom:Math.max(...points.map(p=>p[1]))});
const midpoint=e=>{const p=roomPoint({points:e.points.map(([x,y])=>({x,y}))});return [p.x,p.y];};

// The review and application both compile this exact wall graph. Semantic
// polygons remain label hints, never an alternative source of usable area.
export function compileRecognition(result,image){
 const model=materializeInterpretation(result,{...image,calibrated:true});
 const expected=result.elements.filter(e=>spaceKinds.includes(e.kind));
 const pending=model.pendingSpaces||[];
 const unmatchedWalls=model.walls.filter(w=>!w.recognition?.reviewed&&w.recognition?.sourceCheck&&(w.recognition.sourceCheck.coverage<.55||w.recognition.sourceCheck.missingPixels>30));
 const roomBySource=new Map(model.rooms.filter(r=>r.recognition?.sourceId).map(r=>[r.recognition.sourceId,r]));
 return {model,expected:expected.length,pending,unmatchedWalls,roomBySource,complete:expected.length>0&&pending.length===0&&unmatchedWalls.length===0&&model.outline.length>=3};
}

// Spatial grouping has no named-building coordinates or drawing-style rules.
// Each crop includes architectural context around several neighboring spaces.
export function detailRegions(result,maxRegions=3){
 const spaces=result.elements.filter(e=>spaceKinds.includes(e.kind));if(spaces.length<3)return [];
 const groups=[spaces];
 while(groups.length<maxRegions){
  const group=groups.filter(g=>g.length>=3).sort((a,b)=>b.length-a.length)[0];if(!group)break;
  const centers=group.map(midpoint),b=box(centers),axis=b.right-b.left>b.bottom-b.top?0:1;
  const ordered=[...group].sort((a,b)=>midpoint(a)[axis]-midpoint(b)[axis]),half=Math.ceil(ordered.length/2);
  groups.splice(groups.indexOf(group),1,ordered.slice(0,half),ordered.slice(half));
 }
 return groups.map((group,i)=>{
  const b=box(group.flatMap(e=>e.points)),pad=Math.max(12,Math.max(b.right-b.left,b.bottom-b.top)*.08);
  const x=Math.max(0,b.left-pad),y=Math.max(0,b.top-pad),right=Math.min(1000,b.right+pad),bottom=Math.min(1000,b.bottom+pad);
  return {id:i,x,y,width:right-x,height:bottom-y,spaceIds:group.map(e=>e.id),core:b};
 }).filter(r=>r.width>20&&r.height>20);
}

function clip(a,b,r){
 let lo=0,hi=1;const dx=b[0]-a[0],dy=b[1]-a[1];
 for(const [p,q] of [[-dx,a[0]-r.left],[dx,r.right-a[0]],[-dy,a[1]-r.top],[dy,r.bottom-a[1]]]){
  if(!p){if(q<0)return null;continue;}const t=q/p;if(p<0)lo=Math.max(lo,t);else hi=Math.min(hi,t);if(lo>hi)return null;
 }return [lo,hi];
}

export function mergeDetail(result,detail,region){
 const mapped=detail.elements.filter(e=>['wall','window','door','entrance'].includes(e.kind)).map(e=>({...e,id:'detail-'+region.id+'-'+e.id,confirmed:false,points:e.points.map(([x,y])=>[region.x+x/1000*region.width,region.y+y/1000*region.height])}));
 const walls=mapped.filter(e=>e.kind==='wall');
 if(!walls.length)return {result,accepted:false};
 const core=region.core,within=p=>p[0]>=core.left&&p[0]<=core.right&&p[1]>=core.top&&p[1]<=core.bottom;
 const useful=mapped.filter(e=>e.kind==='wall'||e.kind==='window'||e.points.every(within));
 // Cropped edges are not architectural walls. Ignore strokes on crop borders.
 const margin=Math.min(region.width,region.height)*.015;
 const border=e=>e.points.every(p=>Math.abs(p[0]-region.x)<margin)||e.points.every(p=>Math.abs(p[0]-region.x-region.width)<margin)||e.points.every(p=>Math.abs(p[1]-region.y)<margin)||e.points.every(p=>Math.abs(p[1]-region.y-region.height)<margin);
 const elements=[];
 for(const e of result.elements){
  if(e.confirmed){elements.push(e);continue;}
  if(e.kind==='wall'){
   for(let i=1;i<e.points.length;i++){
    const a=e.points[i-1],b=e.points[i],range=clip(a,b,core),mix=t=>[a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t];
    if(!range)elements.push({...e,id:e.id+'-outside-'+i,points:[a,b]});
    else{if(range[0]>.001)elements.push({...e,id:e.id+'-before-'+i,points:[a,mix(range[0])]});if(range[1]<.999)elements.push({...e,id:e.id+'-after-'+i,points:[mix(range[1]),b]});}
   }
  }
  else if(['door','entrance','window'].includes(e.kind)&&e.points.every(within)&&useful.some(r=>r.kind===e.kind&&Math.hypot(midpoint(r)[0]-midpoint(e)[0],midpoint(r)[1]-midpoint(e)[1])<15))continue;
  else elements.push(e);
 }
 for(const e of useful){
  if(border(e))continue;
  elements.push(e);
 }
 return {result:{...result,elements},accepted:true};
}
