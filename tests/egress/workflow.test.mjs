import test from 'node:test';
import assert from 'node:assert/strict';
import {fresh} from '../../teaching/egress/src/model.mjs';
import {workflowState} from '../../teaching/egress/src/workflow-ui.mjs';

test('An unscaled uploaded image requests scale before recognition; a calibrated image proceeds',()=>{
 const p=fresh();p.floors[0].image={calibrated:false};
 assert.equal(workflowState(p,null,0).command,'calibrate');
 p.floors[0].image.calibrated=true;
 assert.equal(workflowState(p,null,0).command,'recognize');
});
test('Opening review finds the correct floor before asking for room confirmation',()=>{
 const p=fresh();p.floors[0].rooms=[{id:'room',areaConfirmed:false}];
 p.floors.push({...structuredClone(p.floors[0]),id:'upper',rooms:[],candidates:[{id:'opening'}]});
 let s=workflowState(p,null,1);assert.equal(s.target,'opening');assert.equal(s.floor,1);
 p.floors[1].candidates=[];s=workflowState(p,null,1);assert.equal(s.target,'room');assert.equal(s.floor,0);
 p.floors[0].rooms[0].areaConfirmed=true;assert.equal(workflowState(p,null,1).command,'routes');
});
test('Pending analyses cannot export; partial routes remain explicitly incomplete',()=>{
 const p=fresh();assert.equal(workflowState(p,null,3).disabled,true);
 const a={complete:[{complete:true},{complete:false}]};
 assert.match(workflowState(p,a,2).title,/1 \/ 2 rooms/);
 assert.equal(workflowState(p,a,3).disabled,false);
});
