import test from 'node:test';
import assert from 'node:assert/strict';
import {deduplicateOpenings,reconcileOpeningCandidates} from '../../teaching/egress/src/opening-identity.mjs';
import {confirmOpening,materializeInterpretation} from '../../teaching/egress/src/semantic-plan.mjs';
import {openingHost,pendingOpeningBarriers} from '../../teaching/egress/src/import-quality.mjs';
import {enableWallRooms} from '../../teaching/egress/src/editable-plan.mjs';
import {area} from '../../teaching/egress/src/geometry.mjs';

const w=(id,a,b)=>({id,a:{x:a[0],y:a[1]},b:{x:b[0],y:b[1]},thickness:.2});
const c=(id,x1,x2,kind='door')=>({id,name:id,kind,points:[{x:x1,y:0},{x:x2,y:0}],recognition:{sourceId:id}});
const walls=[w('left',[0,0],[4,0]),w('right',[6,0],[10,0])];
const proposals=()=>[c('left leaf',4,5),c('entrance',4,6,'entrance'),c('right leaf',5,6)];
for(const angle of [0,.23,1.2])test('One physical entrance with two partial leaves produces one opening at rotation '+angle,()=>{
 const turn=p=>({x:12+p.x*Math.cos(angle)-p.y*Math.sin(angle),y:7+p.x*Math.sin(angle)+p.y*Math.cos(angle)});
 const ws=walls.map(w=>({...w,a:turn(w.a),b:turn(w.b)})),cs=proposals().map(c=>({...c,points:c.points.map(turn)})),before=structuredClone(cs);
 assert.ok(openingHost(ws,cs[0].points).error);assert.ok(openingHost(ws,cs[2].points).error);
 for(const items of [cs,[cs[2],cs[0],cs[1]],[cs[1],cs[2],cs[0]]]){
  const merged=deduplicateOpenings(ws,items);assert.equal(merged.length,1);assert.equal(merged[0].id,'entrance');assert.deepEqual(merged[0].points,cs[1].points);assert.deepEqual(new Set(merged[0].recognition.sourceIds),new Set(cs.map(c=>c.id)));assert.deepEqual(deduplicateOpenings(ws,merged),merged);
 }
 assert.deepEqual(cs,before);
});
test('Adjacent doors separated by a solid pier are never merged',()=>{
 const ws=[w('left',[0,0],[4,0]),w('pier',[5,0],[5.3,0]),w('right',[6.3,0],[10,0])];
 const cs=[c('a',4,5),c('a-leaf',4,4.5),c('b',5.3,6.3),c('b-leaf',5.8,6.3)];
 const merged=deduplicateOpenings(ws,cs);assert.equal(merged.length,2);assert.deepEqual(merged.map(c=>c.id),['a','b']);
});
test('Adjacent doors on an unbroken imported centerline remain distinct',()=>{
 const ws=[w('continuous',[0,0],[10,0])];assert.equal(deduplicateOpenings(ws,[c('a',3,4),c('b',4.1,5.1)]).length,2);
 assert.equal(deduplicateOpenings(ws,[c('whole',3,5,'entrance'),c('left',3,4),c('right',4,5)]).length,1);
});
test('Unrelated unhosted openings and openings across a partition stay separate',()=>{
 assert.equal(deduplicateOpenings([],proposals()).length,3);
 const ws=[...walls,w('partition',[5,0],[5,3])];assert.equal(deduplicateOpenings(ws,[c('a',4,4.8),c('b',5.2,6)]).length,2);
});
test('Confirming any representation creates one door and removes all aliases',()=>{
 const f={elevation:0,walls:structuredClone(walls),doors:[],rooms:[],outline:[],candidates:proposals()};
 const d=confirmOpening(f,f.candidates[0],{exit:true});assert.equal(f.doors.length,1);assert.equal(d.width,2);assert.equal(d.x,5);assert.equal(d.exit,true);assert.equal(f.candidates.length,0);
 assert.equal(confirmOpening(f,proposals()[2]).id,d.id);assert.equal(f.doors.length,1);
});
test('Old saved models lose duplicate candidate markers without altering confirmed door dimensions or exit role',()=>{
 const f={walls:[...structuredClone(walls),{...w('host',[4,0],[6,0]),openingHost:true}],doors:[{id:'confirmed',wallId:'host',x:5,y:0,width:1.8,exit:true,name:'Main entry'}],candidates:proposals()};
 const original=structuredClone(f.doors);assert.equal(reconcileOpeningCandidates(f),true);assert.equal(f.candidates.length,0);assert.deepEqual(f.doors,original);assert.equal(reconcileOpeningCandidates(f),false);
});
test('Repairing an existing three-marker model keeps the same room area and one pending portal',()=>{
 const f={walls:[...structuredClone(walls),w('east',[10,0],[10,8]),w('north',[10,8],[0,8]),w('west',[0,8],[0,0])],outline:[],rooms:[],doors:[],candidates:proposals()};
 enableWallRooms(f);const before=f.rooms.reduce((n,r)=>n+area(r.points),0);assert.equal(before,80);
 reconcileOpeningCandidates(f);enableWallRooms(f);assert.equal(f.candidates.length,1);assert.equal(pendingOpeningBarriers(f).length,1);assert.equal(f.rooms.reduce((n,r)=>n+area(r.points),0),before);
});
