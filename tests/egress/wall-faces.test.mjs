import test from 'node:test';
import assert from 'node:assert/strict';
import {collapseWallFaces} from '../../teaching/egress/src/wall-faces.mjs';
import {normalizeWallNetwork} from '../../teaching/egress/src/wall-network.mjs';
import {enclosedRooms,enableWallRooms} from '../../teaching/egress/src/editable-plan.mjs';
import {openingHost,pendingOpeningBarriers} from '../../teaching/egress/src/import-quality.mjs';
import {recognitionProblem} from '../../teaching/egress/src/recognition-state.mjs';
import {analyzeAll,summary} from '../../teaching/egress/src/analysis.mjs';
import {analyzePlanCode} from '../../teaching/egress/src/plan-code.mjs';
const wall=(id,a,b,rest={})=>({id,a:{x:a[0],y:a[1]},b:{x:b[0],y:b[1]},band:1,explicit:true,thickness:.15,...rest});
const rectangle=(x,y,size,prefix)=>[[[x,y],[x+size,y]],[[x+size,y],[x+size,y+size]],[[x+size,y+size],[x,y+size]],[[x,y+size],[x,y]]].map(([a,b],i)=>wall(prefix+i,a,b));
test('Two hollow-wall faces become one axis before corner and room construction',()=>{
 const input=[...rectangle(0,0,100,'outer'),...rectangle(6,6,88,'inner')];
 const paired=collapseWallFaces(input,{faceEvidence:()=>true});assert.equal(paired.length,4);
 const walls=normalizeWallNetwork(paired,{supported:()=>true});assert.equal(walls.length,4);
 const rooms=enclosedRooms(walls);assert.equal(rooms.faces.length,1);assert.ok(walls.every(w=>w.pairedFaces));
});
test('Short duplicate face fragments inside an identified wall band do not form extra walls',()=>{
 const walls=[wall('center',[0,3],[100,3],{pairedFaces:true,band:4}),wall('face-a',[20,0],[55,0]),wall('face-b',[30,6],[65,6])];
 assert.equal(normalizeWallNetwork(walls,{supported:()=>true}).length,1);
});
test('A narrow corridor between parallel walls vetoes face pairing',()=>{
 const walls=[wall('left',[0,0],[100,0]),wall('right',[0,6],[100,6])];
 assert.equal(collapseWallFaces(walls,{faceEvidence:()=>true,interiorAt:()=>true}).length,2);
 assert.equal(collapseWallFaces(walls).length,2);
});
test('Wall faces on opposite sides of a real doorway are not merged across it',()=>{
 const walls=[wall('a',[0,0],[60,0]),wall('b',[0,6],[60,6]),wall('c',[90,0],[150,0]),wall('d',[90,6],[150,6])];
 const result=collapseWallFaces(walls,{faceEvidence:()=>true});assert.equal(result.length,2);assert.ok(result.every(w=>Math.abs(w.b.x-w.a.x)<=60));
});
test('Small skew between known jambs does not detach a door from parallel host walls',()=>{
 const walls=[wall('a',[0,0],[4,0]),wall('b',[4.4,.06],[10,.06])],points=[{x:4,y:0},{x:4.4,y:.06}];
 assert.ok(openingHost(walls,points).gap);
 assert.ok(openingHost([walls[0],wall('b',[4.4,.5],[10,.5])],[points[0],{x:4.4,y:.5}]).error);
});
test('Area portals use actual jambs, avoiding shifted parallel micro rooms',()=>{
 const walls=[wall('a',[0,0],[4,0]),wall('b',[5,0],[10,0]),wall('c',[10,0],[10,10]),wall('d',[10,10],[0,10]),wall('e',[0,10],[0,0])];
 const f={walls,rooms:[],doors:[],features:[],candidates:[{id:'door',points:[{x:4,y:.06},{x:5,y:.06}]}]};
 const barrier=pendingOpeningBarriers(f)[0];assert.deepEqual(barrier.a,{x:4,y:0});assert.deepEqual(barrier.b,{x:5,y:0});
 enableWallRooms(f);assert.equal(f.rooms.length,1);
 const onWall={walls:[wall('a',[0,0],[10,0])],candidates:f.candidates};assert.equal(pendingOpeningBarriers(onWall).length,0);
});
test('Failed imported geometry cannot produce occupancy, capacity, routes or code passes',()=>{
 const f={id:'floor',recognition:{},pendingSpaces:[{name:'Open hall'}],walls:[wall('a',[0,0],[10,0])],rooms:[{id:'false-room',name:'Fragment',points:[{x:0,y:0},{x:1,y:0},{x:1,y:1}]}],doors:[],stairs:[],features:[],traces:[],elevation:0};
 const p={floors:[f],site:{routes:[],targets:[]},settings:{},units:'m'};
 assert.ok(recognitionProblem(f));const a=summary(analyzeAll(p));assert.equal(a.floors[0].total,null);assert.equal(a.floors[0].exits,null);assert.equal(a.floors[0].capacity.rows.length,0);assert.equal(a.complete.length,0);assert.equal(a.floors[0].rooms.length,0);
 assert.equal(analyzePlanCode(p,a).checks.some(c=>c.status==='pass'),false);
 assert.equal(recognitionProblem({...f,recognition:undefined}),null);
});
