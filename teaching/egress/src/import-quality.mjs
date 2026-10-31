import {dist,project,segDist,edges,inside,crosses,lerp} from './geometry.mjs?v=stair-review-20261031';

// Evidence is a geometric check against source pixels, not a wall classifier.
// Light pencil and gray CAD strokes use local contrast. Uniform gray fills do not.
export function strokeMask({width:w,height:h,data}){
 const gray=new Uint8Array(w*h),sum=new Float64Array((w+1)*(h+1)),mask=new Uint8Array(w*h);
 for(let y=0;y<h;y++){let row=0;for(let x=0;x<w;x++){
  const i=y*w+x,k=i*4,a=data[k+3]/255;gray[i]=Math.round(255*(1-a)+a*(data[k]*.2126+data[k+1]*.7152+data[k+2]*.0722));
  row+=gray[i];sum[(y+1)*(w+1)+x+1]=sum[y*(w+1)+x+1]+row;
 }}
 const r=8;
 for(let y=0;y<h;y++)for(let x=0;x<w;x++){
  const x0=Math.max(0,x-r),y0=Math.max(0,y-r),x1=Math.min(w,x+r+1),y1=Math.min(h,y+r+1),i=y*w+x;
  const mean=(sum[y1*(w+1)+x1]-sum[y0*(w+1)+x1]-sum[y1*(w+1)+x0]+sum[y0*(w+1)+x0])/((x1-x0)*(y1-y0));
  mask[i]=gray[i]<100||(gray[i]<248&&mean-gray[i]>7)?1:0;
 }
 return {width:w,height:h,mask};
}

export function wallEvidence(element,source,openings=[]){
 const {width:w,height:h,mask}=source,px=q=>({x:q[0]*w/1000,y:q[1]*h/1000});
 const gaps=openings.flatMap(e=>e.points.length>=2?[e.points.slice(0,2).map(px)]:[]);
 let supported=0,total=0,longest=0,run=0;
 for(let j=1;j<element.points.length;j++){
  const a=px(element.points[j-1]),b=px(element.points[j]),n=Math.max(1,Math.ceil(dist(a,b))),l=dist(a,b),nx=l?-(b.y-a.y)/l:0,ny=l?(b.x-a.x)/l:0;
  for(let i=0;i<=n;i++){
   const q=lerp(a,b,i/n);
   if(gaps.some(([c,d])=>segDist(q,c,d)<3)){run=0;continue;}
   let hit=false;for(let k=-3;k<=3;k++){const x=Math.round(q.x+nx*k),y=Math.round(q.y+ny*k);if(x>=0&&y>=0&&x<w&&y<h&&mask[y*w+x]){hit=true;break;}}
   total++;if(hit){supported++;run=0;}else longest=Math.max(longest,++run);
  }
 }
 return {coverage:total?supported/total:1,missingPixels:longest,samples:total};
}

export function attachSourceEvidence(result,imageData){
 const source=strokeMask(imageData),openings=result.elements.filter(e=>['door','entrance'].includes(e.kind));
 return {...result,elements:result.elements.map(e=>e.kind==='wall'?{...e,sourceCheck:wallEvidence(e,source,openings)}:e)};
}

// Recover only source-supported runs along architectural boundaries already
// identified by the semantic pass. Furniture polygons never enter this pass.
// Returned walls remain proposals with provenance; gaps are not bridged.
export function recoverBoundaryWalls(result,imageData){
 const source=strokeMask(imageData),{width:w,height:h,mask}=source,px=q=>({x:q[0]*w/1000,y:q[1]*h/1000}),norm=p=>[Math.max(0,Math.min(1000,p.x/w*1000)),Math.max(0,Math.min(1000,p.y/h*1000))];
 const proposed=[],existing=result.elements.filter(e=>e.kind==='wall').flatMap(e=>e.points.slice(1).map((q,i)=>[px(e.points[i]),px(q)]));
 const boundaries=[{id:'outline',points:result.outline},...result.elements.filter(e=>['room','corridor','lobby'].includes(e.kind))];
 let serial=0;
 for(const boundary of boundaries)for(const [a,b] of edges(boundary.points.map(px))){
  const l=dist(a,b);if(l<20)continue;const n=Math.ceil(l),nx=-(b.y-a.y)/l,ny=(b.x-a.x)/l;let run=[];
  const flush=()=>{
   if(run.length>=20){
   const offsets=run.map(p=>p.offset).sort((a,b)=>a-b),offset=offsets[Math.floor(offsets.length/2)],start=run[0].q,end=run.at(-1).q;
    const c={x:start.x+nx*offset,y:start.y+ny*offset},d={x:end.x+nx*offset,y:end.y+ny*offset};
    if(!existing.some(([x,y])=>segDist(c,x,y)<5&&segDist(d,x,y)<5)&&!proposed.some(e=>segDist(c,px(e.points[0]),px(e.points[1]))<5&&segDist(d,px(e.points[0]),px(e.points[1]))<5)){
     let id;do{id='source-wall-'+serial++;}while(result.elements.some(e=>e.id===id));
     proposed.push({id,kind:'wall',label:'Source wall '+serial,points:[norm(c),norm(d)],confidence:'medium',confirmed:false,evidence:'Visible stroke along '+(boundary.label||'floor boundary')+'. Check wall type and junctions.',recovered:true});
    }
   }run=[];
  };
  for(let i=0;i<=n;i++){
   const q=lerp(a,b,i/n),hits=[];
   if(existing.some(([x,y])=>segDist(q,x,y)<4)){flush();continue;}
   for(let k=-5;k<=5;k++){const x=Math.round(q.x+nx*k),y=Math.round(q.y+ny*k);if(x>=0&&y>=0&&x<w&&y<h&&mask[y*w+x])hits.push(k);}
   if(hits.length)run.push({q,offset:(hits[0]+hits.at(-1))/2});else flush();
  }flush();
 }
 return proposed.slice(0,Math.max(0,2000-result.elements.length));
}

export function joinSourceJunctions(result,imageData){
 const copy=structuredClone(result),source=strokeMask(imageData),{width:w,height:h,mask}=source;
 const px=q=>({x:q[0]*w/1000,y:q[1]*h/1000}),norm=q=>[q.x/w*1000,q.y/h*1000];
 const segments=copy.elements.filter(e=>e.kind==='wall').flatMap(e=>e.points.slice(1).map((q,i)=>({e,i,a:px(e.points[i]),b:px(q)})));
 const openings=copy.elements.filter(e=>['door','entrance'].includes(e.kind)).map(e=>e.points.slice(0,2).map(px));
 let joined=0;
 for(const s of segments)for(const key of ['a','b']){
  const p=s[key],index=s.i+(key==='b'?1:0);if(openings.some(([a,b])=>segDist(p,a,b)<6))continue;
  const l=dist(s.a,s.b);if(!l)continue;
  const targets=segments.filter(t=>t.e!==s.e||t.i!==s.i).flatMap(t=>{
   const q=project(p,t.a,t.b),d=dist(p,q),n=dist(t.a,t.b);if(d<.05||d>3||!n)return[];
   const parallel=Math.abs((s.b.x-s.a.x)*(t.b.y-t.a.y)-(s.b.y-s.a.y)*(t.b.x-t.a.x))/(l*n)<.2;
   if(parallel&&Math.min(dist(p,t.a),dist(p,t.b))>1)return[];
   for(let k=0;k<=Math.ceil(d*2);k++){
    const v=lerp(p,q,k/Math.ceil(d*2));let ink=false;
    for(let dx=-1;dx<=1;dx++)for(let dy=-1;dy<=1;dy++){const x=Math.round(v.x)+dx,y=Math.round(v.y)+dy;if(x>=0&&y>=0&&x<w&&y<h&&mask[y*w+x])ink=true;}
    if(!ink)return[];
   }return [{q,d}];
  }).sort((a,b)=>a.d-b.d);
  if(targets.length){s.e.points[index]=norm(targets[0].q);joined++;}
 }
 return {interpretation:copy,joined};
}

// A door must lie on a parallel host with room for its full width. If the
// original drawing has a real gap, two collinear jamb ends can host a portal.
export function openingHost(walls,points,width=dist(...points.slice(0,2)),tolerance=.08){
 const [a,b]=points,span=dist(a,b);if(!(span>.001))return {error:'Opening has coincident jambs.'};
 const center=lerp(a,b,.5),u={x:(b.x-a.x)/span,y:(b.y-a.y)/span};
 const parallel=walls.filter(w=>{const n=dist(w.a,w.b);return n>.001&&Math.abs((w.b.x-w.a.x)/n*u.y-(w.b.y-w.a.y)/n*u.x)<.12;});
 const hosts=parallel.filter(w=>{
  const q=project(center,w.a,w.b),n=dist(w.a,w.b);return dist(q,center)<=tolerance&&q.t*n>=width/2-.005&&(1-q.t)*n>=width/2-.005;
 }).sort((x,y)=>segDist(center,x.a,x.b)-segDist(center,y.a,y.b));
 if(hosts.length){const best=hosts[0];if(hosts.some(w=>w!==best&&segDist(center,w.a,w.b)<tolerance&&Math.abs(segDist(center,w.a,w.b)-segDist(center,best.a,best.b))<.01&&segDist(w.a,best.a,best.b)>.015))return {error:'Opening lies between competing wall faces. Choose the wall centerline.'};return {wall:best,center:project(center,best.a,best.b)};}
 const ends=q=>parallel.flatMap(w=>['a','b'].filter(k=>dist(w[k],q)<=tolerance).map(k=>({w,q:w[k]})));
 const pairs=[];for(const left of ends(a))for(const right of ends(b))if(left.w!==right.w){
  // Both wall segments must extend away from the doorway, not into it.
  const mid=lerp(left.q,right.q,.5);
  if(segDist(mid,left.w.a,left.w.b)>span*.35&&segDist(mid,right.w.a,right.w.b)>span*.35)pairs.push({left,right});
 }
 if(pairs.length===1){const {left,right}=pairs[0];if(width>dist(left.q,right.q)+.01)return {error:'Clear width exceeds the drawn gap between jambs.'};return {gap:{a:{...left.q},b:{...right.q},thickness:Math.max(left.w.thickness||.15,right.w.thickness||.15)},center:lerp(left.q,right.q,.5)};}
 return {error:'Opening has no aligned wall host or matching jamb ends. Move its jambs or restore the missing wall.'};
}

export function openingSpaces(floor,points){
 const [a,b]=points,l=dist(a,b);if(!l)return {sides:[[],[]],labels:['Unknown','Unknown']};
 const c=lerp(a,b,.5),normal={x:-(b.y-a.y)/l,y:(b.x-a.x)/l},sides=[[],[]];
 for(let side=0;side<2;side++)for(const offset of [.06,.15,.3]){
  const q={x:c.x+normal.x*offset*(side?1:-1),y:c.y+normal.y*offset*(side?1:-1)};
  const found=floor.rooms.filter(r=>inside(q,r.points));
  if(found.length){sides[side]=found.map(r=>r.id);break;}
  if(floor.outline?.length>=3&&!inside(q,floor.outline)){sides[side]=['outside'];break;}
 }
 return {sides,labels:sides.map(ids=>ids.map(id=>id==='outside'?'Outdoors':floor.rooms.find(r=>r.id===id)?.name||id).join(' / ')||'Unassigned space')};
}

// Never closes a gap or invents a partition. All findings have a location and
// actionable reason. Connectivity is proposed until an opening is confirmed.
export function auditImport(floor,{tolerance=.025,gapLimit=.25}={}){
 const issues=[],connections=[],walls=floor.walls||[],rooms=floor.rooms||[],candidates=floor.candidates||[];
 const issue=(code,title,detail,objectId,point)=>issues.push({code,title,detail,objectId,point});
 for(const w of walls){
  const evidence=w.recognition?.sourceCheck;
  if(evidence&&!w.recognition?.reviewed&&(evidence.coverage<.55||evidence.missingPixels>30))issue('source-wall','Wall is not supported along its full length','Compare the marked wall with the original. Correct it, remove it, or confirm the visible wall.',w.id,lerp(w.a,w.b,.5));
  if(w.recognition?.confidence==='low'&&!w.recognition?.reviewed)issue('uncertain-wall','Wall type is uncertain',w.recognition.evidence||'Check whether this is a partition, furniture or drawing annotation.',w.id,lerp(w.a,w.b,.5));
 }
 for(let i=0;i<walls.length;i++){
  const w=walls[i];for(let j=i+1;j<walls.length;j++){
   const v=walls[j];if((dist(w.a,v.a)<.005&&dist(w.b,v.b)<.005)||(dist(w.a,v.b)<.005&&dist(w.b,v.a)<.005))issue('duplicate-wall','Two walls occupy the same line','Keep one wall so door hosting and editing stay unambiguous.',v.id,lerp(v.a,v.b,.5));
  }
  for(const key of ['a','b']){
   const q=w[key];if(walls.some(v=>v!==w&&segDist(q,v.a,v.b)<=tolerance))continue;
   const near=walls.filter(v=>v!==w).map(v=>({v,d:segDist(q,v.a,v.b)})).filter(o=>o.d>tolerance&&o.d<gapLimit).sort((a,b)=>a.d-b.d)[0];
   if(near&&!candidates.some(c=>segDist(q,...c.points.slice(0,2))<gapLimit))issue('wall-gap','Wall stops before the junction',`Gap ${(near.d*1000).toFixed(0)} mm. Snap this endpoint to the adjacent wall only if the source shows a junction.`,w.id,q);
  }
 }
 for(const c of candidates){
  const host=openingHost(walls,c.points),spaces=openingSpaces(floor,c.points);connections.push({id:c.id,...spaces,hosted:!host.error});
  if(host.error)issue('opening-host',c.name+': no matching wall',host.error,c.id,lerp(...c.points.slice(0,2),.5));
  if(spaces.sides.some(s=>!s.length)||spaces.sides[0].some(id=>spaces.sides[1].includes(id)))issue('opening-spaces',c.name+': space connection is unclear',spaces.labels.join(' ↔ ')+'. Correct the room boundary or the jamb position.',c.id,lerp(...c.points.slice(0,2),.5));
 }
 for(const r of rooms){
  const es=edges(r.points);let crossing=false;for(let i=0;i<es.length;i++)for(let j=i+1;j<es.length;j++)if(crosses(...es[i],...es[j]))crossing=true;
  if(crossing)issue('room-crossing',r.name+': boundary crosses itself','Move the crossing corners before using this area or occupant load.',r.id,r.points[0]);
  if(r.role==='room')for(const [a,b] of es){
   const l=dist(a,b);if(l<.6)continue;let run=0,start=0,longest=0,location=null;const n=Math.ceil(l/.15);
   for(let i=0;i<=n;i++){
    const q=lerp(a,b,i/n),covered=walls.some(w=>segDist(q,w.a,w.b)<Math.max(.12,(w.thickness||.15)/2+.05))||candidates.some(c=>segDist(q,...c.points.slice(0,2))<.2)||(floor.doors||[]).some(d=>dist(q,d)<d.width/2+.2);
    if(covered)run=0;else{if(!run)start=i;if(++run>longest){longest=run;location=lerp(a,b,(start+i)/2/n);}}
   }
   if(longest*l/n>.6)issue('room-boundary',r.name+': boundary has no wall or opening','A wall may be missing here, or this may be an open connection. Compare the source and add the wall or passage; do not seal it automatically.',r.id,location);
  }
  if(!candidates.some(c=>c.points.some(q=>es.some(([a,b])=>segDist(q,a,b)<.3)))&&!(floor.doors||[]).some(d=>es.some(([a,b])=>segDist(d,a,b)<.3)))issue('room-opening',r.name+': no opening identified','Add the missing door or open passage. For an open use area, confirm its connection to adjoining circulation.',r.id,r.points[0]);
 }
 return {issues,connections,counts:{walls:walls.length,rooms:rooms.length,openings:candidates.length}};
}

export function pendingOpeningBarriers(floor){return (floor.candidates||[]).filter(c=>c.points?.length>=2).map(c=>({a:c.points[0],b:c.points[1],thickness:.15,pendingOpening:true}));}
