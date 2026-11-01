import {excludedSpaces} from './semantic-plan.mjs?v=recognition-speed-1';
import {area,edges,inside} from './geometry.mjs?v=recognition-speed-1';
import {intersection} from './drafting.mjs?v=recognition-speed-1';

export function floorOpenings(project,index,{includeBase=false}={}){
  const elevation=project.floors[index].elevation;
  return (project.openings||[]).filter(o=>{
    const base=project.floors.find(f=>f.id===o.baseFloorId),top=project.floors.find(f=>f.id===o.throughFloorId);
    return base&&top&&top.elevation>base.elevation&&elevation<=top.elevation&&(includeBase?elevation>=base.elevation:elevation>base.elevation);
  });
}
export function inOpening(project,index,point){return [...floorOpenings(project,index),...excludedSpaces(project.floors[index])].some(o=>inside(point,o.points));}

// Exact area subtraction for simple straight-edged polygons, including concave
// rooms and overlapping voids. Between vertex/intersection x coordinates, each
// scanline interval endpoint is linear; two interior samples integrate the slab.
export function usableArea(polygon,holes=[]){
  if(!holes.length)return area(polygon);if(polygon.length<3)return 0;
  const polygons=[polygon,...holes],allEdges=polygons.flatMap(edges),xs=polygons.flatMap(p=>p.map(q=>q.x));
  for(let i=0;i<allEdges.length;i++)for(let j=i+1;j<allEdges.length;j++){const q=intersection(...allEdges[i],...allEdges[j]);if(q)xs.push(q.x);}
  xs.sort((a,b)=>a-b);const breaks=xs.filter((x,i)=>!i||x-xs[i-1]>1e-9);
  function intervals(poly,x){const ys=[];for(const [a,b]of edges(poly))if((a.x<=x&&b.x>x)||(b.x<=x&&a.x>x))ys.push(a.y+(b.y-a.y)*(x-a.x)/(b.x-a.x));ys.sort((a,b)=>a-b);const out=[];for(let i=0;i+1<ys.length;i+=2)out.push([ys[i],ys[i+1]]);return out;}
  function slice(x){const room=intervals(polygon,x),cuts=holes.flatMap(p=>intervals(p,x)).sort((a,b)=>a[0]-b[0]),merged=[];for(const cut of cuts){const last=merged.at(-1);if(last&&cut[0]<=last[1])last[1]=Math.max(last[1],cut[1]);else merged.push([...cut]);}let sum=0;for(const [a,b]of room){sum+=b-a;for(const [c,d]of merged)sum-=Math.max(0,Math.min(b,d)-Math.max(a,c));}return Math.max(0,sum);}
  let result=0;for(let i=1;i<breaks.length;i++){const a=breaks[i-1],w=breaks[i]-a;result+=w*(slice(a+w*.25)+slice(a+w*.75))/2;}return Math.max(0,result);
}
export function roomArea(project,index,room){return usableArea(room.points,[...[...(room.holes||[]),...(room.autoHoles||[])].map(points=>({points})),...floorOpenings(project,index),...excludedSpaces(project.floors[index])].map(o=>o.points));}
