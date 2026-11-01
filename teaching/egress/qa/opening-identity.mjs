import {mergeDoorAssembly} from './door-assembly.mjs?v=recognition-speed-1';
import {dist,segDist} from './geometry.mjs?v=recognition-speed-1';
import {openingHost} from './import-quality.mjs?v=recognition-speed-1';

const tolerance=.08;
const axis=points=>{const [a,b]=points,l=dist(a,b);return {a,b,l,x:(b.x-a.x)/l,y:(b.y-a.y)/l};};
const along=(p,u)=>(p.x-u.a.x)*u.x+(p.y-u.a.y)*u.y;
const offset=(p,u)=>Math.abs((p.x-u.a.x)*u.y-(p.y-u.a.y)*u.x);
const parallel=(a,b)=>Math.abs(a.x*b.y-a.y*b.x)<.05;
const sameGap=(a,b)=>a&&b&&((dist(a.a,b.a)<tolerance&&dist(a.b,b.b)<tolerance)||(dist(a.a,b.b)<tolerance&&dist(a.b,b.a)<tolerance));

// A leaf-sized proposal can lie inside a real opening without touching both
// jambs. Locate its containing gap using the nearest solid wall on each side.
// A wall pier or crossing partition prevents grouping neighboring openings.
function containingGap(walls,points){
 const u=axis(points);if(!(u.l>.01))return null;
 const runs=walls.flatMap(w=>{
  const v=axis([w.a,w.b]);if(!(v.l>.01)||!parallel(u,v)||Math.max(offset(w.a,u),offset(w.b,u))>tolerance)return [];
  const ends=[{t:along(w.a,u),p:w.a},{t:along(w.b,u),p:w.b}].sort((a,b)=>a.t-b.t);
  return [{lo:ends[0],hi:ends[1],w}];
 });
 const center=u.l/2;
 if(runs.some(r=>r.lo.t<center-tolerance&&r.hi.t>center+tolerance))return null;
 const left=runs.filter(r=>r.hi.t<=center).sort((a,b)=>b.hi.t-a.hi.t)[0];
 const right=runs.filter(r=>r.lo.t>=center).sort((a,b)=>a.lo.t-b.lo.t)[0];
 if(!left||!right||left.w===right.w||left.hi.t>tolerance||right.lo.t<u.l-tolerance)return null;
 const gap={a:left.hi.p,b:right.lo.p},l=dist(gap.a,gap.b);
 if(l<.05||l>=20)return null;
 const g=axis([gap.a,gap.b]);
 for(const w of walls){
  if(w===left.w||w===right.w)continue;
  const v=axis([w.a,w.b]);if(!(v.l>.01)||parallel(g,v))continue;
  const dx=w.b.x-w.a.x,dy=w.b.y-w.a.y,den=g.x*dy-g.y*dx;
  if(Math.abs(den)<1e-8)continue;
  const t=((w.a.x-g.a.x)*dy-(w.a.y-g.a.y)*dx)/den;
  const q={x:g.a.x+g.x*t,y:g.a.y+g.y*t};
  if(t>tolerance&&t<g.l-tolerance&&segDist(q,w.a,w.b)<tolerance)return null;
 }
 return openingHost(walls,[gap.a,gap.b]).gap||null;
}

function describe(walls,c){
 const host=openingHost(walls,c.points);
 return {c,host,u:axis(c.points),gap:host.gap||(host.wall?.openingHost?host.wall:null)||(!host.wall?containingGap(walls,c.points):null)};
}
function sameOpening(a,b){
 if(sameGap(a.gap,b.gap))return true;
 // Continuous centerline imports have no physical jamb gaps. Only merge
 // overlapping proposals on the same host; adjacent doors remain separate.
 if(!a.host.wall||!b.host.wall||a.host.wall.id!==b.host.wall.id||!parallel(a.u,b.u))return false;
 if(Math.max(offset(b.u.a,a.u),offset(b.u.b,a.u))>tolerance)return false;
 const lo=Math.min(along(b.u.a,a.u),along(b.u.b,a.u)),hi=Math.max(along(b.u.a,a.u),along(b.u.b,a.u));
 const overlap=Math.min(a.u.l,hi)-Math.max(0,lo);
 return overlap>=Math.min(a.u.l,b.u.l)*.8;
}
const ids=c=>[c.id,...(c.mergedCandidateIds||[])];
const sourceIds=c=>[c.recognition?.sourceId,...(c.recognition?.sourceIds||[])].filter(Boolean);

export function deduplicateOpenings(walls,candidates){
 const groups=[];
 // Complete jamb-to-jamb proposals establish identity before partial leaves.
 const rank=d=>(d.host.gap?100:0)+(d.c.recognition?.reviewed?50:0)+(d.host.wall?20:0)+(d.c.openingEvidence?.swingScore||0);
 const described=candidates.map((c,index)=>({...describe(walls,c),index})).sort((a,b)=>rank(b)-rank(a)||b.u.l-a.u.l);
 for(const d of described){const group=groups.find(g=>sameOpening(g.anchor,d));if(group)group.items.push(d);else groups.push({anchor:d,items:[d]});}
 return groups.sort((a,b)=>Math.min(...a.items.map(d=>d.index))-Math.min(...b.items.map(d=>d.index))).map(({anchor,items})=>{
  if(items.length===1)return anchor.c;
  const c=structuredClone(anchor.c),merged=items.map(d=>d.c);
  Object.assign(c,mergeDoorAssembly(merged,c));
  c.mergedCandidateIds=[...new Set(merged.flatMap(ids))].filter(id=>id!==c.id);
  c.recognition={...c.recognition,sourceIds:[...new Set(merged.flatMap(sourceIds))]};
  if(merged.some(v=>v.suggestedExit||v.kind==='entrance')){c.kind='entrance';c.suggestedExit=merged.some(v=>v.suggestedExit);}
  // Two leaf proposals may together cover the complete gap. Never promote
  // their combined width to an automatically confirmed door measurement.
  if(anchor.gap&&!anchor.host.gap&&!anchor.host.wall){
   const u=axis([anchor.gap.a,anchor.gap.b]),ts=merged.flatMap(v=>v.points.slice(0,2).map(p=>along(p,u)));
   if(Math.min(...ts)<tolerance&&Math.max(...ts)>u.l-tolerance){c.points=[{...anchor.gap.a},{...anchor.gap.b}];c.openingEvidence={located:true,method:'jambs',swingScore:0,autoDoor:false};}
  }
  return c;
 });
}

export function doorPoints(floor,door){
 const w=(floor.walls||[]).find(w=>w.id===door.wallId);if(!w||!(door.width>0))return null;
 const u=axis([w.a,w.b]);if(!(u.l>.01))return null;
 return [-1,1].map(sign=>({x:door.x+sign*u.x*door.width/2,y:door.y+sign*u.y*door.width/2}));
}
export function matchingDoor(floor,candidate){
 const c=describe(floor.walls,candidate);
 return (floor.doors||[]).find(d=>{const points=doorPoints(floor,d);return points&&sameOpening(c,describe(floor.walls,{points}));});
}

// Used when opening existing projects as well as applying a new recognition.
// Confirmed door objects keep their dimensions, exit role and stable IDs.
export function reconcileOpeningCandidates(floor){
 if(!floor.candidates?.length)return false;
 const before=JSON.stringify(floor.candidates);
 floor.candidates=deduplicateOpenings(floor.walls||[],floor.candidates).filter(c=>!matchingDoor(floor,c));
 for(const c of floor.candidates)c.located=!openingHost(floor.walls||[],c.points).error;
 return JSON.stringify(floor.candidates)!==before;
}
