import test from 'node:test';
import assert from 'node:assert/strict';
import {fresh} from '../../teaching/egress/src/model.mjs';
import {analyze,analyzeAll} from '../../teaching/egress/src/analysis.mjs';
import {edges,splitWalls,makeGrid,flood,nearest} from '../../teaching/egress/src/geometry.mjs';
import {sixRoomFixture} from './room-routes-fixture.mjs';
const rect=(x,y,w,h)=>[{x,y},{x:x+w,y},{x:x+w,y:y+h},{x,y:y+h}];
const room=(id,points)=>({id,name:id,points,function:'business',factor:150,basis:'gross'});
function divided(){const p=fresh(),f=p.floors[0];f.outline=rect(0,0,10,8);f.walls=edges(f.outline).map(([a,b],i)=>({id:'w'+i,a,b,thickness:.15}));f.walls.push({id:'partition',a:{x:5,y:0},b:{x:5,y:8},thickness:.15});f.doors=[{id:'exit',name:'Exit',wallId:'w1',x:10,y:4,width:1.2,exit:true,discharge:'site'}];return p;}
test('Doors cut unequal and reversed coincident room walls: all six rooms have routes',()=>{const a=analyze(sixRoomFixture());assert.equal(a.routes.length,6);assert.ok(a.rooms.every(r=>r.routeState==='connected'));assert.ok(a.routes.every(r=>r.completeCoverage));});
test('A partly disconnected room keeps its reachable route and its failure',()=>{const p=divided();p.floors[0].rooms=[room('Whole space',p.floors[0].outline)];const a=analyze(p);assert.ok(a.rooms[0].unreachable>0);assert.equal(a.routes.length,1);assert.equal(a.routes[0].partial,true);assert.equal(a.routes[0].completeCoverage,false);assert.ok(a.checks.some(c=>c.title.includes('disconnected')&&c.status==='fail'));assert.equal(analyzeAll(p).complete[0].exitAccessComplete,false);});
test('A blocked room remains in the route inventory without an invented path',()=>{const p=divided();p.floors[0].rooms=[room('Left',rect(0,0,5,8)),room('Right',rect(5,0,5,8))];const a=analyzeAll(p);assert.equal(a.complete.length,2);assert.equal(a.raw[0].routes.length,1);const blocked=a.complete.find(r=>r.name==='Left');assert.equal(blocked.distance,null);assert.deepEqual(blocked.segments,[]);assert.match(blocked.reason,/No route/);});
test('Rooms beyond the floor boundary get an explicit reason, not a silent missing route',()=>{const p=divided();p.floors[0].rooms=[room('Outside',rect(12,0,4,4))];const a=analyzeAll(p);assert.equal(a.raw[0].rooms[0].outsideBoundary,true);assert.equal(a.raw[0].routes.length,0);assert.match(a.complete[0].reason,/outside the floor boundary/);});
test('A separate parallel wall is not opened by a nearby door',()=>{const walls=[{id:'host',a:{x:5,y:0},b:{x:5,y:10}},{id:'other',a:{x:5.1,y:0},b:{x:5.1,y:10}}],g=makeGrid([rect(0,0,10,10)],[],splitWalls(walls,[{wallId:'host',x:5,y:5,width:1.2}]),.15),f=flood(g,[{x:9,y:5}]);assert.equal(f.d[nearest(g,{x:1,y:5})],Infinity);});
test('Exit seeding never jumps through an unopened wall',()=>{const boundary=rect(0,0,10,10),walls=edges(boundary).map(([a,b])=>({a,b,thickness:.2})),g=makeGrid([boundary],[],walls,.2),f=flood(g,[{x:10.2,y:5}]);assert.ok([...f.d].every(d=>!Number.isFinite(d)));});
