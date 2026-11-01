import test from 'node:test';
import assert from 'node:assert/strict';
import {confirmedStairPath,stairLanding,stairConnectionProblem} from '../../teaching/egress/src/stairs.mjs';
import {materializeInterpretation} from '../../teaching/egress/src/semantic-plan.mjs';
import {analyzeAll} from '../../teaching/egress/src/analysis.mjs';
import {demo} from '../../teaching/egress/src/model.mjs';
import {alignFloor} from '../../teaching/egress/src/drafting.mjs';

const points=[{x:4,y:8},{x:7,y:9},{x:6,y:11},{x:3,y:10}];
const stair=()=>({id:'s',name:'Stair',link:'A',protected:true,width:1.2,points:structuredClone(points),recognition:{sourceId:'stair'},direction:'unknown',navigationConfirmed:false});
test('A rotated recognized footprint and an UP label do not invent flights or a landing',()=>{
 const s=stair();s.name='UP staircase';assert.equal(confirmedStairPath(s),null);assert.equal(stairLanding(s),null);
 const result={version:1,outline:[],warnings:[],summary:'',elements:[{id:'s',kind:'stair',label:'UP',points:[[100,100],[400,200],[300,400],[0,300]]}]};
 const converted=materializeInterpretation(result,{x:0,y:0,width:10,height:10,calibrated:true}).stairs[0];
 assert.equal(converted.direction,'unknown');assert.equal(converted.travelLength,null);assert.equal(stairLanding(converted),null);
});
test('Unconfirmed recognized stairs do not receive circulation or exit paths',()=>{
 const p=demo(),upper=structuredClone(p.floors[0]);upper.id='upper';upper.elevation=3.6;upper.doors=upper.doors.filter(d=>!d.exit);upper.stairs=[stair()];p.floors.push(upper);
 let a=analyzeAll(p);assert.equal(a.raw[1].exits,0);assert.equal(a.raw[1].circulationRoutes.length,0);assert.ok(a.raw[1].checks.some(c=>c.title.includes('direction and landing unknown')));
 upper.stairs[0].protected=false;a=analyzeAll(p);assert.equal(a.raw[1].circulationRoutes.length,0);
});
test('An UP flight is not used as a downward exit on an upper floor',()=>{
 const p=demo(),upper=structuredClone(p.floors[0]);upper.id='upper';upper.elevation=3.6;upper.doors=upper.doors.filter(d=>!d.exit);upper.stairs=[{...stair(),navigationConfirmed:true,direction:'up',flightPath:[{x:4,y:9},{x:6,y:9}]}];p.floors.push(upper);
 assert.equal(analyzeAll(p).raw[1].exits,0);
});
test('U-shaped flight preserves every turn; direction, destination and both landings govern the link',()=>{
 const s={...stair(),navigationConfirmed:true,direction:'down',destinationFloorId:'ground',travelLength:8,flightPath:[{x:4,y:8},{x:4,y:11},{x:6,y:11},{x:6,y:8}]};
 const lower={...stair(),navigationConfirmed:true,direction:'up',flightPath:[{x:6,y:8},{x:6,y:11},{x:4,y:11},{x:4,y:8}]};
 assert.equal(confirmedStairPath(s).length,4);assert.deepEqual(stairLanding(s),{x:4,y:8});assert.equal(stairConnectionProblem(s,lower,{id:'ground'}),'');
 assert.match(stairConnectionProblem({...s,destinationFloorId:null},lower,{id:'ground'}),/Choose the floor/);
 assert.match(stairConnectionProblem({...s,direction:'up'},lower,{id:'ground'}),/downward/);
 assert.match(stairConnectionProblem({...s,travelLength:null},lower,{id:'ground'}),/travel length is missing/);
 lower.flightPath[0]={x:10,y:8};assert.match(stairConnectionProblem(s,lower,{id:'ground'}),/does not arrive/);
});
test('Floor rotation transforms flight paths and landings with the footprint',()=>{
 const f=demo().floors[0],s={...stair(),navigationConfirmed:true,direction:'down',flightPath:[{x:4,y:8},{x:4,y:11},{x:6,y:11}]};f.stairs=[s];
 alignFloor(f,{angle:Math.PI/2,point:q=>({x:20-q.y,y:q.x})});assert.deepEqual(stairLanding(s),{x:12,y:4});assert.deepEqual(s.flightPath.at(-1),{x:9,y:6});assert.deepEqual(s.points[0],{x:12,y:4});
});
