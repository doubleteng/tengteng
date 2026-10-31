import {strokeMask,attachSourceEvidence} from './import-quality.mjs?v=recognition-graph-1';
import {dist,segDist,project,lerp,edges} from './geometry.mjs?v=wall-rooms-1';

// Semantic boundaries locate search bands; source pixels locate the geometry.
// Furniture and drawing annotations never supply boundary search bands.
// Distances below are relative to source resolution, not a particular plan.
export function refineSourceWalls(result,imageData){
 const {width:w,height:h,mask}=strokeMask(imageData),unit=Math.max(w,h)/2000;
 const radius=Math.max(4,12*unit),inkRadius=Math.max(1,Math.round(1.5*unit));
 const px=q=>({x:q[0]*w/1000,y:q[1]*h/1000});
 const norm=q=>[Math.max(0,Math.min(1000,q.x/w*1000)),Math.max(0,Math.min(1000,q.y/h*1000))];
 const at=(x,y)=>{x=Math.round(x);y=Math.round(y);return x>=0&&y>=0&&x<w&&y<h&&mask[y*w+x];};
 const hit=(p,n,r=inkRadius)=>{for(let k=-r;k<=r;k++)if(at(p.x+n.x*k,p.y+n.y*k))return true;return false;};
 const hints=[];
 for(const e of result.elements){
  if(e.confirmed||!['wall','window','room','corridor','lobby'].includes(e.kind))continue;
  const ps=e.points.map(px),pairs=['wall','window'].includes(e.kind)?ps.slice(1).map((b,i)=>[ps[i],b]):edges(ps);
  for(const [a,b] of pairs)if(dist(a,b)>Math.max(8,10*unit))hints.push({a,b,e});
 }
 if(result.outline.length)for(const [a,b] of edges(result.outline.map(px)))hints.push({a,b,e:{id:'outline',label:'Exterior enclosure'}});
 const walls=[],rejected=[];
 for(const hint of hints){
  const {a,b,e}=hint,l=dist(a,b);if(l<8)continue;
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
  if(best.coverage<.48){if(e.kind==='wall')rejected.push(e.id);continue;}
  // Center solid thick strokes, including when the initial hint sat on a face.
  const offsets=[];
  for(let i=1;i<count;i++){
   const t=i/count,d=best.offset+best.slope*l*(t-.5),q={x:a.x+u.x*l*t+n.x*d,y:a.y+u.y*l*t+n.y*d};
   let nearest=null;for(let k=-inkRadius;k<=inkRadius;k++)if(at(q.x+n.x*k,q.y+n.y*k)&&(!nearest||Math.abs(k)<Math.abs(nearest.k)))nearest={k};
   if(!nearest)continue;let lo=nearest.k,hi=lo;
   while(lo>-radius&&at(q.x+n.x*(lo-1),q.y+n.y*(lo-1)))lo--;
   while(hi<radius&&at(q.x+n.x*(hi+1),q.y+n.y*(hi+1)))hi++;
   if(hi-lo<radius)offsets.push((lo+hi)/2);
  }
  offsets.sort((a,b)=>a-b);const center=offsets.length?offsets[Math.floor(offsets.length/2)]:0;
  const point=t=>{const d=best.offset+center+best.slope*(t-l/2);return{x:a.x+u.x*t+n.x*d,y:a.y+u.y*t+n.y*d};};
  const start=point(0),end=point(l),nl=dist(start,end),normal={x:-(end.y-start.y)/nl,y:(end.x-start.x)/nl};
  let runStart=null,last=null,gap=0;
  const flush=()=>{if(runStart!==null&&last-runStart>=Math.max(8,12*unit))walls.push({a:point(runStart),b:point(last),hint:e.id,label:e.kind==='wall'?e.label:'Wall at '+(e.label||'enclosure'),score:best.coverage});runStart=null;last=null;gap=0;};
  for(let t=0;t<=Math.ceil(l);t++){
   if(hit(point(t),normal)){if(runStart===null)runStart=t;last=t;gap=0;}
   else if(++gap>Math.max(2,2*unit))flush();
  }flush();
 }
 const kept=result.elements.filter(e=>e.kind!=='wall'||e.confirmed).map(e=>structuredClone(e));
 // Collapse repeated hints along the same stroke; never count the two room
 // sides as two physical walls. Retain real gaps between disjoint runs.
 const unique=[];
 for(const s of walls.sort((a,b)=>b.score-a.score||dist(b.a,b.b)-dist(a.a,a.b))){
  let merged=false;
  for(const t of unique){
   const dl=dist(s.a,s.b),tl=dist(t.a,t.b),cross=Math.abs((s.b.x-s.a.x)*(t.b.y-t.a.y)-(s.b.y-s.a.y)*(t.b.x-t.a.x))/(dl*tl);
   if(cross>.035)continue;
   const ux=(t.b.x-t.a.x)/tl,uy=(t.b.y-t.a.y)/tl;
   const along=p=>(p.x-t.a.x)*ux+(p.y-t.a.y)*uy,off=p=>Math.abs((p.x-t.a.x)*uy-(p.y-t.a.y)*ux);
   const aa=along(s.a),bb=along(s.b),lo=Math.min(aa,bb),hi=Math.max(aa,bb);
   if(Math.max(off(s.a),off(s.b))>Math.max(2,3*unit)||lo>tl+2*unit||hi< -2*unit)continue;
   const origin={...t.a};t.a={x:origin.x+ux*Math.min(0,lo),y:origin.y+uy*Math.min(0,lo)};t.b={x:origin.x+ux*Math.max(tl,hi),y:origin.y+uy*Math.max(tl,hi)};merged=true;break;
  }
  if(!merged)unique.push({...s});
 }
 const intersection=(a,b,c,d)=>{const x=b.x-a.x,y=b.y-a.y,xx=d.x-c.x,yy=d.y-c.y,den=x*yy-y*xx;if(Math.abs(den)<1e-8)return null;const t=((c.x-a.x)*yy-(c.y-a.y)*xx)/den;return{x:a.x+x*t,y:a.y+y*t};};
 // Join only where a visible source stroke reaches the other wall. Black
 // pixels along the extension are required; blank door gaps stay blank.
 for(const s of unique)for(const key of ['a','b']){
  const p=s[key],l=dist(s.a,s.b),n={x:-(s.b.y-s.a.y)/l,y:(s.b.x-s.a.x)/l};let best=null;
  for(const t of unique){if(s===t)continue;const q=intersection(s.a,s.b,t.a,t.b);if(!q)continue;
   const d=dist(p,q);if(d<.01||d>radius||segDist(q,t.a,t.b)>radius*.6)continue;
   let supported=0,total=Math.max(2,Math.ceil(d));for(let i=0;i<=total;i++)if(hit(lerp(p,q,i/total),n,Math.max(2,inkRadius)))supported++;
   if(supported/(total+1)<.7)continue;if(!best||d<best.d)best={q,d};
  }
  if(best)s[key]=best.q;
 }
 // Collinear wall runs on either side of a gap share one axis. Correct small
 // fitting offsets before proposing jambs, carrying attached junctions along.
 for(let i=0;i<unique.length;i++)for(let j=i+1;j<unique.length;j++){
  let s=unique[i],t=unique[j];if(dist(t.a,t.b)>dist(s.a,s.b))[s,t]=[t,s];
  const sl=dist(s.a,s.b),tl=dist(t.a,t.b),u={x:(s.b.x-s.a.x)/sl,y:(s.b.y-s.a.y)/sl},n={x:-u.y,y:u.x};
  if(Math.abs(u.x*(t.b.y-t.a.y)-u.y*(t.b.x-t.a.x))/tl>.025)continue;
  const off=p=>Math.abs((p.x-s.a.x)*n.x+(p.y-s.a.y)*n.y);
  if(Math.max(off(t.a),off(t.b))>Math.max(1.5,3*unit)||Math.min(dist(s.a,t.a),dist(s.a,t.b),dist(s.b,t.a),dist(s.b,t.b))>55*unit)continue;
  const onto=p=>{const d=(p.x-s.a.x)*u.x+(p.y-s.a.y)*u.y;return {x:s.a.x+u.x*d,y:s.a.y+u.y*d};};
  const a=onto(t.a),b=onto(t.b);let supported=0;for(let k=0;k<=20;k++)if(hit(lerp(a,b,k/20),n))supported++;
  if(supported<16)continue;
  for(const key of ['a','b']){const old={...t[key]},q=key==='a'?a:b;for(const v of unique)for(const end of ['a','b'])if(dist(v[end],old)<.1)v[end]={...q};}
 }
 const gaps=[];
 for(let i=0;i<unique.length;i++)for(let j=i+1;j<unique.length;j++){
  const s=unique[i],t=unique[j],sl=dist(s.a,s.b),tl=dist(t.a,t.b);
  if(Math.abs((s.b.x-s.a.x)*(t.b.y-t.a.y)-(s.b.y-s.a.y)*(t.b.x-t.a.x))/(sl*tl)>.04)continue;
  for(const a of [s.a,s.b])for(const b of [t.a,t.b]){
   const l=dist(a,b),center=lerp(a,b,.5),u={x:(s.b.x-s.a.x)/sl,y:(s.b.y-s.a.y)/sl};
   if(l<Math.max(3,4*unit)||l>Math.max(12,55*unit)||Math.abs((b.x-a.x)*u.y-(b.y-a.y)*u.x)>Math.max(2,3*unit))continue;
   if(segDist(center,s.a,s.b)<l*.4||segDist(center,t.a,t.b)<l*.4)continue;
   if(unique.some(v=>v!==s&&v!==t&&segDist(center,v.a,v.b)<3*unit))continue;
   const supportedBoundary=hints.some(v=>segDist(a,v.a,v.b)<radius&&segDist(b,v.a,v.b)<radius);
   if(!supportedBoundary)continue;
   gaps.push({a,b,center});
  }
 }
 // Match opening proposals to nearby fitted wall axes without inventing a
 // passable door. All candidates still require explicit confirmation.
 for(const e of kept.filter(e=>!e.confirmed&&['door','entrance'].includes(e.kind))){
  const a=px(e.points[0]),b=px(e.points[1]),l=dist(a,b);if(!l)continue;
  const center=lerp(a,b,.5),gap=gaps.filter(g=>dist(center,g.center)<Math.max(radius,l*.6)&&segDist(g.center,a,b)<radius).sort((a,b)=>dist(a.center,center)-dist(b.center,center))[0];
  if(gap){e.points=[norm(gap.a),norm(gap.b)];gap.claimed=true;continue;}
  const hosts=unique.filter(s=>{
   const sl=dist(s.a,s.b),cross=Math.abs((b.x-a.x)*(s.b.y-s.a.y)-(b.y-a.y)*(s.b.x-s.a.x))/(l*sl);
   return cross<.15&&segDist(center,s.a,s.b)<Math.max(radius,l*.6);
  }).sort((s,t)=>segDist(center,s.a,s.b)-segDist(center,t.a,t.b));
  if(hosts.length){const s=hosts[0],sl=dist(s.a,s.b),u={x:(s.b.x-s.a.x)/sl,y:(s.b.y-s.a.y)/sl},d=(center.x-s.a.x)*u.x+(center.y-s.a.y)*u.y,q={x:s.a.x+u.x*d,y:s.a.y+u.y*d};e.points=[norm({x:q.x-u.x*l/2,y:q.y-u.y*l/2}),norm({x:q.x+u.x*l/2,y:q.y+u.y*l/2})];}
 }
 let serial=0;const ids=new Set(kept.map(e=>e.id)),newId=()=>{let id;do{id='fitted-wall-'+serial++;}while(ids.has(id));ids.add(id);return id;};
 for(const gap of gaps)if(!gap.claimed&&!kept.some(e=>['door','entrance'].includes(e.kind)&&segDist(gap.center,...e.points.slice(0,2).map(px))<Math.max(3,4*unit))){
  kept.push({id:newId(),kind:'door',label:'Wall opening · type unconfirmed',points:[norm(gap.a),norm(gap.b)],confidence:'low',evidence:'Visible gap between aligned architectural wall ends. Confirm whether it is a door, open passage or window; it is blocked for routing until confirmed.',confirmed:false});
 }
 for(const s of unique)kept.push({id:newId(),kind:'wall',label:s.label||'Source wall',points:[norm(s.a),norm(s.b)],confidence:'medium',evidence:'Wall position fitted to source strokes within an architectural boundary band. Openings require confirmation.',confirmed:false});
 const out=attachSourceEvidence({...result,elements:kept,warnings:[...result.warnings]},imageData);
 out.sourceRefinement={version:1,sourceWidth:w,sourceHeight:h,rejectedHints:[...new Set(rejected)].length};
 return out;
}
