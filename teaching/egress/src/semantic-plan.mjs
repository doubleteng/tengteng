import {area,dist,edges,inside,project,segDist,uid} from './geometry.mjs?v=stair-review-20261031';

export const semanticKinds=['room','corridor','lobby','exterior','courtyard','void','projection','furniture','column','stair','window','wall','door','entrance'];
export const semanticColors={room:'#507fa6',corridor:'#e5a42f',lobby:'#b78cde',exterior:'#7da971',courtyard:'#64a795',void:'#c66e71',projection:'#8b9199',furniture:'#99816b',column:'#8c7464',stair:'#9b72bc',window:'#62a9c0',wall:'#254f47',door:'#d97830',entrance:'#d34936'};
const text=x=>String(x??'').slice(0,180);
export function validateInterpretation(input){
  if(!input||input.version!==1||!Array.isArray(input.elements)||input.elements.length>2000)throw Error('Invalid architectural interpretation.');
  const seen=new Set(),warnings=(input.warnings||[]).slice(0,50).map(text),elements=[];
  for(const item of input.elements){
    if(!semanticKinds.includes(item.kind))throw Error('Unknown architectural element type.');
    if(typeof item.id!=='string'||!item.id||seen.has(item.id))throw Error('Architectural element IDs must be unique.');seen.add(item.id);
    if(!Array.isArray(item.points)||item.points.length>160)throw Error('Invalid element geometry.');
    const points=item.points.map(q=>{if(!Array.isArray(q)||q.length!==2||q.some(v=>!Number.isFinite(v)||v<0||v>1000))throw Error('Element coordinates must be between 0 and 1000.');return [q[0],q[1]];});
    const line=['wall','door','entrance','window'].includes(item.kind);
    if(points.length<(line?2:3))throw Error('An element has incomplete geometry.');
    if(!line&&area(points.map(([x,y])=>({x,y})))<1){warnings.push(text(item.label)+': empty polygon omitted.');continue;}
    elements.push({id:item.id,kind:item.kind,label:text(item.label||item.kind),points,confidence:['high','medium','low'].includes(item.confidence)?item.confidence:'low',evidence:text(item.evidence),confirmed:false});
  }
  const outline=Array.isArray(input.outline)?input.outline:[];
  if(outline.length>160||outline.some(q=>!Array.isArray(q)||q.length!==2||q.some(v=>!Number.isFinite(v)||v<0||v>1000)))throw Error('Invalid floor enclosure.');
  return {version:1,summary:text(input.summary),outline,elements,warnings};
}
export function imagePoint(image,q){const c=Math.cos(image.rotation||0),s=Math.sin(image.rotation||0),x=q[0]/1000*image.width,y=(1-q[1]/1000)*image.height;return{x:image.x+c*x-s*y,y:image.y+s*x+c*y};}
export function featureObstacles(floor){return (floor.features||[]).filter(f=>f.blocksMovement===true&&['furniture','column'].includes(f.kind));}
export function excludedSpaces(floor){return (floor.features||[]).filter(f=>['courtyard','void','exterior'].includes(f.kind));}

// Explicit semantic polygons define rooms. Furniture is NEVER an input to the
// room graph. Imported openings are candidates until individually confirmed.
export function materializeInterpretation(result,image,{include=new Set(result.elements.map(e=>e.id)),defaultThickness=.15}={}){
  if(!image.calibrated)throw Error('Calibrate a known dimension before creating the analysis model.');
  const batch=uid(),out={outline:result.outline.map(q=>imagePoint(image,q)),rooms:[],walls:[],doors:[],stairs:[],features:[],candidates:[],recognition:{batch,summary:result.summary,warnings:[...result.warnings],reviewed:false}};
  const selected=result.elements.filter(e=>include.has(e.id));
  const common=e=>({id:uid(),name:e.label,recognition:{batch,sourceId:e.id,confidence:e.confidence,evidence:e.evidence,reviewed:e.confirmed===true}});
  for(const e of selected){
    const points=e.points.map(q=>imagePoint(image,q)),o=common(e);
    if(['room','corridor','lobby'].includes(e.kind)){out.rooms.push({...o,points,role:e.kind,function:'business',group:'B',factor:150,basis:'gross',areaConfirmed:false,fromWalls:true});}
    else if(e.kind==='wall'){for(let i=1;i<points.length;i++)if(dist(points[i-1],points[i])>.01)out.walls.push({...o,id:uid(),a:points[i-1],b:points[i],thickness:defaultThickness});}
    else if(e.kind==='stair')out.stairs.push({...o,points,link:'Unlinked '+e.label,width:1.2,travelLength:7,protected:false});
    else if(['door','entrance'].includes(e.kind))out.candidates.push({...o,kind:e.kind,points,confirmed:false});
    else out.features.push({...o,kind:e.kind,points,blocksMovement:false});
  }
  // Continuous perimeter seals uncertain gaps until a student confirms an
  // opening. Do not invent partition walls along an open-plan program boundary.
  if(out.outline.length>=3)for(const [a,b] of edges(out.outline)){
    const n=dist(a,b);if(n<.01)continue;
    const spans=out.walls.filter(w=>segDist(w.a,a,b)<defaultThickness&&segDist(w.b,a,b)<defaultThickness).map(w=>[project(w.a,a,b).t,project(w.b,a,b).t].sort((x,y)=>x-y)).sort((x,y)=>x[0]-y[0]);
    let cursor=0;const at=t=>({x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t});
    function fill(lo,hi){if((hi-lo)*n<.01)return;out.walls.push({id:uid(),a:at(lo),b:at(hi),thickness:defaultThickness,boundary:true,recognition:{batch,reviewed:false,evidence:'Proposed enclosure; confirm entrances before using egress results.'}});}
    for(const [lo,hi] of spans){if(lo>cursor)fill(cursor,lo);cursor=Math.max(cursor,hi);}if(cursor<1)fill(cursor,1);
  }
  return out;
}
export function confirmOpening(floor,candidate,{exit=false,width=null}={}){
  const [a,b]=candidate.points,center={x:(a.x+b.x)/2,y:(a.y+b.y)/2},clear=width??dist(a,b);
  if(!(clear>.05&&clear<20))throw Error('Enter the measured clear opening width.');
  let best=null,d=Infinity;for(const w of floor.walls){const q=project(center,w.a,w.b),dd=dist(q,center);if(dd<d){d=dd;best={w,q};}}
  if(!best||d>Math.max(.35,clear/2))throw Error('Move this candidate onto a wall, or draw the missing wall first.');
  const door={id:uid(),name:candidate.name||'Door',wallId:best.w.id,x:best.q.x,y:best.q.y,width:clear,exit,discharge:exit&&floor.elevation===0?'site':'none',recognition:{...candidate.recognition,reviewed:true}};
  floor.doors.push(door);floor.candidates=(floor.candidates||[]).filter(c=>c.id!==candidate.id);return door;
}
