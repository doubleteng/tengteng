import {refineFurnitureGeometry} from './furniture-evidence.mjs?v=whole-plan-1';
import {normalizeSanitaryElements} from './sanitary-elements.mjs?v=door-detection-1';
import {normalizeWallNetwork} from './wall-network.mjs?v=auto-enclosure-1';
import {doorSwingEvidence,glazingBarrierEvidence,windowOverlaps} from './door-evidence.mjs?v=auto-enclosure-1';
import {strokeMask,attachSourceEvidence} from './import-quality.mjs?v=whole-plan-1';
import {dist,segDist,project,lerp,edges} from './geometry.mjs?v=auto-enclosure-1';

export function refinementSignature(result){
 let hash=2166136261;
 const value=JSON.stringify([result.outline,result.elements.map(e=>[e.id,e.kind,e.confirmed===true,e.points])]);
 for(let i=0;i<value.length;i++)hash=Math.imul(hash^value.charCodeAt(i),16777619);
 return (hash>>>0).toString(16);
}

// Semantic boundaries locate search bands; source pixels locate the geometry.
// Furniture and drawing annotations never supply boundary search bands.
// Distances below are relative to source resolution, not a particular plan.
export function refineSourceWalls(result,imageData){
 result={...result,elements:normalizeSanitaryElements(result.elements)};
 const previous=result.sourceRefinement;
 if(previous?.version===5&&previous.sourceWidth===imageData.width&&previous.sourceHeight===imageData.height&&previous.signature===refinementSignature(result))return attachSourceEvidence(structuredClone(result),imageData);
 const {width:w,height:h,mask}=strokeMask(imageData),unit=Math.max(w,h)/2000;
 const radius=Math.max(4,12*unit),inkRadius=Math.max(1,Math.round(1.5*unit));
 const px=q=>({x:q[0]*w/1000,y:q[1]*h/1000});
 const norm=q=>[Math.max(0,Math.min(1000,q.x/w*1000)),Math.max(0,Math.min(1000,q.y/h*1000))];
 const at=(x,y)=>{x=Math.round(x);y=Math.round(y);return x>=0&&y>=0&&x<w&&y<h&&mask[y*w+x];};
 const hit=(p,n,r=inkRadius)=>{for(let k=-r;k<=r;k++)if(at(p.x+n.x*k,p.y+n.y*k))return true;return false;};
 const hints=[];
 for(const e of result.elements){
  if(e.confirmed||e.partial||!['wall','window','room','corridor','lobby'].includes(e.kind))continue;
  const ps=e.points.map(px),pairs=['wall','window'].includes(e.kind)?ps.slice(1).map((b,i)=>[ps[i],b]):edges(ps);
  for(const [a,b] of pairs)if(dist(a,b)>Math.max(8,10*unit))hints.push({a,b,e});
 }
 if(result.outline.length)for(const [a,b] of edges(result.outline.map(px)))hints.push({a,b,e:{id:'outline',label:'Exterior enclosure'}});
 // A door proposal also locates the short wall returns above/below its jambs.
 // These are search bands only: require source ink and an existing wall
 // intersection outside the aperture. Never draw a wall through the door.
 const anchorsForDoors=[...hints].filter(h=>h.e.kind==='wall'||h.e.id==='outline');
 for(const e of result.elements.filter(e=>['door','entrance'].includes(e.kind))){
  const [a,b]=e.points.slice(0,2).map(px),l=dist(a,b);if(l<5)continue;
  const u={x:(b.x-a.x)/l,y:(b.y-a.y)/l},reach=Math.max(radius*3,l*.8),intersections=[];
  for(const h of anchorsForDoors){
   const dx=h.b.x-h.a.x,dy=h.b.y-h.a.y,den=u.x*dy-u.y*dx;if(Math.abs(den)<.2*dist(h.a,h.b))continue;
   const t=((h.a.x-a.x)*dy-(h.a.y-a.y)*dx)/den,q={x:a.x+u.x*t,y:a.y+u.y*t};
   if(segDist(q,h.a,h.b)<=Math.max(2,3*unit))intersections.push(t);
  }
  const before=intersections.filter(t=>t< -2&&t>=-reach).sort((a,b)=>b-a)[0],after=intersections.filter(t=>t>l+2&&t<=l+reach).sort((a,b)=>a-b)[0];
  for(const [start,end] of [[before,0],[l,after]])if(Number.isFinite(start)&&Number.isFinite(end))hints.push({a:{x:a.x+u.x*start,y:a.y+u.y*start},b:{x:a.x+u.x*end,y:a.y+u.y*end},e:{id:'door-host-'+e.id,kind:'wall',label:'Wall at '+(e.label||'door'),hostHint:true}});
 }
 const walls=[],rejected=[];
 for(const hint of hints){
  const {a,b,e}=hint,l=dist(a,b);if(l<(e.hostHint?3:8))continue;
  const u={x:(b.x-a.x)/l,y:(b.y-a.y)/l},n={x:-u.y,y:u.x};
  const count=Math.min(180,Math.max(10,Math.ceil(l/(2*unit||1))));
  let best=null;
  // A small angle/offset search corrects approximate model coordinates. A
  // long unsupported diagonal cannot survive on endpoint evidence alone.
  for(let slope=-.10;slope<=.1001;slope+=.02)for(let offset=-radius;offset<=radius;offset+=Math.max(1,unit)){
   let hits=0;for(let i=1;i<count;i++){
    const t=i/count,d=offset+slope*l*(t-.5),q={x:a.x+u.x*l*t+n.x*d,y:a.y+u.y*l*t+n.y*d};
    if(hit(q,n))hits++;
   }
   const coverage=hits/(count-1),score=coverage-Math.abs(offset)/radius*.025-Math.abs(slope)*.15;
   if(!best||score>best.score)best={offset,slope,score,coverage};
  }
  if(best.coverage<(e.hostHint?.72:.48)){if(e.kind==='wall')rejected.push(e.id);continue;}
  // Center solid thick strokes, including when the initial hint sat on a face.
  const offsets=[],bands=[];const profileRadius=Math.max(8,24*unit);
  for(let i=1;i<count;i++){
   const t=i/count,d=best.offset+best.slope*l*(t-.5),q={x:a.x+u.x*l*t+n.x*d,y:a.y+u.y*l*t+n.y*d};
   let nearest=null;for(let k=-inkRadius;k<=inkRadius;k++)if(at(q.x+n.x*k,q.y+n.y*k)&&(!nearest||Math.abs(k)<Math.abs(nearest.k)))nearest={k};
   if(!nearest)continue;let lo=nearest.k,hi=lo;
   while(lo>-profileRadius&&at(q.x+n.x*(lo-1),q.y+n.y*(lo-1)))lo--;
   while(hi<profileRadius&&at(q.x+n.x*(hi+1),q.y+n.y*(hi+1)))hi++;
   if(hi-lo<profileRadius*1.5){
    // Two thin faces bound one hollow wall; retain its center and support band.
    if(hi-lo<=Math.max(2,2*unit)){
     const runs=[];let start=null;
     for(let k=-Math.floor(profileRadius);k<=profileRadius;k++){const ink=at(q.x+n.x*k,q.y+n.y*k);if(ink&&start===null)start=k;if(start!==null&&(!ink||k===Math.floor(profileRadius))){runs.push([start,k-(ink?0:1)]);start=null;}}
     const pair=runs.filter(([aa,bb])=>bb<lo-1||aa>hi+1).filter(([aa,bb])=>bb-aa<=Math.max(2,2*unit)&&Math.min(Math.abs(aa-hi),Math.abs(bb-lo))<=Math.max(7,18*unit)).sort((a,b)=>Math.min(Math.abs(a[0]-hi),Math.abs(a[1]-lo))-Math.min(Math.abs(b[0]-hi),Math.abs(b[1]-lo)))[0];
     if(pair){lo=Math.min(lo,pair[0]);hi=Math.max(hi,pair[1]);}
    }
    offsets.push((lo+hi)/2);bands.push((hi-lo)/2+1);
   }
  }
  offsets.sort((a,b)=>a-b);bands.sort((a,b)=>a-b);const band=Math.min(profileRadius,bands[Math.floor(bands.length/2)]||inkRadius);const center=offsets.length?offsets[Math.floor(offsets.length/2)]:0;
  const point=t=>{const d=best.offset+center+best.slope*(t-l/2);return{x:a.x+u.x*t+n.x*d,y:a.y+u.y*t+n.y*d};};
  const start=point(0),end=point(l),nl=dist(start,end),normal={x:-(end.y-start.y)/nl,y:(end.x-start.x)/nl};
  let runStart=null,last=null,gap=0;
  const flush=()=>{if(runStart!==null&&last-runStart>=(e.hostHint?Math.max(3,4*unit):Math.max(8,12*unit)))walls.push({a:point(runStart),b:point(last),hint:e.id,label:e.kind==='wall'?e.label:'Wall at '+(e.label||'enclosure'),score:best.coverage,band,explicit:['wall','window'].includes(e.kind)});runStart=null;last=null;gap=0;};
  for(let t=0;t<=Math.ceil(l);t++){
   if(hit(point(t),normal,Math.max(inkRadius,Math.ceil(band)))){if(runStart===null)runStart=t;last=t;gap=0;}
   else if(++gap>Math.max(2,2*unit))flush();
  }flush();
 }
 const kept=result.elements.filter(e=>e.kind!=='wall'||e.confirmed).map(e=>structuredClone(e));
 // Collapse repeated hints along the same stroke; never count the two room
 // sides as two physical walls. Retain real gaps between disjoint runs.
 const source={width:w,height:h,mask};
 const supported=(a,b,band=inkRadius)=>{const l=dist(a,b);if(!l)return true;const n={x:-(b.y-a.y)/l,y:(b.x-a.x)/l},count=Math.max(4,Math.min(80,Math.ceil(l)));let hits=0;for(let i=0;i<=count;i++)if(hit(lerp(a,b,i/count),n,Math.ceil(band)))hits++;return hits/(count+1)>=.75;};
 const openings=kept.filter(e=>['door','entrance'].includes(e.kind)).map(e=>e.points.slice(0,2).map(px));
 const unique=normalizeWallNetwork(walls,{unit,supported,openingAt:(q,r)=>openings.some(([a,b])=>segDist(q,a,b)<r&&Math.min(dist(q,a),dist(q,b))>r)});
 // Reviewed walls are immutable anchors, never duplicated by recovered bands.
 const anchors=kept.filter(e=>e.kind==='wall').flatMap(e=>e.points.slice(1).map((q,i)=>[px(e.points[i]),px(q)]));
 for(let i=unique.length-1;i>=0;i--)if(anchors.some(([a,b])=>segDist(unique[i].a,a,b)<Math.max(2,3*unit)&&segDist(unique[i].b,a,b)<Math.max(2,3*unit)))unique.splice(i,1);
 const gaps=[];
 for(let i=0;i<unique.length;i++)for(let j=i+1;j<unique.length;j++){
  const s=unique[i],t=unique[j],sl=dist(s.a,s.b),tl=dist(t.a,t.b);
  if(Math.abs((s.b.x-s.a.x)*(t.b.y-t.a.y)-(s.b.y-s.a.y)*(t.b.x-t.a.x))/(sl*tl)>.04)continue;
  for(const a of [s.a,s.b])for(const b of [t.a,t.b]){
   const l=dist(a,b),center=lerp(a,b,.5),u={x:(s.b.x-s.a.x)/sl,y:(s.b.y-s.a.y)/sl};
   if(l<Math.max(3,4*unit)||l>Math.max(12,55*unit,Math.min(w,h)*.12)||Math.abs((b.x-a.x)*u.y-(b.y-a.y)*u.x)>Math.max(2,3*unit))continue;
   if(segDist(center,s.a,s.b)<l*.4||segDist(center,t.a,t.b)<l*.4)continue;
   if(unique.some(v=>v!==s&&v!==t&&segDist(center,v.a,v.b)<3*unit))continue;
   const supportedBoundary=hints.some(v=>segDist(a,v.a,v.b)<radius&&segDist(b,v.a,v.b)<radius)||openings.some(([u,v])=>segDist(a,u,v)<radius&&segDist(b,u,v)<radius);
   if(!supportedBoundary)continue;
   if(supported(a,b,Math.max(1,Math.min(s.band||1,t.band||1)*.5)))continue;
   if(gaps.some(g=>dist(g.center,center)<Math.max(2,3*unit)))continue;
   const evidence=doorSwingEvidence(a,b,source,unit),window=windowOverlaps(a,b,kept.filter(e=>e.kind==='window').map(e=>({...e,points:e.points.map(px)})),Math.max(3,4*unit)),glazing=glazingBarrierEvidence(a,b,source,unit);
   gaps.push({a,b,center,evidence,windowConflict:window?'Window symbol overlaps this opening.':glazing.score>=.8?'Continuous frame / glazing lines cross this opening.':''});
  }
 }
 // Match proposals to measured jambs. Only source-supported swing evidence
 // can later promote a hosted interior opening to an editable door.
 for(const e of kept.filter(e=>!e.confirmed&&['door','entrance'].includes(e.kind))){
  delete e.openingEvidence;
  const a=px(e.points[0]),b=px(e.points[1]),l=dist(a,b);if(!l)continue;
  const center=lerp(a,b,.5),gap=gaps.filter(g=>dist(center,g.center)<Math.max(radius,l*.6)&&segDist(g.center,a,b)<radius).sort((a,b)=>dist(a.center,center)-dist(b.center,center))[0];
  if(gap){e.points=[norm(gap.a),norm(gap.b)];e.openingEvidence={located:true,swingScore:gap.evidence.score,method:gap.evidence.score>=.55?'swing-and-jambs':'jambs',autoDoor:gap.evidence.score>=.55&&!gap.windowConflict,windowConflict:gap.windowConflict,swingPoint:gap.evidence.swingPoint?norm(gap.evidence.swingPoint):null};if(gap.evidence.score>=.55){e.doorType=gap.evidence.doorType;e.leafCount=gap.evidence.leafCount;}gap.claimed=true;continue;}
  const hosts=unique.filter(s=>{
   const sl=dist(s.a,s.b),cross=Math.abs((b.x-a.x)*(s.b.y-s.a.y)-(b.y-a.y)*(s.b.x-s.a.x))/(l*sl);
   return cross<.15&&segDist(center,s.a,s.b)<Math.max(radius,l*.6);
  }).sort((s,t)=>segDist(center,s.a,s.b)-segDist(center,t.a,t.b));
  if(hosts.length){const s=hosts[0],sl=dist(s.a,s.b),u={x:(s.b.x-s.a.x)/sl,y:(s.b.y-s.a.y)/sl},d=(center.x-s.a.x)*u.x+(center.y-s.a.y)*u.y,q={x:s.a.x+u.x*d,y:s.a.y+u.y*d};e.points=[norm({x:q.x-u.x*l/2,y:q.y-u.y*l/2}),norm({x:q.x+u.x*l/2,y:q.y+u.y*l/2})];}
 }
 let serial=0;const ids=new Set(kept.map(e=>e.id)),newId=()=>{let id;do{id='fitted-wall-'+serial++;}while(ids.has(id));ids.add(id);return id;};
 for(const gap of gaps)if(gap.evidence.score>=.55&&!gap.windowConflict&&!gap.claimed&&!kept.some(e=>['door','entrance'].includes(e.kind)&&segDist(gap.center,...e.points.slice(0,2).map(px))<Math.max(3,4*unit))){
  kept.push({id:newId(),kind:'door',label:'Detected door',points:[norm(gap.a),norm(gap.b)],confidence:'high',doorType:gap.evidence.doorType,leafCount:gap.evidence.leafCount,evidence:'Door swing and two aligned wall jambs detected in the source drawing.',openingEvidence:{located:true,swingScore:gap.evidence.score,method:'swing-and-jambs',autoDoor:true,swingPoint:gap.evidence.swingPoint?norm(gap.evidence.swingPoint):null},confirmed:false});
 }
 for(const s of unique)kept.push({id:newId(),kind:'wall',label:s.label||'Source wall',points:[norm(s.a),norm(s.b)],sourceBand:Math.min(40,s.band||inkRadius),confidence:'medium',evidence:'Wall position fitted to source strokes within an architectural boundary band. Openings require confirmation.',confirmed:false});
 // Whole-image and detail reads can describe the same opening. Keep one.
 for(let i=kept.length-1;i>=0;i--){const e=kept[i];if(e.confirmed||!['door','entrance'].includes(e.kind))continue;const a=px(e.points[0]),b=px(e.points[1]),c=lerp(a,b,.5);const duplicate=kept.findIndex((v,j)=>j<i&&!v.confirmed&&['door','entrance'].includes(v.kind)&&dist(c,lerp(...v.points.slice(0,2).map(px),.5))<Math.max(3,Math.min(dist(a,b)*.35,12*unit)));if(duplicate>=0){if(e.openingEvidence?.located&&!kept[duplicate].openingEvidence?.located)kept[duplicate]=e;kept.splice(i,1);}}
 const out=attachSourceEvidence(refineFurnitureGeometry({...result,elements:kept,warnings:[...result.warnings]},imageData),imageData);
 out.sourceRefinement={version:5,sourceWidth:w,sourceHeight:h,signature:refinementSignature(out),rejectedHints:[...new Set(rejected)].length};
 return out;
}
