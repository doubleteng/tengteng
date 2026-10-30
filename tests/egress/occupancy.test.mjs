import test from 'node:test';
import assert from 'node:assert/strict';
import {SF} from '../../teaching/egress/src/geometry.mjs';
import {functions} from '../../teaching/egress/src/model.mjs';
import {roomLoad} from '../../teaching/egress/src/capacity.mjs';
import {factorReference,loadCalculation} from '../../teaching/egress/src/occupancy-ui.mjs';
import {bottleneckFixture} from './capacity-fixture.mjs';

test('A changed factor or area basis is never presented as the IBC table value',()=>{
 const p=bottleneckFixture(),r=p.floors[0].rooms[0];
 assert.match(factorReference(roomLoad(p,0,r)),/IBC 2021/);
 r.factor=20;assert.match(factorReference(roomLoad(p,0,r)),/Custom/);
 r.factor=15;r.basis='gross';assert.match(factorReference(roomLoad(p,0,r)),/Custom/);
});
test('Library reading and stack uses use distinct IBC factors and preserve unrounded calculation',()=>{
 const p=bottleneckFixture(),r=p.floors[0].rooms[0];
 r.points=[{x:0,y:0},{x:10,y:0},{x:10,y:10},{x:0,y:10}];
 Object.assign(r,functions.reading,{function:'reading'});
 const reading=roomLoad(p,0,r);assert.equal(reading.factor,50);assert.equal(reading.basis,'net');assert.equal(reading.occupants,22);
 assert.equal(reading.occupants,Math.ceil(100/(50*SF)));
 Object.assign(r,functions.stacks,{function:'stacks'});
 const stacks=roomLoad(p,0,r);assert.equal(stacks.factor,100);assert.equal(stacks.basis,'gross');assert.equal(stacks.occupants,11);
 assert.match(loadCalculation(stacks),/11 people/);
 r.role='corridor';assert.equal(roomLoad(p,0,r).occupants,0);assert.doesNotMatch(factorReference(roomLoad(p,0,r)),/IBC/);
});
