import {openingHost} from './import-quality.mjs?v=portal-network-1';
import {dist,project,segDist,edges,area,centroid,inside,insideRoom,roomPoint,uid} from './geometry.mjs?v=portal-network-1';
import {intersection} from './drafting.mjs?v=portal-network-1';

// Carry connected junctions, adjacent room edges, floor corners and attached
// doors through a wall drag from a stable pointer-down snapshot.
export function moveWall(floor,id,a,b,original){
  const old=original.walls.find(w=>w.id===id),wall=floor.walls.find(w=>w.id===id);if(!old||!wall)return;
  const oldLength=dist(old.a,old.b),newLength=dist(a,b);if(oldLength<.01||newLength<.01)return;
  const u={x:(old.b.x-old.a.x)/oldLength,y:(old.b.y-old.a.y)/oldLength},v={x:(b.x-a.x)/newLength,y:(b.y-a.y)/newLength};
  const transform=q=>{const t=project(q,old.a,old.b).t,offset=(q.x-old.a.x)*-u.y+(q.y-old.a.y)*u.x;return{x:a.x+(b.x-a.x)*t-v.y*offset,y:a.y+(b.y-a.y)*t+v.x*offset};};
  wall.a={...a};wall.b={...b};
  for(const before of original.walls){if(before.id===id)continue;const current=floor.walls.find(w=>w.id===before.id);if(!current)continue;for(const key of ['a','b'])if(dist(before[key],old.a)<.02||dist(before[key],old.b)<.02||segDist(before[key],old.a,old.b)<.01)current[key]=transform(before[key]);}
  const near=(q,tol)=>segDist(q,old.a,old.b)<tol;
  if(original.enclosures)floor.enclosures=original.enclosures.map(poly=>poly.map(q=>near(q,.025)?transform(q):{...q}));
  floor.outline=original.outline.map(q=>near(q,.025)?transform(q):{...q});
  for(const before of original.rooms){const current=floor.rooms.find(r=>r.id===before.id);if(!current)continue;const tolerance=Math.max(.025,(old.thickness||.15)/2+.12),attached=new Set();for(let i=0;i<before.points.length;i++){const x=before.points[i],y=before.points[(i+1)%before.points.length];if(near(x,tolerance)&&near(y,tolerance)&&dist(x,y)>.05){attached.add(i);attached.add((i+1)%before.points.length);}}current.points=before.points.map((q,i)=>attached.has(i)?transform(q):{...q});}
  for(const d of floor.doors){const before=original.doors.find(o=>o.id===d.id),w=floor.walls.find(w=>w.id===d.wallId),ow=original.walls.find(w=>w.id===d.wallId);if(!before||!w||!ow)continue;const t=project(before,ow.a,ow.b).t;d.x=w.a.x+(w.b.x-w.a.x)*t;d.y=w.a.y+(w.b.y-w.a.y)*t;}
  for(const c of floor.candidates||[]){const before=(original.candidates||[]).find(o=>o.id===c.id);if(before)c.points=before.points.map(q=>near(q,Math.max(.025,(old.thickness||.15)/2+.08))?transform(q):{...q});}
}

// Find enclosed faces of a straight wall-centerline graph. Gaps remain gaps;
// no convex hull or invented door/wall is used to close an incomplete plan.
export function enclosedRooms(walls,{tolerance=.02,minArea=.5}={}){
  if(walls.length>1500)throw Error('Room detection supports up to 1,500 analysis walls. Simplify dense linework first.');
  const cuts=walls.map(w=>[w.a,w.b]);
  for(let i=0;i<walls.length;i++)for(let j=i+1;j<walls.length;j++){
    const a=walls[i],b=walls[j],q=intersection(a.a,a.b,b.a,b.b);if(q){cuts[i].push(q);cuts[j].push(q);}
    for(const point of [a.a,a.b])if(segDist(point,b.a,b.b)<tolerance)cuts[j].push(project(point,b.a,b.b));
    for(const point of [b.a,b.b])if(segDist(point,a.a,a.b)<tolerance)cuts[i].push(project(point,a.a,a.b));
  }
  const nodes=[],buckets=new Map(),adj=[];
  const node=q=>{const x=Math.round(q.x/tolerance),y=Math.round(q.y/tolerance);for(let dx=-1;dx<=1;dx++)for(let dy=-1;dy<=1;dy++)for(const i of buckets.get(`${x+dx},${y+dy}`)||[])if(dist(q,nodes[i])<tolerance)return i;const id=nodes.length;nodes.push({x:q.x,y:q.y});adj.push(new Set());const key=`${x},${y}`;if(!buckets.has(key))buckets.set(key,[]);buckets.get(key).push(id);return id;};
  walls.forEach((w,i)=>{const points=cuts[i].sort((a,b)=>project(a,w.a,w.b).t-project(b,w.a,w.b).t);for(let j=1;j<points.length;j++){const a=node(points[j-1]),b=node(points[j]);if(a!==b){adj[a].add(b);adj[b].add(a);}}});
  const ordered=adj.map((list,i)=>[...list].sort((a,b)=>Math.atan2(nodes[a].y-nodes[i].y,nodes[a].x-nodes[i].x)-Math.atan2(nodes[b].y-nodes[i].y,nodes[b].x-nodes[i].x)));
  const seen=new Set(),faces=[],outer=[];
  for(let from=0;from<nodes.length;from++)for(const to of ordered[from]){
    if(seen.has(`${from}:${to}`))continue;let a=from,b=to,points=[],closed=false;
    for(let guard=0;guard<nodes.length*4+10;guard++){const key=`${a}:${b}`;if(seen.has(key))break;seen.add(key);points.push(nodes[a]);const nexts=ordered[b],reverse=nexts.indexOf(a),next=nexts[(reverse-1+nexts.length)%nexts.length];a=b;b=next;if(a===from&&b===to){closed=true;break;}}
    if(!closed||points.length<3)continue;
    // Remove immediate out-and-back spurs before classifying a closed face.
    let changed=true;while(changed&&points.length>=3){changed=false;for(let i=0;i<points.length;i++)if(dist(points[(i+points.length-1)%points.length],points[(i+1)%points.length])<tolerance){points.splice(i,1);changed=true;break;}}
    const signed=edges(points).reduce((n,[a,b])=>n+a.x*b.y-b.x*a.y,0)/2;
    if(signed>=minArea)faces.push(points);else if(signed<=-minArea)outer.push(points.slice().reverse());
  }
  outer.sort((a,b)=>area(b)-area(a));
  return {faces,outline:outer[0]||[],outlines:outer.filter(poly=>!outer.some(other=>other!==poly&&area(other)>area(poly)&&contained(poly,other))),components:outer.length};
}

const contained=(poly,outer)=>poly.every(q=>inside(q,outer)||edges(outer).some(([a,b])=>segDist(q,a,b)<.002));
export function roomsFromFaces(faces,previous=[],reservedNames=[]){
 const used=new Set(),names=new Set([...previous.map(r=>r.name),...reservedNames]);
 const nextName=()=>{let n=1;while(names.has('Room '+n))n++;names.add('Room '+n);return 'Room '+n;};
 return faces.map(points=>{
  const c=centroid(points);let before=null,dd=Infinity;
  for(const r of previous)if(!used.has(r.id)&&(inside(c,r.points)||inside(centroid(r.points),points))){const d=dist(c,centroid(r.points));if(d<dd){dd=d;before=r;}}
  if(before)used.add(before.id);
  const holes=faces.filter(poly=>poly!==points&&area(poly)<area(points)-.001&&contained(poly,points)).map(poly=>poly.map(q=>({...q})));
  const same=before&&Math.abs(area(before.points)-area(points))<.001&&contained(points,before.points)&&contained(before.points,points)&&JSON.stringify(before.holes||[])===JSON.stringify(holes);
  return {...(before||{id:uid(),name:nextName(),function:'business',group:'B',factor:150,basis:'gross'}),points:points.map(q=>({...q})),holes,areaConfirmed:same?!!before.areaConfirmed:false,fromWalls:true};
 });
}

const roomFields=['id','name','function','group','factor','basis','role','targetArea','clearWidth','recognition','sourceNote'];
const roomAttributes=r=>Object.fromEntries(roomFields.filter(k=>r[k]!==undefined).map(k=>[k,structuredClone(r[k])]));

// Room polygons are a cache of wall-graph faces. Labels/use assignments are
// points with metadata, never a second editable source of area geometry.
export function enableWallRooms(floor){
 if(floor.roomGeometry!=='walls'){
  floor.spaceSeeds=(floor.rooms||[]).map(r=>({...roomAttributes(r),point:roomPoint(r)}));
  floor.roomGeometry='walls';
 }
 return syncEnclosedRooms(floor);
}

export function assignRoomUse(floor,room){
 if(floor.roomGeometry!=='walls')return;
 const ids=new Set(room.seedIds||[]);
 floor.spaceSeeds=(floor.spaceSeeds||[]).filter(s=>!ids.has(s.id)&&s.id!==room.id);
 floor.spaceSeeds.push({...roomAttributes(room),point:roomPoint(room)});
 room.seedIds=[room.id];room.useNeedsConfirmation=false;
}

function syncWallRooms(floor){
 const previous=floor.rooms||[];
 floor.spaceSeeds??=[];
 // Carry edited room functions into the label records before regenerating.
 for(const r of previous)if(r.seedIds?.length===1){const seed=floor.spaceSeeds.find(s=>s.id===r.seedIds[0]);if(seed){Object.assign(seed,roomAttributes(r));seed.point=roomPoint(r);}}
 const portals=(floor.candidates||[]).filter(c=>c.points?.length>=2&&!openingHost(floor.walls,c.points).error).map(c=>({id:'area-opening-'+c.id,a:c.points[0],b:c.points[1],areaPortal:true}));
 const result=enclosedRooms([...floor.walls,...portals],{minArea:.05});
 let cells=roomsFromFaces(result.faces,previous).map(r=>({...r,geometrySource:'walls',fromWalls:true}));
 // Exterior/courtyard and floor-void polygons classify cells, not partitions.
 cells=cells.filter(r=>!(floor.features||[]).some(f=>['exterior','courtyard','void'].includes(f.kind)&&r.points.every(q=>inside(q,f.points)||edges(f.points).some(([a,b])=>segDist(q,a,b)<.01))));
 for(const seed of floor.spaceSeeds){const old=previous.find(r=>r.id===seed.id&&r.geometrySource==='walls'),cell=old&&cells.find(r=>r.id===old.id);if(cell)seed.point=roomPoint(cell);}
 const assigned=new Set();
 for(const cell of cells){
  const seeds=floor.spaceSeeds.filter(s=>insideRoom(s.point,cell));
  if(seeds.length){
   for(const s of seeds)assigned.add(s.id);
   const primary=seeds.find(s=>s.role!=='corridor'&&s.role!=='lobby')||seeds[0];
   Object.assign(cell,roomAttributes(primary));cell.seedIds=seeds.map(s=>s.id);cell.useNeedsConfirmation=false;
   if(seeds.length>1){cell.name=[...new Set(seeds.map(s=>s.name))].join(' / ').slice(0,180);cell.useNeedsConfirmation=true;cell.areaConfirmed=false;}
  }else{cell.seedIds=[];cell.useNeedsConfirmation=true;}
 }
 floor.rooms=cells.sort((a,b)=>{
  const order=r=>r.seedIds?.length?floor.spaceSeeds.findIndex(s=>s.id===r.seedIds[0]):100000;
  return order(a)-order(b);
 });
 floor.pendingSpaces=floor.spaceSeeds.filter(s=>!assigned.has(s.id)).map(s=>({...s,reason:'No closed wall enclosure surrounds this space. Close the missing wall or add the actual opening; area and people are not counted yet.'}));
 floor.autoRooms=true;
 if(floor.autoBoundary||!floor.outline.length){floor.autoBoundary=true;floor.enclosures=result.outlines.map(poly=>poly.map(q=>({...q})));floor.outline=floor.enclosures[0]||[];}
 return result;
}
// Rebuild after a topology edit, not after display or occupancy changes.
export function syncEnclosedRooms(floor){
 if(floor.roomGeometry==='walls')return syncWallRooms(floor);
 if(floor.recognition&&!floor.semanticRooms)return enableWallRooms(floor);
 const result=enclosedRooms(floor.walls,{minArea:.05});
 if(floor.semanticRooms&&!floor.autoRooms){
  const manual=floor.walls.filter(w=>!w.recognition&&!w.semanticBase);
  const faces=result.faces.filter(poly=>area(poly)<area(floor.outline)-.001&&manual.some(w=>edges(poly).some(([a,b])=>segDist(w.a,a,b)<.002&&segDist(w.b,a,b)<.002)));
  const additions=roomsFromFaces(faces,floor.rooms.filter(r=>r.autoClosed),floor.rooms.map(r=>r.name)).map(r=>({...r,autoClosed:true}));
  const retained=floor.rooms.filter(r=>!r.autoClosed);for(const r of retained)r.autoHoles=additions.map(o=>o.points);
  floor.rooms=[...retained,...additions];return result;
 }
 floor.rooms=roomsFromFaces(result.faces,floor.rooms);
 floor.autoRooms=true;
 if(floor.autoBoundary||!floor.outline.length){floor.autoBoundary=true;floor.enclosures=result.outlines.map(poly=>poly.map(q=>({...q})));floor.outline=floor.enclosures[0]||[];}
 return result;
}
