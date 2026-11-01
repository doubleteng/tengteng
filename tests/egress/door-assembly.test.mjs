import test from 'node:test';
import assert from 'node:assert/strict';
import {doorAssembly,doorScheduleReport} from '../../teaching/egress/src/door-assembly.mjs';
import {deduplicateOpenings} from '../../teaching/egress/src/opening-identity.mjs';
import {confirmOpening,validateInterpretation,materializeInterpretation} from '../../teaching/egress/src/semantic-plan.mjs';
import {validateProject} from '../../teaching/egress/src/model.mjs';
import {analyze} from '../../teaching/egress/src/analysis.mjs';
import {doorSwingCheck} from '../../teaching/egress/src/plan-code.mjs';
import {bottleneckFixture} from './capacity-fixture.mjs';

for(const [doorType,leafCount] of [['double',2],['sliding',2],['folding',4]]){
 test(doorType+' leaves become one full doorway, survive confirmation and retain one width',()=>{
  const walls=[{id:'l',a:{x:0,y:0},b:{x:4,y:0}},{id:'r',a:{x:6,y:0},b:{x:10,y:0}}];
  const candidates=Array.from({length:leafCount},(_,i)=>({id:'leaf'+i,kind:'door',doorType,leafCount,points:[{x:4+i*2/leafCount,y:0},{x:4+(i+1)*2/leafCount,y:0}]}));
  const merged=deduplicateOpenings(walls,candidates);assert.equal(merged.length,1);assert.equal(merged[0].doorType,doorType);assert.equal(merged[0].leafCount,leafCount);
  const f={elevation:0,walls,doors:[],rooms:[],candidates};
  const d=confirmOpening(f,candidates[0]);assert.equal(f.doors.length,1);assert.equal(f.candidates.length,0);assert.equal(d.width,2);assert.equal(d.doorType,doorType);assert.equal(d.leafCount,leafCount);
  assert.equal(confirmOpening(f,candidates.at(-1)).id,d.id);assert.equal(f.doors.length,1);
 });
 test(doorType+' does not multiply exit count, route load, clear width or report rows',()=>{
  const p=bottleneckFixture(),base=analyze(p),d=p.floors[0].doors.find(d=>d.exit);
  Object.assign(d,{doorType,leafCount});const a=analyze(p),row=a.capacity.rows.find(r=>r.id===d.id),before=base.capacity.rows.find(r=>r.id===d.id);
  assert.equal(a.exits,base.exits);assert.equal(a.exits,1);assert.equal(a.capacity.rows.length,base.capacity.rows.length);
  assert.equal(row.load,before.load);assert.equal(row.available,before.available);assert.equal(row.capacity,before.capacity);
  const reopened=validateProject(JSON.parse(JSON.stringify(p)));assert.deepEqual(doorAssembly(reopened.floors[0].doors.find(o=>o.id===d.id)),{doorType,leafCount});
  const html=doorScheduleReport(reopened);assert.equal((html.match(/<td>1<\/td>/g)||[]).length,3);assert.match(html,new RegExp(leafCount+' leaves/panels'));
 });
}
test('Imported assembly attributes survive validation and model creation without treating duplicate proposals as leaf counts',()=>{
 const raw={version:1,outline:[],warnings:[],elements:[{id:'d',kind:'door',label:'Slider',points:[[400,500],[600,500]],doorType:'sliding',leafCount:2}]};
 const result=validateInterpretation(raw),m=materializeInterpretation(result,{x:0,y:0,width:10,height:10,calibrated:true},{deriveRooms:false});
 assert.deepEqual(doorAssembly(m.candidates[0]),{doorType:'sliding',leafCount:2});
 assert.deepEqual(doorAssembly({doorType:'invalid',leafCount:-4}),{doorType:'unknown',leafCount:null});
});
test('Sliding and folding doors cannot pass a hinged swing check through a stale swing property',()=>{
 const p=bottleneckFixture(),d=p.floors[0].doors[0];
 for(const doorType of ['sliding','folding']){Object.assign(d,{doorType,swing:'with'});const c=doorSwingCheck(p,0,d);assert.equal(c.status,'input');assert.match(c.title,/confirm egress operation/);assert.match(c.measured,/1 doorway/);}
});
test('Door schedule escapes names and treats unknown leaf counts as unknown',()=>{
 const p=bottleneckFixture();p.floors[0].doors[0].name='<img src=x>';const html=doorScheduleReport(p);assert.ok(!html.includes('<img src=x>'));assert.match(html,/&lt;img src=x&gt;/);assert.match(html,/Door type not identified/);
});
