import test from 'node:test';
import assert from 'node:assert/strict';
import {repairReconstruction,reconstructionQuality,reconstructionTargets} from '../../teaching/egress/src/reconstruction-repair.mjs';
const rect=(x,y,w,h)=>[[x,y],[x+w,y],[x+w,y+h],[x,y+h]];
const outline=rect(100,100,800,800),image={x:0,y:0,width:10,height:10,calibrated:true};
const el=(id,kind,points)=>({id,kind,points,label:id,confidence:'high'});
function fixture(){return {version:1,outline,warnings:[],elements:[el('room','room',outline),...outline.slice(0,3).map((p,i)=>el('w'+i,'wall',[p,outline[i+1]]))]};}
test('An automatic repair reads the failed enclosure, adds the missing source wall, and preserves original result until accepted',async()=>{
 const result=fixture();result.outline=rect(300,300,400,400);result.elements=[el('room','room',result.outline),...result.outline.slice(0,3).map((p,i)=>el('w'+i,'wall',[p,result.outline[i+1]]))];const original=structuredClone(result),run={result};
 assert.equal(reconstructionQuality(result,image).compiled.pending.length,1);assert.ok(reconstructionTargets(result,image).length);
 const output=await repairReconstruction(run,{image,fit:r=>r,read:async region=>{
  const map=([x,y])=>[(x-region.x)/region.width*1000,(y-region.y)/region.height*1000];
  // Supply a source-supported closure in the detail, while keeping all original objects.
  return {...result,elements:region.focus==='openings'?[el('entry','door',[[480,300],[520,300]].map(map))]:[el('close','wall',[[300,700],[300,300]].map(map))]};
 }});
 assert.deepEqual(result,original);assert.ok(run.repairs.length>0);
 assert.equal(output.quality.compiled.pending.length,0);assert.equal(output.quality.complete,true);assert.equal(run.repairs[0].state,'accepted');
});
test('Unread whole-sheet coverage blocks detail calls and preserves the checkpoint',async()=>{
 const run={result:fixture(),regions:[{state:'failed'}]};let calls=0;
 const r=await repairReconstruction(run,{image,fit:r=>r,read:async()=>{calls++;}});
 assert.equal(calls,0);assert.equal(r.incompleteCoverage,true);
});
test('Provider quota failure preserves geometry and ends retries',async()=>{
 const run={result:fixture()},before=structuredClone(run.result);let calls=0;
 const r=await repairReconstruction(run,{image,fit:r=>r,read:async()=>{calls++;throw Error('quota exceeded');}});
 assert.equal(calls,1);assert.match(r.error,/quota/);assert.deepEqual(run.result,before);assert.equal(run.repairs[0].state,'failed');
});

test('Repair of a large hall targets the missing perimeter instead of only its centroid',()=>{const targets=reconstructionTargets(fixture(),image);assert.ok(targets.some(t=>t.core.left<=100&&t.core.right>=100&&t.priority>=5));});

test('A closed room with no doorway triggers an opening inventory instead of being called complete',()=>{const r=fixture();r.elements.push(el('close','wall',[[100,900],[100,100]]));const q=reconstructionQuality(r,image);assert.equal(q.compiled.pending.length,0);assert.equal(q.unopened.length,1);assert.equal(q.complete,false);assert.ok(reconstructionTargets(r,image).some(t=>t.focus==='openings'));});
