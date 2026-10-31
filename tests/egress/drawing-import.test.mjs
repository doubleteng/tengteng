import test from 'node:test';
import assert from 'node:assert/strict';
import {fresh,demo} from '../../teaching/egress/src/model.mjs';
import {hasDrawingContent,stageDrawingImport} from '../../teaching/egress/src/drawing-import.mjs';
import {workflowState} from '../../teaching/egress/src/workflow-ui.mjs';

test('Starting a drawing creates a clean project and leaves the previous model recoverable',()=>{
 const p=demo();p.precedent={name:'Study'};p.tutorial={id:'kendeda'};p.openings=[{id:'void'}];
 p.floors[0].image={src:'old-image',interpretation:{elements:[{id:'old-room'}]}};
 const before=structuredClone(p),s=stageDrawingImport(p,{destination:'new',name:'Student plan.jpg',floorId:p.floors[0].id});
 s.scope.image={src:'new-image'};
 assert.deepEqual(p,before);assert.notEqual(s.project.id,p.id);assert.equal(s.project.name,'Student plan');
 assert.equal(s.project.floors.length,1);assert.equal(s.scope.walls.length,0);assert.equal(s.scope.rooms.length,0);
 assert.equal(s.project.site.routes.length,0);assert.equal(s.project.site.targets.length,0);assert.equal(s.project.precedent,undefined);assert.equal(s.project.tutorial,undefined);assert.equal(s.project.openings,undefined);
});
test('Adding a floor preserves existing floors, shared XY geometry, site and slab openings',()=>{
 const p=demo();p.precedent={name:'Study'};p.tutorial={id:'kendeda'};p.openings=[{id:'void'}];
 const before=structuredClone(p),s=stageDrawingImport(p,{destination:'floor',name:'Level 02.pdf',mode:'site',floorId:p.floors[0].id});
 s.scope.image={calibrated:false};
 assert.deepEqual(p,before);assert.deepEqual(s.project.floors[0],p.floors[0]);assert.deepEqual(s.project.site,p.site);assert.deepEqual(s.project.openings,p.openings);
 assert.equal(s.mode,'building');assert.equal(s.project.activeFloor,1);assert.equal(s.scope.name,'Level 02');assert.equal(s.scope.elevation,3.6);assert.equal(s.scope.walls.length,0);assert.equal(s.project.tutorial,undefined);
 assert.equal(workflowState(s.project,null,0).command,'calibrate');
});
test('Replacing a floor underlay retains walls, rooms, doors and the other floor sources',()=>{
 const p=demo();p.floors[0].image={src:'old'};const upper=fresh().floors[0];upper.image={src:'upper'};p.floors.push(upper);
 const before=structuredClone(p),s=stageDrawingImport(p,{destination:'current',floorId:p.floors[0].id});s.scope.image={src:'new'};
 assert.deepEqual(p,before);assert.deepEqual(s.scope.walls,p.floors[0].walls);assert.deepEqual(s.scope.rooms,p.floors[0].rooms);assert.deepEqual(s.scope.doors,p.floors[0].doors);assert.deepEqual(s.project.floors[1],upper);assert.deepEqual(s.project.site,p.site);
});
test('Adding site reference geometry does not replace building geometry',()=>{
 const p=demo(),s=stageDrawingImport(p,{destination:'current',mode:'site',floorId:p.floors[0].id});
 s.scope.cad.push({id:'new-segment',a:{x:100,y:200},b:{x:300,y:200}});
 assert.equal(s.mode,'site');assert.deepEqual(s.project.floors,p.floors);assert.deepEqual(s.scope.walkable,p.site.walkable);assert.equal(p.site.cad.length,0);
});
test('Invalid destinations and floor limits reject without clearing the current design',()=>{
 const p=demo();p.floors=Array.from({length:30},()=>structuredClone(p.floors[0]));const before=structuredClone(p);
 assert.throws(()=>stageDrawingImport(p,{destination:'floor'}),/30 floors/);
 assert.throws(()=>stageDrawingImport(p,{destination:'current',floorId:'missing'}),/no longer/);
 assert.throws(()=>stageDrawingImport(p,{destination:'clear'}),/Choose where/);assert.deepEqual(p,before);
});
test('An existing image, CAD layer or site layout triggers a destination choice even without rooms',()=>{
 const p=fresh();assert.equal(hasDrawingContent(p),false);p.site.routes.push({id:'route'});assert.equal(hasDrawingContent(p),true);p.site.routes=[];p.floors[0].image={src:'reference'};assert.equal(hasDrawingContent(p),true);delete p.floors[0].image;p.floors[0].cad.push({id:'cad'});assert.equal(hasDrawingContent(p),true);
});
