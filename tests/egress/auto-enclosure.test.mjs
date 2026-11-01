import test from 'node:test';
import assert from 'node:assert/strict';
import {fresh} from '../../teaching/egress/src/model.mjs';
import {enableWallRooms,syncEnclosedRooms,moveWall} from '../../teaching/egress/src/editable-plan.mjs';
import {analyze} from '../../teaching/egress/src/analysis.mjs';
import {area,edges,floorRegions} from '../../teaching/egress/src/geometry.mjs';
import {auditImport,openingSpaces} from '../../teaching/egress/src/import-quality.mjs';
import {roomArea,inOpening} from '../../teaching/egress/src/openings.mjs';
const rect=(x,y,w,h)=>[{x,y},{x:x+w,y},{x:x+w,y:y+h},{x,y:y+h}];
const walls=(poly,prefix='w')=>edges(poly).map(([a,b],i)=>({id:prefix+i,a:{...a},b:{...b},thickness:.15}));
function fixture(){const p=fresh(),f=p.floors[0];f.walls=walls(rect(0,0,10,8));f.doors=[{id:'exit',wallId:'w1',name:'Exit',x:10,y:4,width:1.2,exit:true}];return p;}
test('A closed wall loop routes with no separately drawn boundary',()=>{
 const p=fixture(),f=p.floors[0];enableWallRooms(f);
 assert.equal(f.rooms.length,1);assert.equal(area(f.outline),80);
 const a=analyze(p);assert.equal(a.routes.length,1);assert.equal(a.rooms[0].routeState,'connected');
 assert.ok(!a.checks.some(c=>/floor boundary/i.test(c.title)));
});
test('An undersized imported outline cannot clip an enclosed room; moving the exterior wall updates both',()=>{
 const p=fixture(),f=p.floors[0];f.outline=rect(2,2,2,2);f.autoBoundary=false;enableWallRooms(f);
 assert.equal(area(f.outline),80);assert.equal(analyze(p).rooms[0].outsideBoundary,false);
 const before=structuredClone(f);moveWall(f,'w1',{x:12,y:0},{x:12,y:8},before);syncEnclosedRooms(f);
 assert.equal(area(f.rooms[0].points),96);assert.equal(area(floorRegions(f)[0]),96);assert.equal(f.doors[0].x,12);
});
test('Two detached enclosures remain separate without a hull or false outside-boundary warning',()=>{
 const p=fixture(),f=p.floors[0];f.walls.push(...walls(rect(20,0,6,6),'b'));enableWallRooms(f);
 assert.equal(floorRegions(f).length,2);assert.equal(f.rooms.length,2);
 assert.ok(!auditImport(f).issues.some(i=>i.code==='room-outside'));
 const connection=openingSpaces(f,[{x:26,y:2},{x:26,y:3}]);assert.ok(connection.sides.some(s=>s[0]==='outside'));assert.ok(connection.sides.some(s=>s.includes(f.rooms[1].id)));
});
test('Removing a wall clears the automatic extent instead of retaining a stale boundary',()=>{
 const p=fixture(),f=p.floors[0];enableWallRooms(f);f.walls=f.walls.filter(w=>w.id!=='w3');syncEnclosedRooms(f);
 assert.equal(f.rooms.length,0);assert.deepEqual(floorRegions(f),[]);assert.equal(f.outline.length,0);
 assert.ok(analyze(p).checks.some(c=>c.title==='No closed wall enclosure'));
});
test('A closed courtyard remains outdoors and is deducted from the surrounding room',()=>{
 const p=fixture(),f=p.floors[0],court=rect(3,2,4,3);f.walls.push(...walls(court,'court'));f.features=[{id:'court',kind:'courtyard',points:court}];enableWallRooms(f);
 assert.equal(f.rooms.length,1);assert.equal(roomArea(p,0,f.rooms[0]),68);assert.equal(inOpening(p,0,{x:5,y:3}),true);
 const connection=openingSpaces(f,[{x:3,y:3},{x:3,y:4}]);assert.ok(connection.sides.some(s=>s[0]==='outside'));
});
test('Upper-floor voids remain excluded while the occupied base retains its floor',()=>{
 const p=fixture(),f=p.floors[0];enableWallRooms(f);const upper=structuredClone(f);upper.id='upper';upper.elevation=3.6;p.floors.push(upper);
 p.openings=[{id:'void',baseFloorId:f.id,throughFloorId:upper.id,points:rect(3,2,4,3)}];
 assert.equal(roomArea(p,0,f.rooms[0]),80);assert.equal(roomArea(p,1,upper.rooms[0]),68);
 assert.equal(inOpening(p,0,{x:5,y:3}),false);assert.equal(inOpening(p,1,{x:5,y:3}),true);
});
