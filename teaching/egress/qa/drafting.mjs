import {dist, project, edges, lerp, segDist} from './geometry.mjs?v=topology-rebuild-2';

export function zoomAt(camera, screen, viewport, factor) {
  const x=(screen.x-viewport.x-viewport.w/2)/camera.s;
  const y=-(screen.y-viewport.y-viewport.h/2)/camera.s;
  const next=Math.max(.2,Math.min(800,camera.s*factor));
  camera.x+=x-x*camera.s/next;
  camera.y+=y-y*camera.s/next;
  camera.s=next;
}

export function intersection(a,b,c,d) {
  const ux=b.x-a.x,uy=b.y-a.y,vx=d.x-c.x,vy=d.y-c.y,den=ux*vy-uy*vx;
  if(Math.abs(den)<1e-10)return null;
  const t=((c.x-a.x)*vy-(c.y-a.y)*vx)/den,u=((c.x-a.x)*uy-(c.y-a.y)*ux)/den;
  return t>=-1e-8&&t<=1+1e-8&&u>=-1e-8&&u<=1+1e-8?lerp(a,b,t):null;
}

// Only geometry visible in the current viewport participates in object snapping.
export function snapGeometry(scope, visibility={}, excludeId=null) {
  const segments=[],points=[];
  const segment=(a,b,id)=>{if(id!==excludeId)segments.push({a,b});};
  const poly=(o,closed=true)=>{if(o.id===excludeId)return;for(const [a,b] of closed?edges(o.points):o.points.slice(1).map((b,i)=>[o.points[i],b]))segment(a,b,o.id);};
  if(visibility.walls!==false)for(const w of scope.walls||[])segment(w.a,w.b,w.id);
  if(scope.outline?.length&&visibility.footprints!==false)poly({points:scope.outline});
  for(const [key,layer]of [['rooms','rooms'],['stairs','stairs'],['obstacles','obstacles'],['walkable','walkable']])
    if(visibility[layer]!==false)for(const o of scope[key]||[])poly(o);
  for(const o of [...scope.routes||[],...scope.traces||[]])if(visibility[o.kind]!==false&&visibility.routes!==false)poly(o,false);
  if(visibility.doors!==false)for(const d of scope.doors||[])if(d.id!==excludeId)points.push({x:d.x,y:d.y,kind:d.exit?'Exit':'Point'});
  if(visibility.targets!==false)for(const d of scope.targets||[])if(d.id!==excludeId)points.push({x:d.x,y:d.y,kind:'Point'});
  if(visibility.cad!==false){const hidden=new Set((scope.layers||[]).filter(l=>l.visible===false).map(l=>l.id));for(const s of scope.cad||[])if(s.visible!==false&&!hidden.has(s.layer))segment(s.a,s.b);}
  return {segments,points};
}

export function objectSnap(raw, geometry, {tolerance=.2, enabled=true, grid=0, anchor=null, ortho=false}={}) {
  const constrained=ortho&&anchor?(Math.abs(raw.x-anchor.x)>=Math.abs(raw.y-anchor.y)?{x:raw.x,y:anchor.y}:{x:anchor.x,y:raw.y}):{...raw};
  const query=ortho&&anchor?constrained:raw,axis=ortho&&anchor?(constrained.y===anchor.y?'horizontal':'vertical'):null;
  const candidates=[];
  const add=(point,kind,priority=0)=>{
    if(ortho&&anchor&&(axis==='horizontal'?Math.abs(point.y-anchor.y):Math.abs(point.x-anchor.x))>1e-6)return;
    const distance=dist(query,point);if(distance<=tolerance)candidates.push({point:{x:point.x,y:point.y},kind,priority,distance});
  };
  if(enabled){
    for(const point of geometry.points)add(point,point.kind||'Point');
    // Proximity filtering also bounds the cost of pairwise intersection tests.
    const nearby=[];
    for(const s of geometry.segments){
      if(query.x<Math.min(s.a.x,s.b.x)-tolerance||query.x>Math.max(s.a.x,s.b.x)+tolerance||query.y<Math.min(s.a.y,s.b.y)-tolerance||query.y>Math.max(s.a.y,s.b.y)+tolerance)continue;
      add(s.a,'End');add(s.b,'End');add(lerp(s.a,s.b,.5),'Mid');
      const q=project(query,s.a,s.b);add(q,'Near',1);
      if(axis){const den=axis==='horizontal'?s.b.y-s.a.y:s.b.x-s.a.x;if(Math.abs(den)>1e-10){const t=(axis==='horizontal'?anchor.y-s.a.y:anchor.x-s.a.x)/den;if(t>=0&&t<=1)add(lerp(s.a,s.b,t),'Int');}}
      if(anchor){const foot=project(anchor,s.a,s.b);if(foot.t>0&&foot.t<1)add(foot,'Perp');}
      if(segDist(query,s.a,s.b)<=tolerance)nearby.push(s);
    }
    nearby.sort((a,b)=>segDist(query,a.a,a.b)-segDist(query,b.a,b.b));
    const local=nearby.slice(0,64);
    for(let i=0;i<local.length;i++)for(let j=i+1;j<local.length;j++){const q=intersection(local[i].a,local[i].b,local[j].a,local[j].b);if(q)add(q,'Int');}
  }
  candidates.sort((a,b)=>a.priority-b.priority||a.distance-b.distance);
  if(candidates.length)return candidates[0];
  let point={...constrained};
  if(grid>0){point={x:Math.round(point.x/grid)*grid,y:Math.round(point.y/grid)*grid};if(ortho&&anchor){if(constrained.x===anchor.x)point.x=anchor.x;else point.y=anchor.y;}}
  return {point,kind:ortho&&anchor?'Ortho':grid>0?'Grid':'',distance:0};
}

export function calibrateImage(image,a,b,actual) {
  const measured=dist(a,b);
  if(!(measured>1e-6)||!(actual>0)||!Number.isFinite(actual))throw Error('Pick two different points and enter a positive real distance.');
  const ratio=actual/measured;
  return {...image,x:a.x+(image.x-a.x)*ratio,y:a.y+(image.y-a.y)*ratio,width:image.width*ratio,height:image.height*ratio,calibrated:true,calibration:{distance:actual,method:'two-point'}};
}

// A shared link name is not sufficient when stair footprints do not overlap in XY.
export function stairAligned(a,b,tolerance=.3) {
  return a.points.some(p=>b.points.some(q=>dist(p,q)<=tolerance)) ||
    edges(a.points).some(([p,q])=>edges(b.points).some(([r,s])=>intersection(p,q,r,s))) ||
    a.points.some(p=>pointInside(p,b.points)) || b.points.some(p=>pointInside(p,a.points));
}
function pointInside(p,poly){let hit=false;for(let i=0,j=poly.length-1;i<poly.length;j=i++)if((poly[i].y>p.y)!==(poly[j].y>p.y)&&p.x<(poly[j].x-poly[i].x)*(p.y-poly[i].y)/(poly[j].y-poly[i].y)+poly[i].x)hit=!hit;return hit;}

export function alignmentTransform(source,target) {
  const a=dist(...source),b=dist(...target);
  if(a<.01||b<.01)throw Error('Choose two different, well-separated reference points.');
  if(Math.abs(a-b)/Math.max(a,b)>.01)throw Error('Reference distances differ by more than 1%. Check units or calibrate the PDF before alignment. Alignment does not rescale the floor.');
  const angle=Math.atan2(target[1].y-target[0].y,target[1].x-target[0].x)-Math.atan2(source[1].y-source[0].y,source[1].x-source[0].x);
  const c=Math.cos(angle),s=Math.sin(angle);
  return {angle,point:q=>({x:target[0].x+c*(q.x-source[0].x)-s*(q.y-source[0].y),y:target[0].y+s*(q.x-source[0].x)+c*(q.y-source[0].y)})};
}

export function alignFloor(floor,transform) {
  for(const key of ['spaceSeeds','pendingSpaces'])for(const s of floor[key]||[])s.point=transform.point(s.point);
  const seen=new WeakSet(),move=q=>{if(seen.has(q))return;seen.add(q);Object.assign(q,transform.point(q));};
  floor.outline.forEach(move);for(const poly of floor.enclosures||[])poly.forEach(move);
  for(const key of ['walls','doors','rooms','stairs','obstacles','traces','cad','features','candidates'])for(const o of floor[key]||[]){
    if(o.points)o.points.forEach(move);if(o.flightPath)o.flightPath.forEach(move);for(const poly of [...o.holes||[],...o.autoHoles||[]])poly.forEach(move);if(o.a){move(o.a);move(o.b);}if(o.x!=null)move(o);
  }
  if(floor.image){move(floor.image);floor.image.rotation=(floor.image.rotation||0)+transform.angle;}
}
