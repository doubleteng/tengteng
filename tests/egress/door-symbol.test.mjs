import test from 'node:test';
import assert from 'node:assert/strict';
import {hostedDoorSymbol,doorSymbolLines} from '../../teaching/egress/src/door-symbol.mjs';
import {openingHost} from '../../teaching/egress/src/import-quality.mjs';
const point=(x,y)=>({x,y}),wall=(id,a,b)=>({id,a,b,thickness:.15});
for(const rotation of [0,.37,-.8,Math.PI])for(const side of [-1,1])test('Observed hinge and side follow host rotation '+rotation+' / '+side,()=>{
 const turn=p=>point(p.x*Math.cos(rotation)-p.y*Math.sin(rotation),p.x*Math.sin(rotation)+p.y*Math.cos(rotation));
 const w=wall('host',turn(point(0,0)),turn(point(8,0))),candidate={points:[turn(point(3,0)),turn(point(4,0))],swingPoint:turn(point(3,side)),openingEvidence:{hinge:'start',swingAngle:90}};
 const symbol=hostedDoorSymbol(candidate,w),door={...turn(point(3.5,0)),width:1,symbol},lines=doorSymbolLines(door,w);
 assert.equal(symbol.openSide,side);assert.equal(symbol.hingeSide,-1);
 for(const [actual,expected] of [[lines[0][0],turn(point(3,0))],[lines[0][1],turn(point(3,side))]])assert.ok(Math.hypot(actual.x-expected.x,actual.y-expected.y)<1e-8);
});
test('Double leaf symbol is one door with two leaves and sliding door has no invented swing',()=>{
 const w=wall('w',point(0,0),point(10,0)),c={points:[point(4,0),point(6,0)],swingPoint:point(5,1),openingEvidence:{hinge:'both',swingAngle:90}};
 const lines=doorSymbolLines({x:5,y:0,width:2,symbol:hostedDoorSymbol(c,w)},w);
 assert.equal(lines.length,4);assert.ok(Math.abs(lines[0][1].x-4)<1e-8);assert.ok(Math.abs(lines[2][1].x-6)<1e-8);
 assert.equal(hostedDoorSymbol({points:c.points,doorType:'sliding'},w),null);
});
test('One perpendicular jamb supports a corner doorway; two perpendicular walls do not imply a host',()=>{
 const opening=[point(0,2),point(1,2)],cross=wall('cross',point(0,0),point(0,4)),parallel=wall('parallel',point(1,2),point(4,2));
 assert.ok(openingHost([cross,parallel],opening).gap);
 assert.ok(openingHost([cross,wall('other',point(1,0),point(1,4))],opening).error);
});
