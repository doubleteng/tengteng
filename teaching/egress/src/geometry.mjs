export const FT = .3048, IN = .0254, SF = .09290304;
export const dist=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
export const lerp=(a,b,t)=>({x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t});
export function area(p){let n=0;for(let i=0,j=p.length-1;i<p.length;j=i++)n+=p[j].x*p[i].y-p[i].x*p[j].y;return Math.abs(n)/2;}
export function inside(p,poly){let c=false;for(let i=0,j=poly.length-1;i<poly.length;j=i++)if(((poly[i].y>p.y)!=(poly[j].y>p.y))&&(p.x<(poly[j].x-poly[i].x)*(p.y-poly[i].y)/(poly[j].y-poly[i].y)+poly[i].x))c=!c;return c;}
export function bounds(points){if(!points.length)return {minX:0,minY:0,maxX:30,maxY:20};return points.reduce((b,p)=>({minX:Math.min(b.minX,p.x),minY:Math.min(b.minY,p.y),maxX:Math.max(b.maxX,p.x),maxY:Math.max(b.maxY,p.y)}),{minX:Infinity,minY:Infinity,maxX:-Infinity,maxY:-Infinity});}
export function project(p,a,b){const d=(b.x-a.x)**2+(b.y-a.y)**2;const t=d?Math.max(0,Math.min(1,((p.x-a.x)*(b.x-a.x)+(p.y-a.y)*(b.y-a.y))/d)):0;return {...lerp(a,b,t),t};}
export const segDist=(p,a,b)=>dist(p,project(p,a,b));
export function crosses(a,b,c,d){const cross=(p,q,r)=>(q.x-p.x)*(r.y-p.y)-(q.y-p.y)*(r.x-p.x);return cross(a,b,c)*cross(a,b,d)<-1e-10 && cross(c,d,a)*cross(c,d,b)<-1e-10;}
export function edges(poly){return poly.map((p,i)=>[p,poly[(i+1)%poly.length]]);}
export function centroid(poly){let a=0,x=0,y=0;for(const [p,q] of edges(poly)){const k=p.x*q.y-q.x*p.y;a+=k;x+=(p.x+q.x)*k;y+=(p.y+q.y)*k;}if(Math.abs(a)<1e-8)return poly[0]||{x:0,y:0};return{x:x/(3*a),y:y/(3*a)};}
export const length=pts=>pts.slice(1).reduce((n,p,i)=>n+dist(pts[i],p),0);
export const uid=()=>globalThis.crypto?.randomUUID?.()||Math.random().toString(36).slice(2);
// A confirmed opening cuts every coincident segment of the same physical wall.
// Distinct parallel walls and missing/offset hosts are never opened implicitly.
export function splitWalls(walls,doors){
 const byId=new Map(walls.map(w=>[w.id,w]));
 const openings=doors.flatMap(d=>{
  const host=byId.get(d.wallId);if(!host||!(d.width>0)||segDist(d,host.a,host.b)>.02)return[];
  const n=dist(host.a,host.b);if(n<.001)return[];
  const t=project(d,host.a,host.b).t,lo=Math.max(0,t-d.width/n/2),hi=Math.min(1,t+d.width/n/2);
  return[{host,a:lerp(host.a,host.b,lo),b:lerp(host.a,host.b,hi)}];
 });
 const out=[];
 for(const w of walls){
  const n=dist(w.a,w.b);if(n<.001)continue;
  const ux=(w.b.x-w.a.x)/n,uy=(w.b.y-w.a.y)/n;
  const along=q=>((q.x-w.a.x)*ux+(q.y-w.a.y)*uy)/n;
  const offset=q=>Math.abs((q.x-w.a.x)*uy-(q.y-w.a.y)*ux);
  const cuts=openings.flatMap(o=>{
   if(offset(o.host.a)>.002||offset(o.host.b)>.002)return[];
   const a=along(o.a),b=along(o.b),lo=Math.max(0,Math.min(a,b)),hi=Math.min(1,Math.max(a,b));
   return hi>lo?[[lo,hi]]:[];
  }).sort((a,b)=>a[0]-b[0]);
  let at=0;for(const [lo,hi]of cuts){if(lo>at)out.push({a:lerp(w.a,w.b,at),b:lerp(w.a,w.b,lo),thickness:w.thickness||.15});at=Math.max(at,hi);}
  if(at<1)out.push({a:lerp(w.a,w.b,at),b:w.b,thickness:w.thickness||.15});
 }
 return out;
}
class Heap{constructor(){this.a=[];}push(n){let a=this.a,i=a.length;a.push(n);while(i){let p=(i-1)>>1;if(a[p][0]<=n[0])break;a[i]=a[p];i=p;}a[i]=n;}pop(){let a=this.a,res=a[0],x=a.pop();if(a.length){let i=0;while(i*2+1<a.length){let c=i*2+1;if(c+1<a.length&&a[c+1][0]<a[c][0])c++;if(a[c][0]>=x[0])break;a[i]=a[c];i=c;}a[i]=x;}return res;}get size(){return this.a.length;}}
export function makeGrid(regions,obstacles=[],walls=[],resolution=.3){const b=bounds(regions.flat());let step=Math.max(resolution,Math.sqrt((b.maxX-b.minX)*(b.maxY-b.minY)/110000));const nx=Math.ceil((b.maxX-b.minX)/step)+1,ny=Math.ceil((b.maxY-b.minY)/step)+1,n=nx*ny;if(n>200000||!Number.isFinite(n))throw Error('Plan extent is too large. Check CAD units or select fewer layers.');const good=new Uint8Array(n);const point=i=>({x:b.minX+(i%nx)*step,y:b.minY+Math.floor(i/nx)*step});for(let i=0;i<n;i++){const p=point(i);good[i]=regions.some(r=>inside(p,r))&&!obstacles.some(r=>inside(p,r))&&!walls.some(w=>segDist(p,w.a,w.b)<(w.thickness||.15)/2+.07)?1:0;}return{...b,nx,ny,n,step,good,point,walls,obstacles,regions};}
export function visible(a,b,g){const n=Math.max(1,Math.ceil(dist(a,b)/(g.step*.45)));for(let k=1;k<n;k++){let p=lerp(a,b,k/n);if(!g.regions.some(r=>inside(p,r))||g.obstacles.some(r=>inside(p,r))||g.walls.some(w=>segDist(p,w.a,w.b)<(w.thickness||.15)/2+.06))return false;}return !g.walls.some(w=>crosses(a,b,w.a,w.b));}
export function nearest(g,p,radius=2,allowBoundary=false){let best=-1,bd=radius;const x=Math.round((p.x-g.minX)/g.step),y=Math.round((p.y-g.minY)/g.step),r=Math.ceil(radius/g.step);for(let yy=Math.max(0,y-r);yy<=Math.min(g.ny-1,y+r);yy++)for(let xx=Math.max(0,x-r);xx<=Math.min(g.nx-1,x+r);xx++){const i=yy*g.nx+xx;if(!g.good[i])continue;let d=dist(p,g.point(i));if(d<bd&&(allowBoundary||visible(p,g.point(i),g))){best=i;bd=d;}}return best;}
export function flood(g,targets){const d=new Float64Array(g.n).fill(Infinity),prev=new Int32Array(g.n).fill(-1),owner=new Int32Array(g.n).fill(-1),h=new Heap;targets.forEach((p,k)=>{const i=nearest(g,p,1.5);if(i<0)return;const v=dist(p,g.point(i));if(v<d[i]){d[i]=v;owner[i]=k;h.push([v,i]);}});while(h.size){const[v,i]=h.pop();if(v>d[i])continue;const x=i%g.nx,y=Math.floor(i/g.nx);for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){if(!dx&&!dy)continue;let xx=x+dx,yy=y+dy;if(xx<0||xx>=g.nx||yy<0||yy>=g.ny)continue;const j=yy*g.nx+xx;if(!g.good[j]||(dx&&dy&&(!g.good[y*g.nx+xx]||!g.good[yy*g.nx+x])))continue;const a=g.point(i),b=g.point(j);if(g.walls.some(w=>crosses(a,b,w.a,w.b)))continue;const nv=v+g.step*Math.hypot(dx,dy);if(nv<d[j]){d[j]=nv;prev[j]=i;owner[j]=owner[i];h.push([nv,j]);}}}return{d,prev,owner,targets};}
export function route(g,f,i){if(i<0||!Number.isFinite(f.d[i]))return[];const pts=[];let j=i,n=0;while(j>=0&&n++<g.n){pts.push(g.point(j));j=f.prev[j];}const target=f.targets[f.owner[i]];if(target)pts.push({x:target.x,y:target.y});return pts;}

export const floorRegions=f=>f.autoBoundary&&f.enclosures?.length?f.enclosures:(f.outline?.length>=3?[f.outline]:[]);
export const insideRoom=(q,r)=>inside(q,r.points)&&![...(r.holes||[]),...(r.autoHoles||[])].some(poly=>inside(q,poly));
export function roomPoint(r){const c=centroid(r.points);if(insideRoom(c,r))return c;const b=bounds(r.points);for(let y=1;y<20;y++)for(let x=1;x<20;x++){const p={x:b.minX+(b.maxX-b.minX)*x/20,y:b.minY+(b.maxY-b.minY)*y/20};if(insideRoom(p,r))return p;}return r.points[0]||c;}
