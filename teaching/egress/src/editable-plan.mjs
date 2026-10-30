import {dist,project,segDist,edges,area,centroid,uid} from './geometry.mjs';
import {intersection} from './drafting.mjs';

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
  floor.outline=original.outline.map(q=>near(q,.025)?transform(q):{...q});
  for(const before of original.rooms){const current=floor.rooms.find(r=>r.id===before.id);if(!current)continue;const tolerance=Math.max(.025,(old.thickness||.15)/2+.12),attached=new Set();for(let i=0;i<before.points.length;i++){const x=before.points[i],y=before.points[(i+1)%before.points.length];if(near(x,tolerance)&&near(y,tolerance)&&dist(x,y)>.05){attached.add(i);attached.add((i+1)%before.points.length);}}current.points=before.points.map((q,i)=>attached.has(i)?transform(q):{...q});}
  for(const d of floor.doors){const before=original.doors.find(o=>o.id===d.id),w=floor.walls.find(w=>w.id===d.wallId),ow=original.walls.find(w=>w.id===d.wallId);if(!before||!w||!ow)continue;const t=project(before,ow.a,ow.b).t;d.x=w.a.x+(w.b.x-w.a.x)*t;d.y=w.a.y+(w.b.y-w.a.y)*t;}
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
  return {faces,outline:outer[0]||[],components:outer.length};
}

export function roomsFromFaces(faces,previous=[]){
  const used=new Set();return faces.map((points,i)=>{
    const c=centroid(points);let before=null,dd=Infinity;for(const r of previous)if(!used.has(r.id)){const d=dist(c,centroid(r.points));if(d<dd){dd=d;before=r;}}
    if(before)used.add(before.id);
    return {...(before||{id:uid(),name:'Room '+(i+1),function:'business',group:'B',factor:150,basis:'gross'}),points:points.map(p=>({...p})),areaConfirmed:false,fromWalls:true};
  });
}
