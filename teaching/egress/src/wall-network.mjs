import {dist,lerp,segDist} from './geometry.mjs?v=auto-enclosure-1';

const axis=s=>{const l=dist(s.a,s.b);return{x:(s.b.x-s.a.x)/l,y:(s.b.y-s.a.y)/l,l};};
const dot=(a,b)=>a.x*b.x+a.y*b.y;
const sub=(a,b)=>({x:a.x-b.x,y:a.y-b.y});
const at=(origin,u,t)=>({x:origin.x+u.x*t,y:origin.y+u.y*t});
const angle=(u,v)=>Math.abs(u.x*v.y-u.y*v.x);
const intersection=(s,t)=>{const u=sub(s.b,s.a),v=sub(t.b,t.a),d=u.x*v.y-u.y*v.x;if(Math.abs(d)<1e-8)return null;const w=sub(t.a,s.a),f=(w.x*v.y-w.y*v.x)/d;return at(s.a,u,f);};

// Work in source pixels. A physical wall has one axis even when several
// room boundaries, drawing faces and detail reads refer to it.
export function normalizeWallNetwork(input,{unit=1,supported=()=>false,openingAt=()=>false}={}){
 const eps=Math.max(.6,1.5*unit),join=Math.max(3,10*unit),parallel=.055;
 let lines=input.filter(s=>dist(s.a,s.b)>eps).map(s=>({...s,a:{...s.a},b:{...s.b}}));
 const groups=[];
 for(const s of [...lines].sort((a,b)=>dist(b.a,b.b)-dist(a.a,a.b))){
  const u=axis(s),group=groups.find(g=>angle(u,g.u)<.025);
  if(group){const mid=lerp(s.a,s.b,.5),v=dot(u,group.u)<0?{x:-group.u.x,y:-group.u.y}:group.u;
   const a=at(mid,v,-u.l/2),b=at(mid,v,u.l/2);if(supported(a,b,Math.max(eps,s.band||0))){s.a=a;s.b=b;}
  }else groups.push({u});
 }
 // Different room hints can fit slightly different axes inside the very
 // same thick wall. Remove contained duplicates before they form sliver faces.
 // A genuine folded continuation extends beyond the first run and survives.
 const dominant=[];
 for(const s of [...lines].sort((a,b)=>dist(b.a,b.b)-dist(a.a,a.b))){
  const v=axis(s),duplicate=dominant.some(t=>{
   const u=axis(t);if(angle(u,v)>.16)return false;
   const normal={x:-u.y,y:u.x},ts=[dot(sub(s.a,t.a),u),dot(sub(s.b,t.a),u)],lo=Math.min(...ts),hi=Math.max(...ts);
   const band=Math.max(eps,Math.min(s.band||eps,t.band||eps));
   if(lo< -eps||hi>u.l+eps||Math.max(Math.abs(dot(sub(s.a,t.a),normal)),Math.abs(dot(sub(s.b,t.a),normal)))>band)return false;
   const same=supported(at(t.a,u,Math.max(0,lo)),at(t.a,u,Math.min(u.l,hi)),band);if(same)t.explicit||=s.explicit;return same;
  });
  if(!duplicate)dominant.push(s);
 }
 lines=dominant;
 // Merge to one axis before connecting junctions, then merge once again.
 function collapse(){
  const out=[];
  for(const s of [...lines].sort((a,b)=>(b.score||0)-(a.score||0)||dist(b.a,b.b)-dist(a.a,a.b))){
   let consumed=false;
   for(const t of out){const u=axis(t),v=axis(s);if(angle(u,v)>parallel)continue;
    const normal={x:-u.y,y:u.x},pa=dot(sub(s.a,t.a),u),pb=dot(sub(s.b,t.a),u),lo=Math.min(pa,pb),hi=Math.max(pa,pb);
    const off=Math.max(Math.abs(dot(sub(s.a,t.a),normal)),Math.abs(dot(sub(s.b,t.a),normal)));
    const tolerance=Math.max(eps,Math.min(Math.max(3,12*unit),(s.band||eps)+(t.band||eps)));
    if(off>tolerance||lo>u.l+eps||hi< -eps)continue;
    const overlap=Math.min(hi,u.l)-Math.max(lo,0);if(overlap< -eps)continue;
    // A parallel corridor boundary must not collapse into the opposite wall.
    if(off>eps&&!supported(lerp(s.a,t.a,.5),lerp(s.b,t.b,.5),off/2+eps))continue;
    const origin={...t.a};t.a=at(origin,u,Math.min(0,lo));t.b=at(origin,u,Math.max(u.l,hi));
    t.explicit||=s.explicit;t.band=Math.max(t.band||0,s.band||0);consumed=true;break;
   }if(!consumed)out.push(s);
  }lines=out;
 }
 collapse();
 // All fragments at one ink-supported corner share one junction. Sequential
 // pairwise snaps alone can leave a tiny triangle among three near endpoints.
 const longest=[...lines].sort((a,b)=>dist(b.a,b.b)-dist(a.a,a.b));
 for(let i=0;i<longest.length;i++)for(let j=i+1;j<longest.length;j++){
  const s=longest[i],t=longest[j],u=axis(s),v=axis(t);if(angle(u,v)<.2)continue;
  const q=intersection(s,t);if(!q)continue;
  const radius=Math.min(join,Math.max(eps,s.band||0,t.band||0));
  if(Math.min(dist(q,s.a),dist(q,s.b))>radius||Math.min(dist(q,t.a),dist(q,t.b))>radius||openingAt(q,eps))continue;
  for(const wall of lines)for(const key of ['a','b']){
   const p=wall[key],d=dist(p,q);if(d<=.001||d>radius||openingAt(lerp(p,q,.5),eps))continue;
   if(supported(p,q,Math.max(eps,wall.band||0)))wall[key]={...q};
  }
 }
 lines=lines.filter(s=>dist(s.a,s.b)>eps);collapse();
 // Extend / trim both sides of L junctions together, or snap a T onto its
 // through wall. The support check sees the wall band, including hollow walls.
 for(let pass=0;pass<2;pass++)for(let i=0;i<lines.length;i++)for(let j=i+1;j<lines.length;j++){
  const s=lines[i],t=lines[j],u=axis(s),v=axis(t);if(angle(u,v)<.15)continue;
  const q=intersection(s,t);if(!q)continue;
  const ds=Math.min(dist(q,s.a),dist(q,s.b)),dt=Math.min(dist(q,t.a),dist(q,t.b));
  if(segDist(q,s.a,s.b)>join||segDist(q,t.a,t.b)>join||ds>join&&dt>join)continue;
  if(openingAt(q,Math.max(eps,3*unit)))continue;
  for(const wall of [s,t]){const key=dist(q,wall.a)<dist(q,wall.b)?'a':'b',p=wall[key],d=dist(q,p);
   if(d>join||d<.001)continue;
   if(d<=Math.max(eps,wall.band||0)||supported(p,q,Math.max(eps,wall.band||0)))wall[key]={...q};
  }
 }
 collapse();
 // Recovery from approximate room polygons must not leave loose furniture
 // edges. Explicit architectural walls may legitimately be freestanding.
 lines=lines.filter(s=>s.explicit||[s.a,s.b].every(p=>lines.some(t=>t!==s&&segDist(p,t.a,t.b)<=eps)));
 return lines;
}
