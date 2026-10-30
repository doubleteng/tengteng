import test from 'node:test';
import assert from 'node:assert/strict';
import {objectSnap,snapGeometry,zoomAt,calibrateImage,alignmentTransform,alignFloor,stairAligned} from '../../teaching/egress/src/drafting.mjs';
import {pairWallFaces} from '../../teaching/egress/src/wall-import.mjs';
import {floorOpenings,usableArea,roomArea} from '../../teaching/egress/src/openings.mjs';
import {demo,fresh} from '../../teaching/egress/src/model.mjs';
import {analyze,analyzeAll} from '../../teaching/egress/src/analysis.mjs';
import {dist,inside} from '../../teaching/egress/src/geometry.mjs';
const pt=(x,y)=>({x,y}),rect=(x,y,w,h)=>[pt(x,y),pt(x+w,y),pt(x+w,y+h),pt(x,y+h)];
const line=(x,y,X,Y,layer='walls')=>({a:pt(x,y),b:pt(X,Y),layer});
const close=(a,b)=>assert.ok(Math.abs(a-b)<1e-7,`${a} ≠ ${b}`);

test('Wheel zoom stays anchored at the pointer and changes only its viewport camera',()=>{
 const a={x:20,y:-10,s:12},b={x:2,y:3,s:8},v={x:400,y:100,w:500,h:600},p=pt(580,330);
 const world=()=>pt(a.x+(p.x-v.x-v.w/2)/a.s,a.y-(p.y-v.y-v.h/2)/a.s),before=world();
 zoomAt(a,p,v,2);close(world().x,before.x);close(world().y,before.y);assert.equal(a.s,24);assert.deepEqual(b,{x:2,y:3,s:8});
});
test('Object snaps prioritize End, Mid, Int, and Perp before Near; Ortho keeps the axis',()=>{
 const geometry={segments:[line(0,0,10,0),line(3,-4,3,4)],points:[]};
 assert.equal(objectSnap(pt(.03,.02),geometry,{tolerance:.2}).kind,'End');
 assert.equal(objectSnap(pt(5.04,.02),geometry,{tolerance:.2}).kind,'Mid');
 const intersection=objectSnap(pt(3.04,.03),{segments:[line(0,0,10,0),line(3,-1,3,6)],points:[]},{tolerance:.2});assert.equal(intersection.kind,'Int');assert.deepEqual(intersection.point,pt(3,0));
 assert.equal(objectSnap(pt(7.02,.03),geometry,{tolerance:.2,anchor:pt(7,5)}).kind,'Perp');
 assert.equal(objectSnap(pt(8.2,.03),geometry,{tolerance:.2}).kind,'Near');
 assert.deepEqual(objectSnap(pt(4,1),geometry,{enabled:false,anchor:pt(1,1.2),ortho:true}).point,pt(4,1.2));
});
test('Hidden CAD layers and hidden model objects do not attract snapping',()=>{
 const g=snapGeometry({walls:[{id:'w',...line(0,0,4,0)}],cad:[line(0,5,4,5,'hidden'),line(0,8,4,8,'shown')],layers:[{id:'hidden',visible:false}]},{walls:false});
 assert.equal(g.segments.length,1);assert.equal(g.segments[0].a.y,8);
});
test('PDF calibration preserves the first reference point and uses actual geometry, not grid rounding',()=>{
 const a=pt(2.123,3.789),b=pt(5.123,3.789),image={x:1,y:2,width:10,height:8,rotation:.3};
 const r=calibrateImage(image,a,b,6);close(r.width,20);close(r.height,16);close((a.x-r.x)/r.width,(a.x-image.x)/image.width);assert.equal(r.calibrated,true);assert.throws(()=>calibrateImage(image,a,a,5));
});
test('Two corresponding grid points align a setback/cantilever plan without rescaling or recentering',()=>{
 const f=fresh().floors[0];f.outline=rect(10,20,14,8);f.walls=[{id:'w',...line(10,20,24,20)}];f.doors=[{x:12,y:20,wallId:'w'}];f.image={x:10,y:20,width:14,height:8};
 const t=alignmentTransform([pt(10,20),pt(20,20)],[pt(0,0),pt(0,10)]);alignFloor(f,t);
 close(f.outline[1].y,14);close(f.outline[2].x,-8);close(dist(f.outline[0],f.outline[1]),14);close(f.doors[0].y,2);close(f.image.rotation,Math.PI/2);assert.equal(f.image.width,14);
 assert.throws(()=>alignmentTransform([pt(0,0),pt(10,0)],[pt(0,0),pt(12,0)]),/calibrate/);
});
test('Double-line proposal preserves thickness and rejects ambiguous or mismatched pairs',()=>{
 let r=pairWallFaces([line(0,0,8,0),line(8,.2,0,.2)]);assert.equal(r.pairs.length,1);close(r.pairs[0].a.y,.1);close(r.pairs[0].thickness,.2);
 r=pairWallFaces([line(0,0,8,0),line(0,.2,8,.2),line(0,.4,8,.4)]);assert.equal(r.pairs.length,0);assert.equal(r.unpaired.length,3);
 assert.equal(pairWallFaces([line(0,0,8,0),line(4,.2,8,.2)]).pairs.length,0);
 assert.equal(pairWallFaces([line(0,0,.3,0),line(0,.2,.3,.2)]).pairs.length,0);
 assert.equal(pairWallFaces([line(0,0,8,0,'a'),line(0,.2,8,.2,'b')]).pairs.length,0);
});
test('Shifted stair footprints cannot create a false connected route by name alone',()=>{
 const p=demo(),f=p.floors[0];f.stairs=[{id:'a',link:'A',protected:true,width:1.2,points:rect(2,8,2,2)}];const u=structuredClone(f);u.id='upper';u.elevation=4;u.doors=u.doors.filter(d=>!d.exit);u.stairs=[{id:'b',link:'A',protected:true,width:1.2,points:rect(20,8,2,2)}];p.floors.push(u);
 assert.equal(stairAligned(f.stairs[0],u.stairs[0]),false);const a=analyzeAll(p);assert.ok(a.complete.some(r=>r.floor===1));assert.ok(a.complete.filter(r=>r.floor===1).every(r=>!r.complete));assert.ok(a.raw[1].checks.some(c=>c.detail.includes('misaligned XY')));
});
test('Openings subtract union area accurately, including overlaps and concave room outlines',()=>{
 close(usableArea(rect(0,0,10,10),[rect(2,2,4,4),rect(4,4,4,4)]),72);
 close(usableArea([pt(0,0),pt(10,0),pt(10,4),pt(4,4),pt(4,10),pt(0,10)],[rect(2,2,4,4)]),52);
 close(usableArea(rect(0,0,10,10),[rect(-1,-1,12,12)]),0);
});
test('Triple-height space retains the base, removes slabs on two upper floors and blocks upper paths',()=>{
 const p=demo(),base=p.floors[0];for(let i=1;i<=3;i++){const f=structuredClone(base);f.id='L'+(i+1);f.elevation=3.6*i;f.doors=f.doors.filter(d=>!d.exit);f.stairs=[{id:'stair'+i,link:'A',protected:true,width:1.2,points:rect(2,8,2,2)}];p.floors.push(f);}
 const voidPolygon=rect(6,2,10,14);p.openings=[{id:'void',name:'Atrium',baseFloorId:base.id,throughFloorId:p.floors[2].id,points:voidPolygon}];
 assert.equal(floorOpenings(p,0).length,0);assert.equal(floorOpenings(p,1).length,1);assert.equal(floorOpenings(p,2).length,1);assert.equal(floorOpenings(p,3).length,0);
 const ground=roomArea(p,0,base.rooms[0]),upper=roomArea(p,1,p.floors[1].rooms[0]);assert.ok(upper<ground);const a=analyze(p,1);assert.ok(a.total<analyze(p,0).total);for(let i=0;i<a.grid.n;i++)if(inside(a.grid.point(i),voidPolygon))assert.equal(a.grid.good[i],0);for(const r of a.routes)assert.ok(r.points.every(q=>!inside(q,voidPolygon)));
});
