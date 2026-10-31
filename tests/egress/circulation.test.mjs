import test from 'node:test';
import assert from 'node:assert/strict';
import {createExample} from '../../teaching/egress/src/examples.mjs';
import {analyzeAll,summary} from '../../teaching/egress/src/analysis.mjs';

test('Savoye rooms can show circulation to a stair without creating exit routes or capacity allocation',()=>{
 const p=createExample('savoye'),before=JSON.stringify(p),a=analyzeAll(p),f=a.raw[1];
 assert.equal(f.circulationRoutes.length,8);assert.equal(f.routes.length,0);assert.equal(f.exits,0);
 assert.equal(f.rooms.filter(r=>r.circulation?.state==='connected').length,7);
 assert.equal(f.rooms.find(r=>r.id==='roof-garden').circulation.state,'partial');
 assert.equal(f.capacity.unassigned,f.total);assert.ok(f.capacity.rows.every(r=>!r.allocationKnown));
 assert.ok(a.complete.filter(r=>r.floor>0).every(r=>!r.complete&&r.distance===null));
 assert.match(a.complete.find(r=>r.room==='living').reason,/not assigned as an exit/);
 assert.equal(JSON.stringify(p),before);assert.equal(summary(a).floors[1].circulationRoutes.length,8);
});
test('Removing a room door leaves a precise obstruction instead of a path through its wall',()=>{
 const p=createExample('savoye');p.floors[1].doors=p.floors[1].doors.filter(d=>d.id!=='Guest passage');
 const f=analyzeAll(p).raw[1],guest=f.rooms.find(r=>r.id==='guest');
 assert.equal(guest.circulation.state,'blocked');assert.ok(!f.circulationRoutes.some(r=>r.room==='guest'));
 assert.match(guest.routeReason,/No geometric route to the stair/);
 assert.ok(f.checks.some(c=>c.title==='Guest room · exhibit: no geometric route to stair'&&c.status==='fail'));
});
test('A qualified exit route takes priority and does not get a duplicate provisional path',()=>{
 const p=createExample('savoye');for(const f of p.floors)for(const s of f.stairs)s.protected=true;
 const f=analyzeAll(p).raw[1];assert.ok(f.routes.some(r=>r.room==='living'));assert.equal(f.circulationRoutes.length,0);
});
test('A stair inside an upper-floor slab opening is not a valid circulation destination',()=>{
 const p=createExample('savoye'),f=p.floors[2];f.stairs[0].points=[{x:18,y:12},{x:19,y:12},{x:19,y:13},{x:18,y:13}];
 assert.equal(analyzeAll(p).raw[2].circulationRoutes.length,0);
});
