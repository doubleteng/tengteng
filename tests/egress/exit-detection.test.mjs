import test from 'node:test';
import assert from 'node:assert/strict';
import {doorSwingEvidence,glazingBarrierEvidence} from '../../teaching/egress/src/door-evidence.mjs';
import {materializeInterpretation,validateInterpretation,confirmOpening,reconcileDetectedWindows} from '../../teaching/egress/src/semantic-plan.mjs';
import {doorSwingCheck,analyzePlanCode} from '../../teaching/egress/src/plan-code.mjs';
import {fresh} from '../../teaching/egress/src/model.mjs';

function exterior({outward=true,window=false,rails=false}={}){
 const corners=[[100,100],[900,100],[900,900],[100,900]];
 return validateInterpretation({version:1,outline:corners,warnings:[],elements:[...corners.map((p,i)=>({id:'w'+i,kind:'wall',points:[p,corners[(i+1)%4]]})),{id:'entry',kind:'door',doorType:'double',leafCount:2,label:'Entry',points:[[400,100],[600,100]],openingEvidence:{located:true,method:'swing-and-jambs',swingScore:1,autoDoor:true,swingPoint:[500,outward?50:150],windowConflict:rails?'Continuous frame / glazing lines cross this opening.':''}},...(window?[{id:'glazing',kind:'window',points:[[400,100],[600,100]]}]:[])]});
}
const image={x:0,y:0,width:10,height:10,calibrated:true};
test('An outward ground-floor door becomes one detected exit with an unconfirmed role',()=>{
 for(const rotation of [0,.7,-.4]){
  const m=materializeInterpretation(exterior(),{...image,rotation},{elevation:0});assert.equal(m.doors.length,1);assert.equal(m.candidates.length,0);
  const d=m.doors[0];assert.equal(d.exit,true);assert.equal(d.discharge,'site');assert.equal(d.exitConfirmed,false);assert.equal(d.doorType,'double');assert.equal(d.widthConfirmed,false);assert.equal(d.detectedSwing.spaceId,'outside');
 }
});
test('An inward exterior door, ambiguous swing or upper-floor balcony is not silently made an exit',()=>{
 const inward=materializeInterpretation(exterior({outward:false}),image,{elevation:0});assert.equal(inward.doors.length,0);assert.match(inward.candidates[0].detectionReason,/interior/);
 const upper=materializeInterpretation(exterior(),image,{elevation:4});assert.equal(upper.doors.length,0);assert.match(upper.candidates[0].detectionReason,/this level/);
 const r=exterior();delete r.elements.at(-1).openingEvidence.swingPoint;const uncertain=materializeInterpretation(r,image,{elevation:0});assert.equal(uncertain.doors.length,0);assert.match(uncertain.candidates[0].detectionReason,/not visible/);
});
test('Window symbols and continuous glazing rails veto even an outward high-scoring swing',()=>{
 for(const options of [{window:true},{rails:true}]){
  const m=materializeInterpretation(exterior(options),image,{elevation:0});assert.equal(m.doors.length,0);assert.equal(m.candidates[0].suggestedExit,false);assert.ok(m.candidates[0].windowConflict);
  assert.throws(()=>confirmOpening(m,m.candidates[0],{exit:true}),/window evidence/);
 }
});
test('Legacy automatic window-door mistakes are disconnected; manually confirmed doors are preserved',()=>{
 const m=materializeInterpretation(exterior(),image,{elevation:0}),d=m.doors[0],w=m.walls.find(w=>w.id===d.wallId);
 m.features.push({id:'window',kind:'window',points:[{x:d.x-1,y:d.y},{x:d.x+1,y:d.y}]});
 const reviewed=structuredClone(m);reviewed.doors[0].recognition.reviewed=true;assert.equal(reconcileDetectedWindows(reviewed),false);assert.equal(reviewed.doors.length,1);
 assert.equal(reconcileDetectedWindows(m),true);assert.equal(m.doors.length,0);assert.equal(m.candidates[0].id,d.id);assert.ok(m.candidates[0].windowConflict);assert.equal(reconcileDetectedWindows(m),false);
});
test('Detected exits keep an explicit role confirmation finding',()=>{
 const p=fresh(),m=materializeInterpretation(exterior(),image,{elevation:0});Object.assign(p.floors[0],m);const r=analyzePlanCode(p,{floors:[{checks:[],capacity:{rows:[]}}]});
 assert.ok(r.checks.some(c=>c.id==='exit-role:'+m.doors[0].id&&c.status==='input'));
});
test('Two drawn half swings establish a double door and a side; rails remain a window rejection cue',()=>{
 const width=180,height=180,mask=new Uint8Array(width*height),put=(x,y)=>{x=Math.round(x);y=Math.round(y);if(x>=0&&y>=0&&x<width&&y<height)mask[y*width+x]=1;};
 const a={x:50,y:90},b={x:110,y:90};
 for(let i=0;i<=180;i++){const angle=i/180*Math.PI/2;put(50+30*Math.cos(angle),90-30*Math.sin(angle));put(110-30*Math.cos(angle),90-30*Math.sin(angle));}
 for(let i=0;i<=30;i++){put(50,90-i);put(110,90-i);}
 const raster={width,height,mask},ev=doorSwingEvidence(a,b,raster,.2);assert.ok(ev.score>=.55);assert.equal(ev.doorType,'double');assert.equal(ev.leafCount,2);assert.ok(ev.swingPoint.y<90);assert.equal(glazingBarrierEvidence(a,b,raster,.2).score,0);
 for(let x=50;x<=110;x++){put(x,88);put(x,92);}
 assert.ok(glazingBarrierEvidence(a,b,raster,.2).score>=.8);
});
