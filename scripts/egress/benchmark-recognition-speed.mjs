// Isolate scheduling from variable provider latency. This is a controlled
// latency benchmark, not an end-to-end Gemini performance claim.
import {performance} from 'node:perf_hooks';
import {readCoverage,coverageRegions} from '../../teaching/egress/src/plan-coverage.mjs';
const cases=[];
for(const concurrency of [1,2]){
 const run={result:{elements:[]},regions:coverageRegions(8800,500,{maxAxis:8})};
 let active=0,maxConcurrent=0,calls=0;const start=performance.now();
 await readCoverage(run,{concurrency,read:async region=>{calls++;active++;maxConcurrent=Math.max(maxConcurrent,active);await new Promise(resolve=>setTimeout(resolve,40));active--;return region.id;},merge:(result,detail)=>({result:{elements:[...result.elements,detail]}})});
 cases.push({concurrency,calls,maxConcurrent,elapsedMs:Math.round(performance.now()-start),order:run.result.elements});
}
console.log(JSON.stringify({scope:'Controlled 40 ms response latency; no Gemini calls',cases,sameOrder:JSON.stringify(cases[0].order)===JSON.stringify(cases[1].order),reduction:1-cases[1].elapsedMs/cases[0].elapsedMs},null,2));
