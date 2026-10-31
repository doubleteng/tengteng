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

import {createExample} from '../../teaching/egress/src/examples.mjs';
import {repairLegacyCaseImport} from '../../teaching/egress/src/drawing-import.mjs';
const upload=()=>({name:'Student plan.jpg',src:'data:image/png;base64,c291cmNl',x:12,y:15,width:80,height:50,rotation:.2,calibrated:true,calibration:{method:'two-points',distance:10},interpretation:{elements:[{id:'proposed-room'}]}});

test('Legacy Kendeda overlay repair keeps the entire uploaded source and removes case loads and routes',()=>{
 const template=createExample('kendeda'),p=structuredClone(template);p.floors[0].image=upload();
 const before=structuredClone(p),next=repairLegacyCaseImport(p,template);
 assert.deepEqual(p,before);assert.equal(next.name,'Student plan');assert.equal(next.floors.length,1);
 assert.deepEqual(next.floors[0].image,p.floors[0].image);
 for(const key of ['walls','rooms','doors','stairs','obstacles','features','outline'])assert.equal(next.floors[0][key]?.length||0,0,key);
 for(const key of ['walkable','obstacles','targets','routes'])assert.equal(next.site[key].length,0,key);
 assert.equal(next.tutorial,undefined);assert.equal(next.precedent,undefined);assert.equal(next.floors[0].semanticRooms,undefined);
 assert.equal(repairLegacyCaseImport(next,template),null);
});

test('Legacy repair retains imported CAD, custom objects, independent floors and site sources',()=>{
 const template=createExample('kendeda'),p=structuredClone(template),f=p.floors[0];f.image=upload();
 f.cad=[{id:'student-line',a:{x:1,y:1},b:{x:3,y:1}}];f.layers=[{id:'student-layer'}];f.imports=[{name:'student.dwg'}];
 const wall={id:'student-wall',a:{x:90,y:0},b:{x:90,y:5}};f.walls.push(wall);
 const upper=fresh().floors[0];upper.name='My upper floor';upper.elevation=4;upper.image=upload();p.floors.push(upper);
 p.site.image=upload();p.site.routes.push({id:'student-path',points:[{x:1,y:0},{x:2,y:0}]});
 const next=repairLegacyCaseImport(p,template);
 assert.deepEqual(next.floors[0].walls,[wall]);assert.deepEqual(next.floors[0].cad,f.cad);assert.deepEqual(next.floors[0].layers,f.layers);assert.deepEqual(next.floors[0].imports,f.imports);
 assert.deepEqual(next.floors[1],upper);assert.deepEqual(next.site.image,p.site.image);assert.deepEqual(next.site.routes,[p.site.routes.at(-1)]);
});

test('Bullitt repair keeps multiple uploaded floors in the same XY frame and removes unused case floors',()=>{
 const template=createExample('bullitt'),p=structuredClone(template);p.floors[0].image=upload();p.floors[2].image={...upload(),name:'Upper.pdf · page 2',x:30};
 const next=repairLegacyCaseImport(p,template);
 assert.equal(next.floors.length,2);assert.deepEqual(next.floors.map(f=>[f.id,f.elevation,f.image]),[p.floors[0],p.floors[2]].map(f=>[f.id,f.elevation,f.image]));
 assert.equal(next.floors[1].name,'Upper · page 2');
});

test('Unmodified cases, built-in underlays, ordinary projects and recognized student models are not repaired',()=>{
 for(const id of ['kendeda','bullitt','barcelona','savoye']){const p=createExample(id);assert.equal(repairLegacyCaseImport(p,createExample(id)),null);}
 const ordinary=demo();ordinary.floors[0].image=upload();assert.equal(repairLegacyCaseImport(ordinary,createExample('kendeda')),null);
 const p=createExample('kendeda');p.floors[0].image=upload();p.floors[0].walls=demo().floors[0].walls;
 assert.equal(repairLegacyCaseImport(p,createExample('kendeda')),null);
});

test('Intentional new-workflow overlays and explicitly restored backups survive reload migration',()=>{
 const p=createExample('kendeda'),staged=stageDrawingImport(p,{destination:'current',floorId:p.floors[0].id});staged.scope.image=upload();
 assert.equal(repairLegacyCaseImport(staged.project,p),null);
 p.floors[0].image=upload();p.importWorkflowVersion=2;assert.equal(repairLegacyCaseImport(p,createExample('kendeda')),null);
});

test('A separately recognized floor retains its own enclosure when another floor needs repair',()=>{
 const template=createExample('bullitt'),p=structuredClone(template);p.floors[0].image=upload();
 const recognized=demo().floors[0];recognized.id=p.floors[2].id;recognized.image=upload();p.floors[2]=recognized;
 const next=repairLegacyCaseImport(p,template);
 assert.deepEqual(next.floors.find(f=>f.id===recognized.id),recognized);
});
