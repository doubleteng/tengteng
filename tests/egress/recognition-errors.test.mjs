import test from 'node:test';
import assert from 'node:assert/strict';
import {readRecognitionOverview,requireRecognitionGeometry,recognitionFailure,recognitionServiceError} from '../../teaching/egress/src/recognition-errors.mjs';
import {readCoverage,coverageRegions} from '../../teaching/egress/src/plan-coverage.mjs';
const empty=()=>({version:1,outline:[],elements:[],warnings:[]});
const state=()=>({result:empty(),regions:coverageRegions(1400,840)});
const quota='Today’s shared recognition allowance has been used. Your drawing is saved locally; contact your instructor.';
const wall={id:'w',kind:'wall',points:[[0,0],[100,100]]};

test('A daily-limit failure at overview stops before tile reading or empty reconstruction',async()=>{
 const run=state();let calls=0,continued=false;
 await assert.rejects(async()=>{await readRecognitionOverview(run,async()=>{calls++;throw Error(quota);});continued=true;},/allowance/);
 assert.equal(calls,1);assert.equal(continued,false);assert.equal(run.result.elements.length,0);
 assert.ok(run.regions.every(r=>r.state==='pending'));
});
test('An invalid overview can still fall back to independently read regions',async()=>{
 const run=state();assert.equal(await readRecognitionOverview(run,async()=>{throw Error('Invalid geometry data');}),null);
 assert.match(run.result.warnings[0],/Invalid geometry/);
 const successful=await readRecognitionOverview(run,async()=>({model:'test'}));assert.equal(successful.model,'test');
});
test('Quota after a saved tile retains geometry but prevents starting reconstruction',async()=>{
 const run=state();run.result.elements.push(wall);run.regions[0].state='read';const before=structuredClone(run.result);let calls=0;
 await readCoverage(run,{read:async()=>{calls++;throw Error(quota);},merge:()=>{throw Error('Must not merge a failed response');}});
 assert.equal(calls,1);assert.throws(()=>requireRecognitionGeometry(run),/allowance/);assert.deepEqual(run.result,before);
 const failure=recognitionFailure({recognitionRun:run});assert.equal(failure.read,1);assert.equal(failure.total,4);assert.match(failure.title,/Daily request limit/);
});
test('An old zero-object preview recovers the service failure rather than reporting an open wall',()=>{
 const run=state();run.result.warnings.push('Overview unavailable; continuing with individual regions: '+quota);
 const image={interpretation:empty(),recognitionRun:run};const failure=recognitionFailure(image);
 assert.equal(failure.title,'Daily request limit reached');assert.equal(failure.hasDraft,false);assert.match(failure.message,/app’s shared daily request/);
 assert.doesNotMatch(failure.message,/closed wall|geometry|Google/);
});
test('Application allowance and Google quota have distinct explanations',()=>{
 assert.equal(recognitionFailure({},quota).title,'Daily request limit reached');
 assert.equal(recognitionFailure({},'The shared recognition service reached its Google quota.').title,'Google request limit reached');
 assert.equal(recognitionFailure({},'This recognition session has reached its allowance.').title,'Session request limit reached');
});
test('An empty model response is a missing result, never a geometric diagnosis',()=>{
 const run=state();assert.throws(()=>requireRecognitionGeometry(run),/no architectural objects/);
 assert.equal(recognitionFailure({recognitionRun:run}).title,'No recognition result');
});
test('A successful resume ignores old warnings and leaves prior editable geometry intact',()=>{
 const run=state();run.result.elements.push(wall);run.result.warnings.push(quota);run.regions.forEach(r=>r.state='read');
 assert.equal(recognitionServiceError(run),null);assert.doesNotThrow(()=>requireRecognitionGeometry(run));
 const image={interpretation:{...empty(),elements:[wall]},recognitionRun:run},before=structuredClone(image);
 const failure=recognitionFailure(image,quota);assert.equal(failure.hasDraft,true);assert.deepEqual(image,before);
});
