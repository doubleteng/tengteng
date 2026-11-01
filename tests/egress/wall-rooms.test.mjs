import test from 'node:test';
import assert from 'node:assert/strict';
import {fresh} from '../../teaching/egress/src/model.mjs';
import {enableWallRooms,moveWall,syncEnclosedRooms,assignRoomUse} from '../../teaching/egress/src/editable-plan.mjs';
import {area,edges} from '../../teaching/egress/src/geometry.mjs';
import {roomLoad} from '../../teaching/egress/src/capacity.mjs';
import {analyze} from '../../teaching/egress/src/analysis.mjs';
import {materializeInterpretation} from '../../teaching/egress/src/semantic-plan.mjs';
import {alignFloor} from '../../teaching/egress/src/drafting.mjs';
const rect=(x,y,w,h)=>[{x,y},{x:x+w,y},{x:x+w,y:y+h},{x,y:y+h}];
function fixture(){const p=fresh(),f=p.floors[0];f.outline=rect(0,0,10,10);f.walls=edges(f.outline).map(([a,b],i)=>({id:'edge-'+i,a:{...a},b:{...b},thickness:.15}));f.walls.push({id:'divider',a:{x:5,y:0},b:{x:5,y:10},thickness:.15});f.rooms=[{id:'left',name:'Studio',points:rect(.2,.2,4.5,9.6),function:'business',factor:150,basis:'gross',group:'B'},{id:'right',name:'Seminar',points:rect(5.3,.2,4.5,9.6),function:'classroom',factor:20,basis:'net',group:'E'}];f.recognition={};return p;}
test('Imported region polygons only seed room names; area comes from actual walls',()=>{
 const p=fixture(),f=p.floors[0];enableWallRooms(f);assert.deepEqual(f.rooms.map(r=>area(r.points)),[50,50]);assert.ok(f.rooms.every(r=>r.geometrySource==='walls'));assert.ok(f.spaceSeeds.every(s=>s.point&&!s.points));
});
test('Moving a shared wall updates both room areas, occupant loads and attached openings',()=>{
 const p=fixture(),f=p.floors[0];enableWallRooms(f);const beforeLoad=roomLoad(p,0,f.rooms.find(r=>r.id==='left')).occupants;
 f.doors=[{id:'door',wallId:'divider',x:5,y:3,width:1}];f.candidates=[{id:'candidate',points:[{x:5,y:6},{x:5,y:7}]}];const snapshot=structuredClone(f);
 moveWall(f,'divider',{x:7,y:0},{x:7,y:10},snapshot);syncEnclosedRooms(f);
 assert.equal(area(f.rooms.find(r=>r.id==='left').points),70);assert.equal(area(f.rooms.find(r=>r.id==='right').points),30);assert.equal(f.rooms.reduce((n,r)=>n+area(r.points),0),100);
 assert.ok(roomLoad(p,0,f.rooms.find(r=>r.id==='left')).occupants>beforeLoad);assert.equal(f.doors[0].x,7);assert.ok(f.candidates[0].points.every(q=>q.x===7));
});
test('Removing a divider merges the room once and exposes the use-assignment conflict',()=>{
 const p=fixture(),f=p.floors[0];enableWallRooms(f);f.walls=f.walls.filter(w=>w.id!=='divider');syncEnclosedRooms(f);
 assert.equal(f.rooms.length,1);assert.equal(area(f.rooms[0].points),100);assert.equal(f.rooms[0].useNeedsConfirmation,true);assert.equal(f.pendingSpaces.length,0);
});
test('Choosing the use of a merged enclosure persists through subsequent wall edits',()=>{
 const p=fixture(),f=p.floors[0];enableWallRooms(f);f.walls=f.walls.filter(w=>w.id!=='divider');syncEnclosedRooms(f);
 const r=f.rooms[0];r.function='reading';r.factor=50;r.name='Library';assignRoomUse(f,r);syncEnclosedRooms(f);
 assert.equal(f.rooms[0].useNeedsConfirmation,false);assert.equal(f.spaceSeeds.length,1);assert.equal(f.rooms[0].name,'Library');assert.equal(f.rooms[0].factor,50);
 const before=structuredClone(f);moveWall(f,'edge-1',{x:12,y:0},{x:12,y:10},before);syncEnclosedRooms(f);
 assert.equal(area(f.rooms[0].points),120);assert.equal(f.rooms[0].factor,50);assert.equal(f.rooms[0].useNeedsConfirmation,false);
});
test('An opened enclosure cannot retain its old polygon area or occupants',()=>{
 const p=fixture(),f=p.floors[0];enableWallRooms(f);f.walls=f.walls.filter(w=>w.id!=='edge-3');syncEnclosedRooms(f);
 assert.equal(f.rooms.length,1);assert.equal(f.rooms[0].id,'right');assert.equal(f.pendingSpaces.length,1);assert.equal(f.pendingSpaces[0].id,'left');assert.equal(analyze(p).blocked,true);
 assert.equal(analyze(p).total,null);assert.equal(analyze(p).routes.length,0);
});
test('Door jamb gaps can close area topology without creating an independent room polygon',()=>{
 const p=fixture(),f=p.floors[0];f.walls=f.walls.filter(w=>w.id!=='divider');f.walls.push({id:'bottom',a:{x:5,y:0},b:{x:5,y:4}},{id:'top',a:{x:5,y:6},b:{x:5,y:10}});f.candidates=[{id:'gap',points:[{x:5,y:4},{x:5,y:6}]}];enableWallRooms(f);assert.equal(f.rooms.length,2);assert.equal(f.walls.length,6);assert.equal(f.doors.length,0);
});
test('A recognized room without a closed wall stays a label, not an invented capacity',()=>{
 const r={version:1,summary:'',warnings:[],outline:[[0,0],[1000,0],[1000,1000],[0,1000]],elements:[{id:'r',kind:'room',label:'Library',points:[[100,100],[900,100],[900,900],[100,900]],confidence:'high'}]};
 const f=materializeInterpretation(r,{x:0,y:0,width:10,height:10,calibrated:true});assert.equal(f.rooms.length,0);assert.equal(f.walls.length,0);assert.equal(f.pendingSpaces[0].name,'Library');assert.equal(f.spaceSeeds[0].points,undefined);
});
test('Room uses persist through wall edits and floor alignment transforms their label points',()=>{
 const p=fixture(),f=p.floors[0];enableWallRooms(f);const r=f.rooms.find(r=>r.id==='left');r.name='Library';r.factor=50;r.function='reading';syncEnclosedRooms(f);assert.equal(f.rooms.find(r=>r.id==='left').factor,50);
 const old={...f.spaceSeeds[0].point};alignFloor(f,{angle:0,point:q=>({x:q.x+20,y:q.y+10})});assert.deepEqual(f.spaceSeeds[0].point,{x:old.x+20,y:old.y+10});syncEnclosedRooms(f);assert.equal(f.rooms.find(r=>r.id==='left').name,'Library');
});
