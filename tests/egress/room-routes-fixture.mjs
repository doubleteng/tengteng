import {fresh} from '../../teaching/egress/src/model.mjs';
import {edges,dist,project} from '../../teaching/egress/src/geometry.mjs';
const rect=(x,y,w,h)=>[{x,y},{x:x+w,y},{x:x+w,y:y+h},{x,y:y+h}];
// Reproduction of separately drawn adjoining rooms, including unequal shared
// wall segments. Dimensions are a test case, not measurements from the screenshot.
export function sixRoomFixture(){
 const p=fresh();p.name='Six-room route regression';p.units='m';p.settings.grid=.3;
 const f=p.floors[0];
 f.outline=[{x:0,y:0},{x:31,y:0},{x:31,y:14},{x:37,y:14},{x:37,y:24},{x:23,y:24},{x:23,y:19},{x:5,y:19},{x:5,y:14},{x:0,y:14}];
 const add=(points,roomId)=>{for(const [a,b] of edges(points)){if(f.walls.some(w=>dist(w.a,a)<.02&&dist(w.b,b)<.02||dist(w.a,b)<.02&&dist(w.b,a)<.02))continue;f.walls.push({id:'w'+f.walls.length,a:{...a},b:{...b},thickness:.15,roomId});}};
 add(f.outline);
 for(const [i,points]of [rect(0,0,7,14),rect(7,8,12,6),rect(7,0,12,8),rect(19,0,12,14),rect(23,14,14,10),rect(5,14,18,5)].entries()){
  const r={id:'room'+(i+1),name:'Room '+(i+1),points,function:'business',factor:150,basis:'gross',group:'B'};f.rooms.push(r);add(points,r.id);
 }
 let exit=0;
 for(const [x,y,isExit]of [[13,19,true],[17,0,true],[37,16,true],[29,0,true],[6,14,false],[8,14,false],[17,8,false],[21,14,false],[28,14,false],[23,16,false]]){
  const d={id:'door'+f.doors.length,x,y,width:1.1,exit:isExit,discharge:isExit?'site':'none',name:isExit?'Exit '+(++exit):'Door'};
  const host=f.walls.map(w=>({w,d:dist(project(d,w.a,w.b),d)})).sort((a,b)=>a.d-b.d)[0];d.wallId=host.w.id;f.doors.push(d);
 }
 return p;
}
