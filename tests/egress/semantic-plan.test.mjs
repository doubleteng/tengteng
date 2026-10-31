import test from 'node:test';import assert from 'node:assert/strict';
import {validateInterpretation,materializeInterpretation,confirmOpening,featureObstacles,imagePoint} from '../../teaching/egress/src/semantic-plan.mjs';
import {roomArea} from '../../teaching/egress/src/openings.mjs';
import {fresh} from '../../teaching/egress/src/model.mjs';import {analyze} from '../../teaching/egress/src/analysis.mjs';
const rect=(x,y,w,h)=>[[x,y],[x+w,y],[x+w,y+h],[x,y+h]],el=(id,kind,points)=>({id,kind,label:id,points,confidence:'medium',evidence:'Test interpretation, not a recognition accuracy fixture.'});
const drawing={version:1,summary:'Test contract',outline:rect(0,0,1000,1000),warnings:[],elements:[el('open library','room',rect(0,0,1000,800)),el('circulation','corridor',rect(0,800,1000,200)),el('table','furniture',rect(200,200,200,100)),el('shelf','furniture',rect(500,200,20,400)),el('entry','entrance',[[0,820],[0,920]]),el('stair','stair',rect(800,600,150,150))]};
drawing.elements.push(...[[[0,0],[1000,0]],[[1000,0],[1000,1000]],[[1000,1000],[0,1000]],[[0,1000],[0,0]]].map((points,i)=>el('wall-'+i,'wall',points)));
drawing.elements.push(el('partition','wall',[[0,800],[1000,800]]),el('internal opening','door',[[450,800],[550,800]]));
const image={x:0,y:0,width:10,height:10,rotation:0,calibrated:true};
test('Furniture never subdivides rooms or becomes wall geometry',()=>{
 const r=validateInterpretation(drawing),m=materializeInterpretation(r,image);assert.equal(m.rooms.length,2);assert.equal(m.rooms[1].role,'corridor');assert.equal(m.walls.length,5);assert.equal(m.features.length,2);assert.equal(m.features[0].blocksMovement,false);assert.equal(featureObstacles(m).length,0);
 const p=fresh();Object.assign(p.floors[0],m);const before=roomArea(p,0,m.rooms[0]);m.features.forEach(f=>f.blocksMovement=true);assert.equal(featureObstacles(m).length,2);assert.equal(roomArea(p,0,m.rooms[0]),before);assert.equal(before,80);
});
test('Recognized opening proposals do not provide exits until explicitly confirmed',()=>{
 const p=fresh(),m=materializeInterpretation(validateInterpretation(drawing),image);Object.assign(p.floors[0],m);assert.equal(m.doors.length,0);assert.equal(m.candidates.length,2);assert.equal(analyze(p).exits,0);assert.ok(analyze(p).checks.some(c=>c.title.includes('await confirmation')));
 const d=confirmOpening(p.floors[0],m.candidates[0],{exit:true,width:1});assert.equal(d.wallId,m.walls[3].id);assert.equal(p.floors[0].candidates.length,1);assert.equal(d.discharge,'site');assert.equal(analyze(p).exits,1);assert.equal(m.stairs[0].protected,false);
});
test('Recognized furniture changes routes only after obstacle opt-in',()=>{
 const p=fresh(),m=materializeInterpretation(validateInterpretation(drawing),image);Object.assign(p.floors[0],m);confirmOpening(p.floors[0],m.candidates[0],{exit:true,width:1});const a=analyze(p);m.features.forEach(f=>f.blocksMovement=true);const b=analyze(p);assert.equal(a.total,b.total);assert.ok(a.grid.good.reduce((a,b)=>a+b,0)>b.grid.good.reduce((a,b)=>a+b,0));
});
test('Courtyards and voids subtract occupied area; gray projection does not',()=>{
 const p=fresh(),copy=structuredClone(drawing);copy.elements.push(el('court','courtyard',rect(0,0,100,100)),el('underlay','projection',rect(100,100,800,700)));Object.assign(p.floors[0],materializeInterpretation(validateInterpretation(copy),image));assert.equal(roomArea(p,0,p.floors[0].rooms[0]),79);
});
test('Vision coordinates map the whole image correctly after scale and rotation',()=>{assert.deepEqual(imagePoint(image,[200,300]),{x:2,y:7});const q=imagePoint({...image,x:5,y:6,rotation:Math.PI/2},[200,300]);assert.ok(Math.abs(q.x+2)<1e-9);assert.ok(Math.abs(q.y-8)<1e-9);assert.throws(()=>materializeInterpretation(drawing,{...image,calibrated:false}),/Calibrate/);});
test('Bad coordinates and duplicate IDs are rejected without creating geometry',()=>{const bad=structuredClone(drawing);bad.elements[0].points[0]=[1001,2];assert.throws(()=>validateInterpretation(bad),/coordinates/);bad.elements=structuredClone(drawing.elements);bad.elements[1].id=bad.elements[0].id;assert.throws(()=>validateInterpretation(bad),/unique/);});
