import test from 'node:test';
import assert from 'node:assert/strict';
import {createExample,examples,exampleGoals} from '../../teaching/egress/src/examples.mjs';
import {validateProject} from '../../teaching/egress/src/model.mjs';
import {analyzeAll,summary} from '../../teaching/egress/src/analysis.mjs';
import {moveWall,syncEnclosedRooms} from '../../teaching/egress/src/editable-plan.mjs';
import {roomArea} from '../../teaching/egress/src/openings.mjs';
import {doorSwingCheck} from '../../teaching/egress/src/plan-code.mjs';
import {precedentSourcesHtml} from '../../teaching/egress/src/examples-ui.mjs';
const analyze=p=>summary(analyzeAll(p));
test('Practice cases are independent editable projects and all guided targets exist',()=>{
 for(const e of examples){const p=validateProject(createExample(e.id)),again=createExample(e.id);assert.notEqual(p.id,again.id);p.name='Changed';assert.notEqual(p.name,again.name);
  for(const s of e.steps.filter(s=>s.target)){const scope=s.scope==='site'?p.site:p.floors[s.floor??0];const entities=[...Object.values(scope).filter(Array.isArray).flat(),...(p.openings||[])];assert.ok(entities.some(o=>o.id===s.target),e.id+': '+s.target);}
  assert.equal(validateProject(JSON.parse(JSON.stringify(p))).tutorial.id,e.id);
 }
});
test('Indoor case has routes for every room and a genuine, repairable width/swing problem',()=>{
 const p=createExample('rooms');let a=analyze(p);assert.ok(a.complete.length===3&&a.complete.every(r=>r.complete));assert.equal(exampleGoals(p,a).find(g=>g.id==='door').met,false);
 const d=p.floors[0].doors.find(d=>d.id==='workshop-door');d.width=1.2;d.swing='with';a=analyze(p);assert.equal(exampleGoals(p,a).find(g=>g.id==='door').met,true);
 p.floors[0].doors=p.floors[0].doors.filter(o=>o.id!==d.id);assert.equal(exampleGoals(p,analyze(p)).find(g=>g.id==='door').met,false);
});
test('Moving the practice divider changes both areas and retains room identities',()=>{
 const p=createExample('rooms'),f=p.floors[0],w=f.walls.find(w=>w.id==='studio-divider'),before=structuredClone(f),sum=f.rooms.reduce((n,r)=>n+roomArea(p,0,r),0);
 moveWall(f,w.id,{x:14,y:0},{x:14,y:6},before);syncEnclosedRooms(f);
 assert.equal(roomArea(p,0,f.rooms.find(r=>r.id==='workshop')),84);assert.equal(roomArea(p,0,f.rooms.find(r=>r.id==='studio')),60);
 assert.equal(f.rooms.reduce((n,r)=>n+roomArea(p,0,r),0),sum);assert.equal(exampleGoals(p,analyze(p)).find(g=>g.id==='wall').met,true);
});
test('Site practice goals change with court width, actual crossing geometry and shared exit',()=>{
 const p=createExample('site');assert.ok(exampleGoals(p,analyze(p)).every(g=>g.met===false));
 p.site.routes.find(r=>r.id==='west-path').width=1.5;
 p.site.routes.find(r=>r.id==='service').points=[{x:-6,y:-3},{x:24,y:-3}];p.floors[0].doors.find(d=>d.id==='east-exit').y=9;
 const a=analyze(p);assert.ok(exampleGoals(p,a).every(g=>g.met===true));assert.ok(a.complete.every(r=>r.complete));
});
test('Matching the stair link repairs the top-floor journey; triple height removes only upper slabs',()=>{
 const p=createExample('levels');assert.equal(analyze(p).complete.find(r=>r.floor===2).complete,false);
 p.floors[2].stairs[0].link='Stair A';p.openings[0].throughFloorId=p.floors[2].id;
 const a=analyze(p);assert.ok(exampleGoals(p,a).every(g=>g.met===true));assert.equal(roomArea(p,0,p.floors[0].rooms[0]),280);assert.equal(roomArea(p,1,p.floors[1].rooms[0]),264);assert.equal(roomArea(p,2,p.floors[2].rooms[0]),236);
 p.floors[2].stairs[0].points=p.floors[2].stairs[0].points.map(q=>({...q,x:q.x+5}));assert.equal(exampleGoals(p,analyze(p)).find(g=>g.id==='stair').met,false);
});
test('Pending analysis cannot mark practice goals complete and missing targets stay incomplete',()=>{
 for(const e of examples){const p=createExample(e.id);assert.ok(exampleGoals(p,null).every(g=>g.met===null));}
 const p=createExample('site');p.site.routes=[];assert.ok(exampleGoals(p,analyze(p)).every(g=>g.met===false));
});
test('Barcelona study retains separate pavilions, excluded pools and attributed source geometry',()=>{
 const p=createExample('barcelona'),a=analyze(p);assert.equal(a.complete.length,2);assert.ok(a.complete.every(r=>r.complete));assert.equal(p.site.obstacles.filter(o=>o.id.includes('pool')).length,2);
 assert.ok(p.precedent.sources.some(s=>s.url.includes('creativecommons.org')));assert.equal(p.floors[0].image.calibrated,false);
 const f=p.floors[0],before=f.rooms.map(r=>r.id);f.walls.find(w=>w.id==='onyx').a.x+=.5;syncEnclosedRooms(f);assert.deepEqual(f.rooms.map(r=>r.id),before);
});
test('Open precedent passage does not acquire a fictional door swing or door minimum pass',()=>{
 const p=createExample('barcelona'),a=analyze(p),d=p.floors[0].doors.find(d=>d.openingType==='passage');
 assert.equal(doorSwingCheck(p,0,d,a).status,'review');assert.ok(!a.floors[0].checks.some(c=>c.title===d.name+': general minimum clear width'));
 const row=a.floors[0].capacity.rows.find(r=>r.id===d.id);assert.equal(row.kind,'passage');assert.equal(row.status,'review');assert.match(row.widthSource,/unverified/);
});
test('Savoye terrace retains a slab, roof excludes it, and unprotected circulation cannot establish egress',()=>{
 const p=createExample('savoye'),r=p.floors[1].rooms.find(r=>r.id==='roof-garden'),a=analyze(p);
 assert.ok(roomArea(p,1,r)>100);assert.ok(roomArea(p,2,p.floors[2].rooms[0])<448);assert.ok(p.floors.every(f=>f.stairs.every(s=>s.protected===false)));
 assert.ok(a.complete.filter(r=>r.floor>0).every(r=>!r.complete));assert.ok(!a.floors.flatMap(f=>f.rooms).some(r=>r.outsideBoundary));
});
test('Precedent sources survive export and are escaped in the report',()=>{
 const p=JSON.parse(JSON.stringify(createExample('savoye')));const html=precedentSourcesHtml(p);assert.match(html,/Centre des monuments/);assert.match(html,/teaching assumptions/);
 p.precedent.title='<img src=x>';p.precedent.sources=[{label:'Bad',url:'javascript:alert(1)'}];const safe=precedentSourcesHtml(p);assert.match(safe,/&lt;img/);assert.ok(!safe.includes('javascript:'));
});
