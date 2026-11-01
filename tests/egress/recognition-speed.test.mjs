import test from 'node:test';
import assert from 'node:assert/strict';
import {readCoverage,coverageRegions,coverageContext,hasUnresolvedStructure} from '../../teaching/egress/src/plan-coverage.mjs';
import {mergeDetail} from '../../teaching/egress/src/recognition-pipeline.mjs';
import {repairReconstruction} from '../../teaching/egress/src/reconstruction-repair.mjs';
import {recognitionTiming,elapsedLabel} from '../../teaching/egress/src/recognition-timing.mjs';
import {refineSourceWalls} from '../../teaching/egress/src/source-refinement.mjs';
import {strokeMask,attachSourceEvidence} from '../../teaching/egress/src/import-quality.mjs';
import {refineFurnitureGeometry} from '../../teaching/egress/src/furniture-evidence.mjs';
const turn=()=>new Promise(resolve=>setImmediate(resolve));
const empty=()=>({version:1,summary:'fixture',outline:[],elements:[],warnings:[]});
const el=(id,kind,points)=>({id,kind,points,label:id,confidence:'high'});
const run=()=>({result:empty(),regions:coverageRegions(4400,500)});
const merge=(result,detail,region)=>({result:{...result,elements:[...result.elements,region.id]}});

test('Whole-sheet context prevents repeated furniture reads but cannot hide a genuinely omitted wing',()=>{
 const pixels={width:400,height:200,data:new Uint8ClampedArray(400*200*4).fill(255)};
 const draw=(x0,y0,x1,y1)=>{for(let y=y0;y<=y1;y++)for(let x=x0;x<=x1;x++){const k=(y*400+x)*4;pixels.data[k]=pixels.data[k+1]=pixels.data[k+2]=30;}};
 draw(40,50,180,52);draw(40,50,42,150);draw(178,50,180,150);draw(40,148,180,150);
 const detail={...empty(),elements:[el('wall','wall',[[50,0],[50,1000]])]},overview={...empty(),elements:[el('known-room','room',[[50,0],[600,0],[600,1000],[50,1000]])]},region={x:0,y:0,width:1000,height:1000};
 assert.equal(hasUnresolvedStructure(detail,pixels),true);
 assert.equal(hasUnresolvedStructure(detail,pixels,coverageContext(overview,region)),false);
 assert.equal(hasUnresolvedStructure(empty(),pixels,coverageContext(overview,region)),true,'An empty tile response cannot use the overview to certify its own walls');
 draw(320,30,322,180);assert.equal(hasUnresolvedStructure(detail,pixels,coverageContext(overview,region)),true);
 assert.deepEqual(coverageContext(overview,{x:250,y:250,width:500,height:500})[0].points[0],[-400,-500]);
});

test('Two regions read concurrently but out-of-order replies merge in source order',async()=>{
 const state=run(),waiting=new Map(),started=[];
 const work=readCoverage(state,{concurrency:2,merge,read:r=>{started.push(r.id);return new Promise(resolve=>waiting.set(r.id,resolve));}});
 await turn();assert.deepEqual(started,['tile-0-0','tile-0-1']);
 waiting.get('tile-0-1')(empty());await turn();assert.equal(state.result.elements.length,0);assert.equal(started.length,2);
 waiting.get('tile-0-0')(empty());await turn();assert.deepEqual(started,state.regions.map(r=>r.id));
 waiting.get('tile-0-3')(empty());waiting.get('tile-0-2')(empty());await work;
 assert.deepEqual(state.result.elements,state.regions.map(r=>r.id));assert.ok(state.regions.every(r=>r.state==='read'));
});
test('A split tile retains deterministic merge order while its neighbor is already in flight',async()=>{
 const execute=async concurrency=>{const state={result:empty(),regions:coverageRegions(1600,500)},calls=[];await readCoverage(state,{concurrency,merge,read:async r=>{calls.push(r.id);await turn();if(r.id==='tile-0-0')throw Error('Unresolved structure outside described areas');return empty();}});return {state,calls};};
 const serial=await execute(1),parallel=await execute(2);
 assert.deepEqual(parallel.state.result,serial.state.result);assert.deepEqual(parallel.state.result.elements,['tile-0-0-0','tile-0-0-1','tile-0-1']);
 assert.equal(parallel.calls.filter(id=>id==='tile-0-0').length,1);assert.equal(new Set(parallel.calls).size,4);
});
test('Cancellation retains successful concurrent replies for resume without importing them',async()=>{
 const state=run(),waiting=[],calls=[];let cancelled=false;
 const options={concurrency:2,merge,cancelled:()=>cancelled,read:r=>{calls.push(r.id);return new Promise(resolve=>waiting.push(resolve));}};
 const work=readCoverage(state,options);await turn();cancelled=true;for(const resolve of waiting)resolve(empty());await work;
 assert.equal(state.result.elements.length,0);assert.ok(state.regions.slice(0,2).every(r=>r.response&&r.state==='pending'));
 cancelled=false;await readCoverage(state,{...options,read:async r=>{calls.push(r.id);return empty();}});
 assert.deepEqual(calls,state.regions.map(r=>r.id));assert.ok(state.regions.every(r=>r.state==='read'));
});
test('Quota failure preserves a successful in-flight reply and starts no more regions',async()=>{
 const state=run(),calls=[];
 await readCoverage(state,{concurrency:2,merge,read:async r=>{calls.push(r.id);if(r.id==='tile-0-0')throw Error('Shared quota reached');await turn();return empty();}});
 assert.equal(calls.length,2);assert.equal(state.result.elements.length,0);assert.ok(state.regions[1].response);assert.equal(state.regions[2].state,'pending');
 await readCoverage(state,{concurrency:2,merge,read:async r=>{calls.push(r.id);return empty();}});
 assert.equal(calls.filter(id=>id==='tile-0-1').length,1);assert.ok(state.regions.every(r=>r.state==='read'));
});
test('A single available service slot falls back to serial after admitted work finishes',async()=>{
 const state=run();let active=0,busy=0;
 await readCoverage(state,{concurrency:2,merge,read:async()=>{if(active){busy++;throw Error('Recognition is busy with other plans. Please try again in a minute.');}active++;await turn();active--;return empty();}});
 assert.equal(busy,1);assert.ok(state.regions.every(r=>r.state==='read'));assert.equal(active,0);
});
test('Parallel scheduling yields the same actual wall coordinates as serial merging',async()=>{
 const detail={...empty(),elements:[el('wall','wall',[[100,100],[900,100]]),el('room','room',[[100,100],[900,100],[900,900],[100,900]])]};
 const execute=async concurrency=>{const state=run();await readCoverage(state,{concurrency,merge:mergeDetail,read:async()=>{await turn();return structuredClone(detail);}});return state.result;};
 assert.deepEqual(await execute(2),await execute(1));
});
const image={x:0,y:0,width:10,height:10,calibrated:true};
function repairRun(){const outline=[[100,100],[900,100],[900,900],[100,900]];return {result:{...empty(),outline,elements:[el('hall','room',outline),...outline.map((p,i)=>el('wall'+i,'wall',[p,outline[(i+1)%4]]))]}};}
test('Parallel local rereads preserve safeguards, respect the budget and resume unread targets',async()=>{
 const state=repairRun();let active=0,peak=0,calls=0;
 const read=async()=>{calls++;active++;peak=Math.max(peak,active);await turn();active--;return empty();};
 await repairReconstruction(state,{image,read,fit:r=>r,concurrency:2,maxCalls:3});assert.equal(calls,3);assert.equal(peak,2);assert.equal(state.repairs.length,3);
 const before=structuredClone(state.result);await repairReconstruction(state,{image,read,fit:r=>r,concurrency:2,maxCalls:2});assert.equal(calls,5);assert.deepEqual(state.result,before);assert.equal(new Set(state.repairs.map(r=>r.key)).size,5);
});
test('Canceled local rereads are reused without another service call',async()=>{
 const state=repairRun(),waiting=[];let cancelled=false,calls=0;
 const work=repairReconstruction(state,{image,fit:r=>r,concurrency:2,maxCalls:2,cancelled:()=>cancelled,read:()=>{calls++;return new Promise(resolve=>waiting.push(resolve));}});
 await turn();cancelled=true;for(const resolve of waiting)resolve(empty());await work;assert.equal(calls,2);assert.ok(state.repairs.every(e=>e.state==='ready'));
 await repairReconstruction(state,{image,fit:r=>r,concurrency:2,maxCalls:2,read:async()=>{calls++;return empty();}});
 assert.equal(calls,4);assert.equal(state.repairs.length,4);assert.equal(new Set(state.repairs.map(e=>e.key)).size,4);assert.ok(state.repairs.every(e=>e.state==='rejected'));
});
test('An early successful repair drains just one look-ahead reply without applying it',async()=>{
 const state=repairRun();let calls=0;
 const result=await repairReconstruction(state,{image,fit:r=>r,concurrency:2,read:async region=>{
  const index=calls++;await turn();if(index)return empty();
  const x=(region.core.left+region.core.right)/2;
  return {...empty(),elements:[el('entry','door',[[x-20,100],[x+20,100]].map(([x,y])=>[(x-region.x)/region.width*1000,(y-region.y)/region.height*1000]))]};
 }});
 assert.equal(result.quality.complete,true);assert.equal(calls,2);assert.equal(state.repairs[0].state,'accepted');assert.equal(state.repairs[1].state,'ready');
});
test('Reusing an immutable source mask preserves wall and furniture evidence exactly',()=>{
 const pixels={width:160,height:100,data:new Uint8ClampedArray(160*100*4).fill(255)};
 for(let y=10;y<90;y++)for(let x=12;x<16;x++){const k=(y*160+x)*4;pixels.data[k]=pixels.data[k+1]=pixels.data[k+2]=20;}
 const input={...empty(),elements:[el('w','wall',[[90,100],[90,900]])]},source=strokeMask(pixels),fitted=refineSourceWalls(input,pixels);
 assert.deepEqual(attachSourceEvidence(fitted,pixels,source),attachSourceEvidence(fitted,pixels));
 assert.deepEqual(refineFurnitureGeometry(input,pixels,source),refineFurnitureGeometry(input,pixels));
});
test('Timings distinguish elapsed wall time from overlapping provider call time',async()=>{
 let now=0;const state={},timer=recognitionTiming(state,()=>now),waiting=[];
 const a=timer.measure('model',()=>new Promise(resolve=>waiting.push(resolve)));now=10;
 const b=timer.measure('model',()=>new Promise(resolve=>waiting.push(resolve)));now=100;
 waiting[1]('b');await b;now=150;waiting[0]('a');await a;
 const s=timer.finish();assert.equal(s.elapsedMs,150);assert.equal(s.phases.model.totalMs,240);assert.equal(s.phases.model.maxConcurrent,2);assert.equal(s.phases.model.calls,2);assert.equal(elapsedLabel(61000),'1:01');
});
