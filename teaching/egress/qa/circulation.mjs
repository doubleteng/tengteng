import {stairLanding} from './stairs.mjs?v=recognition-speed-1';
import {pendingOpeningBarriers} from './import-quality.mjs?v=recognition-speed-1';
import {makeGrid,flood,route,insideRoom,floorRegions,splitWalls} from './geometry.mjs?v=recognition-speed-1';
import {floorOpenings,inOpening} from './openings.mjs?v=recognition-speed-1';
import {featureObstacles,excludedSpaces} from './semantic-plan.mjs?v=recognition-speed-1';

// An open or unverified stair can be a circulation destination without being
// accepted as an exit. These paths never enter the egress field or capacity sum.
export function stairCirculation(p,fi,roomResults,egressRoutes){
 const f=p.floors[fi],routes=[],notices=[];
 for(const s of f.stairs||[])if(!stairLanding(s))notices.push({id:s.id,name:s.name,point:s.points[0],rooms:0,partial:0,title:(s.name||'Stair')+': direction and landing unknown',detail:'The footprint does not establish the flight direction or current-floor entrance. Trace the path from the real landing using the drawing’s UP/DN arrow, then choose its destination floor. No route is connected to a guessed corner.'});
 const targets=(f.stairs||[]).filter(s=>!s.protected&&f.elevation>0&&stairLanding(s)&&!inOpening(p,fi,stairLanding(s))).map(s=>({...s,...stairLanding(s)}));
 if(!targets.length||!floorRegions(f).length)return {routes,notices};
 const candidates=f.rooms.filter(r=>r.role!=='corridor'&&!egressRoutes.some(x=>x.room===r.id&&x.completeCoverage));
 if(!candidates.length)return {routes,notices};
 const g=makeGrid(floorRegions(f),[...f.obstacles,...floorOpenings(p,fi),...featureObstacles(f),...excludedSpaces(f)].map(o=>o.points),[...splitWalls(f.walls,f.doors),...pendingOpeningBarriers(f)],p.settings.grid||.3),field=flood(g,targets);
 for(const r of candidates){
  const result=roomResults.find(x=>x.id===r.id);let samples=0,unreachable=0,worst=-1,distance=-1,unreachablePoint=null;
  for(let i=0;i<g.n;i++){if(!g.good[i]||!insideRoom(g.point(i),r))continue;samples++;if(!Number.isFinite(field.d[i])){unreachable++;unreachablePoint??=g.point(i);}else if(field.d[i]>distance){worst=i;distance=field.d[i];}}
  const target=worst>=0?targets[field.owner[worst]]:null,state=!samples?'unresolved':worst<0?'blocked':unreachable||result.outsideBoundary?'partial':'connected';
  result.circulation={state,samples,unreachable,distance:worst<0?null:distance,target:target?.id,point:unreachablePoint||result.routePoint};
  if(target){
   routes.push({room:r.id,name:r.name,points:route(g,field,worst),distance,stair:target.id,stairName:target.link||target.name,provisional:true,partial:state!=='connected'});
   if(!result.outsideBoundary&&!egressRoutes.some(x=>x.room===r.id))result.routeReason=`${state==='partial'?'Part of this room is cut off from the stair; add or correct its wall opening. The reachable portion leads':'This room leads'} to ${target.link||target.name}. The route stops at this landing because the stair is not assigned as an exit in the model. No onward travel is included.`;
  }else if(!egressRoutes.some(x=>x.room===r.id)&&!result.outsideBoundary)result.routeReason=samples?'No geometric route to the stair: check door openings and wall connections.':'No walkable samples: check enclosure walls, obstacles and grid size.';
 }
 for(const target of targets){const served=routes.filter(r=>r.stair===target.id),partial=served.filter(r=>r.partial).length;
  notices.push({id:target.id,name:target.link||target.name,point:{x:target.x,y:target.y},rooms:served.length,partial,
   title:(target.name||target.link)+': not assigned as an exit stair',
   detail:`${served.length} room${served.length===1?' has':'s have'} a geometric route to this stair on this floor${partial?'; '+partial+' only partly connected':''}. This stair is modeled as open or unverified, so it is not used as an exit endpoint. Amber lines stop at the landing. Model an eligible exit route and connect its landings to a ground-floor exit and public way. Mark a stair as protected only when that matches the design.`});
 }
 return {routes,notices};
}
