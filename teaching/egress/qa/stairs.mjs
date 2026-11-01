import {dist} from './geometry.mjs?v=topology-rebuild-2';

// A footprint's first vertex and bounding box say nothing about its flights.
export function confirmedStairPath(stair){
 const path=stair.flightPath;
 return stair.navigationConfirmed===true&&['up','down'].includes(stair.direction)&&Array.isArray(path)&&path.length>=2&&path.every(q=>Number.isFinite(q.x)&&Number.isFinite(q.y))&&path.some(q=>dist(q,path[0])>.05)?path:null;
}
export function stairLanding(stair){
 const path=confirmedStairPath(stair);
 if(path)return path[0];
 // Existing authored study models used an explicit first-corner landing.
 // Never extend that legacy convention to recognition or new stair objects.
 return !stair.recognition&&stair.navigationConfirmed==null?stair.points?.[0]||null:null;
}
export function stairCanDescend(stair){return !!stairLanding(stair)&&(!confirmedStairPath(stair)||stair.direction==='down');}
export function stairConnectionProblem(stair,landing,lowerFloor){
 if(!stairLanding(stair)||!stairLanding(landing))return 'Stair direction or landing is missing. Trace the flight from the current-floor landing.';
 if(!stair.recognition&&stair.navigationConfirmed==null&&!landing.recognition&&landing.navigationConfirmed==null)return '';
 const path=confirmedStairPath(stair);
 if(!path||stair.direction!=='down')return 'This stair has no confirmed downward flight from the current floor.';
 if(stair.destinationFloorId!==lowerFloor.id)return 'Choose the floor reached by this stair; matching link names do not confirm its destination.';
 if(dist(path.at(-1),stairLanding(landing))>Math.max(.3,Math.min(stair.width||1.2,landing.width||1.2)/2))return 'The traced flight does not arrive at the lower-floor landing. Correct its endpoints or floor alignment.';
 if(!(stair.travelLength>0))return 'Stair travel length is missing. Enter the measured distance along the flight and landings.';
 return '';
}
