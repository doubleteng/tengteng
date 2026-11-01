import test from 'node:test';
import assert from 'node:assert/strict';
import {repairReconstruction,reconstructionQuality,reconstructionTargets,improvesReconstruction} from '../../teaching/egress/src/reconstruction-repair.mjs';
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

test('A doorway guessed on a solid wall cannot improve a pixel-fitted reconstruction score',()=>{
 const r=fixture();r.elements.push(el('close','wall',[[100,900],[100,100]]));r.sourceRefinement={version:8};
 const before=reconstructionQuality(r,image);r.elements.push(el('guessed','door',[[400,100],[500,100]]));
 const after=reconstructionQuality(r,image);assert.equal(after.unopened.length,1);assert.equal(after.score,before.score);
 r.elements.at(-1).openingEvidence={located:true,autoDoor:false};assert.equal(reconstructionQuality(r,image).unopened.length,0);
});

test('Adding openings cannot earn an improvement by merging two already enclosed rooms',()=>{
 const base={version:1,outline,warnings:[],elements:[...outline.map((p,i)=>el('w'+i,'wall',[p,outline[(i+1)%4]])),el('divider','wall',[[500,100],[500,900]]),el('left','room',rect(100,100,400,800)),el('right','room',rect(500,100,400,800))]};
 const changed={...base,elements:[...base.elements.filter(e=>e.id!=='divider'),el('entry','door',[[300,100],[400,100]])]};
 const before=reconstructionQuality(base,image),after=reconstructionQuality(changed,image);
 assert.equal(before.model.rooms.length,2);assert.equal(after.model.rooms.length,1);assert.ok(after.score<before.score);
 assert.equal(improvesReconstruction(before,after),false);
});

test('An opening repair cannot introduce a new unlabelled enclosed cell',()=>{
 const base=fixture();base.elements.push(el('close','wall',[[100,900],[100,100]]));
 const changed={...base,elements:[...base.elements,el('new-wall','wall',[[700,100],[700,900]]),el('entry','door',[[300,100],[400,100]])]};
 const before=reconstructionQuality(base,image),after=reconstructionQuality(changed,image);
 assert.equal(before.model.rooms.length,1);assert.equal(after.model.rooms.length,2);assert.ok(after.score<before.score);
 assert.equal(improvesReconstruction(before,after),false);
});
test('Opening inventory salvages a real doorway without importing unrelated partition changes',async()=>{
 const outline=rect(300,300,400,400),result={version:1,outline,warnings:[],elements:[el('room','room',outline),...outline.map((p,i)=>el('w'+i,'wall',[p,outline[(i+1)%4]]))]},run={result};
 const output=await repairReconstruction(run,{image,fit:r=>r,read:async region=>{
  const map=([x,y])=>[(x-region.x)/region.width*1000,(y-region.y)/region.height*1000];
  return {version:1,outline:[],warnings:[],elements:[el('door','door',[[480,300],[520,300]].map(map)),el('unwanted-divider','wall',[[600,300],[600,700]].map(map))]};
 }});
 assert.equal(output.quality.model.rooms.length,1);assert.equal(output.quality.unopened.length,0);
 assert.equal(run.repairs[0].strategy,'openings-only');assert.equal(run.result.elements.some(e=>e.id.includes('unwanted-divider')),false);
});
test('Missing doorways in a large hall are sought along its perimeter, not its empty center',()=>{
 const result=fixture();result.elements.push(el('close','wall',[[100,900],[100,100]]));
 const targets=reconstructionTargets(result,image,{limit:64}).filter(t=>t.focus==='openings');
 assert.ok(targets.some(t=>t.core.top<=100&&t.core.bottom>=100));
 assert.ok(targets.some(t=>t.core.top<=900&&t.core.bottom>=900));
 assert.ok(targets.some(t=>t.core.left<=100&&t.core.right>=100));
 assert.ok(targets.some(t=>t.core.left<=900&&t.core.right>=900));
 assert.ok(targets.every(t=>Math.abs(t.cx-500)>200||Math.abs(t.cy-500)>200));
});
test('Resuming an incomplete repair reads unvisited regions instead of repeating the first batch',async()=>{
 const result=fixture();result.elements.push(el('close','wall',[[100,900],[100,100]]));const run={result},read=async()=>({version:1,outline:[],warnings:[],elements:[]});
 await repairReconstruction(run,{image,fit:r=>r,read,maxCalls:2});
 await repairReconstruction(run,{image,fit:r=>r,read,maxCalls:2});
 assert.equal(run.repairs.length,4);assert.equal(new Set(run.repairs.map(e=>e.key)).size,4);
 assert.ok(run.repairs.every(e=>e.state==='rejected'));
});

test('Clipped exterior proposals trigger automatic surrounding-context recognition',async()=>{
 const result=fixture();result.elements.push(el('close','wall',[[100,900],[100,100]]),el('entry','door',[[400,100],[500,100]]),{...el('partial-site','exterior',rect(910,400,70,200)),partial:true});
 const before=reconstructionQuality(result,image);assert.equal(before.compiled.pendingFeatures.length,1);assert.equal(before.complete,false);
 const run={result};const output=await repairReconstruction(run,{image,fit:r=>r,read:async region=>{
  assert.equal(region.focus,'architecture');
  const map=([x,y])=>[(x-region.x)/region.width*1000,(y-region.y)/region.height*1000];
  return {...result,elements:[el('context','wall',[[900,400],[900,600]].map(map))]};
 }});
 assert.equal(output.quality.compiled.pendingFeatures.length,0);assert.equal(output.quality.model.rooms.length,1);assert.equal(run.repairs[0].state,'accepted');
});
