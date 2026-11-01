import test from 'node:test';
import assert from 'node:assert/strict';
import {refineSourceWalls} from '../../teaching/egress/src/source-refinement.mjs';
import {doorSwingEvidence} from '../../teaching/egress/src/door-evidence.mjs';
import {normalizeWallNetwork} from '../../teaching/egress/src/wall-network.mjs';
import {strokeMask,pendingOpeningBarriers} from '../../teaching/egress/src/import-quality.mjs';
import {validateInterpretation,materializeInterpretation} from '../../teaching/egress/src/semantic-plan.mjs';
import {enableWallRooms} from '../../teaching/egress/src/editable-plan.mjs';
import {doorSymbolLines} from '../../teaching/egress/src/door-symbol.mjs';
import {area} from '../../teaching/egress/src/geometry.mjs';

const rect=(x,y,w,h)=>[[x,y],[x+w,y],[x+w,y+h],[x,y+h]];
const point=([x,y])=>({x,y});
const wall=(id,a,b)=>({id,a:point(a),b:point(b),thickness:.15});
function fixture({angle=0,swing=true,gray=20,double=false,swingAngle=90,corner=false}={}){
 const width=400,height=400,data=new Uint8ClampedArray(width*height*4).fill(255),c=Math.cos(angle),s=Math.sin(angle);
 const turn=([x,y])=>[200+(x-200)*c-(y-200)*s,200+(x-200)*s+(y-200)*c];
 const ink=p=>{const [x,y]=turn(p).map(Math.round);if(x<0||y<0||x>=width||y>=height)return;const i=(y*width+x)*4;data[i]=data[i+1]=data[i+2]=gray;};
 const draw=(a,b,wall=false)=>{const l=Math.hypot(b[0]-a[0],b[1]-a[1]),nx=-(b[1]-a[1])/l,ny=(b[0]-a[0])/l;for(let i=0;i<=l*3;i++){const t=i/(l*3);for(const d of wall&&double?[-2,2]:[0])ink([a[0]+(b[0]-a[0])*t+nx*d,a[1]+(b[1]-a[1])*t+ny*d]);}};
 const segments=[[[60,60],[340,60]],[[340,60],[340,340]],[[340,340],[60,340]],[[60,340],[60,60]],[[200,60],[200,170]],[[200,200],[200,340]]];
 if(corner){segments.splice(4,1);segments.at(-1)[0]=[200,90];}
 segments.forEach(([a,b])=>draw(a,b,true));
 const a=corner?[200,60]:[200,170],b=corner?[200,90]:[200,200];
 if(swing){const leafAngle=swingAngle*Math.PI/180;draw(a,[a[0]-30*Math.sin(leafAngle),a[1]+30*Math.cos(leafAngle)]);for(let d=0;d<=swingAngle;d+=.25){const q=d*Math.PI/180;ink([a[0]-30*Math.sin(q),a[1]+30*Math.cos(q)]);}}
 const furniture=rect(95,240,50,30);furniture.forEach((p,i)=>draw(p,furniture[(i+1)%4]));
 const norm=p=>turn(p).map(v=>v/width*1000),el=(id,kind,points)=>({id,kind,label:id,points:points.map(norm),confidence:'medium'});
 const result={version:1,summary:'',warnings:[],outline:rect(60,60,280,280).map(norm),elements:[el('room','room',rect(60,60,140,280)),el('hall','corridor',rect(200,60,140,280)),el('table','furniture',furniture),...segments.map((line,i)=>el('w'+i,'wall',line.map(([x,y])=>[x+1,y-.5])))]};
 if(corner)result.elements.push(el('corner-door','door',[a,b]));
 return {imageData:{width,height,data},result,a:point(turn(a)),b:point(turn(b))};
}
for(const options of [{},{angle:.37},{angle:-.27,gray:185},{double:true},{double:true,angle:.37},{double:true,angle:-.27,gray:185}])test('Swing and jamb detection connects an interior door across '+JSON.stringify(options),()=>{
 const f=fixture(options),evidence=doorSwingEvidence(f.a,f.b,strokeMask(f.imageData),.2);assert.ok(evidence.score>=.55);
 const fitted=validateInterpretation(refineSourceWalls(f.result,f.imageData));
 const model=materializeInterpretation(fitted,{x:0,y:0,width:20,height:20,calibrated:true});
 assert.equal(model.rooms.length,2);assert.equal(model.pendingSpaces.length,0);assert.equal(model.doors.length,1);
 assert.equal(model.doors[0].exit,false);assert.equal(model.doors[0].recognition.autoDetected,true);assert.equal(model.doors[0].recognition.reviewed,false);
 assert.equal(model.doors[0].drawSwing,true);const symbol=doorSymbolLines(model.doors[0],model.walls.find(w=>w.id===model.doors[0].wallId));assert.equal(symbol.length,2);assert.equal(symbol[1].length,25);assert.ok(Math.abs(Math.hypot(symbol[0][0].x-symbol[0][1].x,symbol[0][0].y-symbol[0][1].y)-model.doors[0].width)<1e-6);assert.ok(model.doors[0].width>1.2&&model.doors[0].width<1.8);
 assert.equal(model.features.filter(f=>f.kind==='furniture').length,1);
});
test('A plain gap or furniture rectangle supplies no swing evidence and never becomes an automatic door',()=>{
 const f=fixture({swing:false});assert.equal(doorSwingEvidence(f.a,f.b,strokeMask(f.imageData),.2).score,0);
 const m=materializeInterpretation(refineSourceWalls(f.result,f.imageData),{x:0,y:0,width:20,height:20,calibrated:true});assert.equal(m.doors.length,0);
 assert.equal(m.rooms.length,2);assert.equal(m.candidates.length,1);assert.equal(m.candidates[0].openingEvidence.autoDoor,false);assert.match(m.candidates[0].recognition.evidence,/missing drawing stroke/);
});
test('Unhosted opening proposals cannot draw phantom partitions through a room',()=>{
 const floor={outline:rect(0,0,10,10).map(point),walls:[wall('a',[0,0],[10,0]),wall('b',[10,0],[10,10]),wall('c',[10,10],[0,10]),wall('d',[0,10],[0,0])],rooms:[],doors:[],candidates:[{id:'bad',points:[{x:0,y:5},{x:10,y:5}]}]};
 enableWallRooms(floor);assert.equal(floor.rooms.length,1);assert.equal(area(floor.rooms[0].points),100);assert.equal(pendingOpeningBarriers(floor).length,0);
});
test('An indoor–outdoor opening is identified as an exit candidate, never an automatic legal exit',()=>{
 const points=rect(100,100,800,800),result={version:1,summary:'',warnings:[],outline:points,elements:points.map((p,i)=>({id:'w'+i,kind:'wall',points:[p,points[(i+1)%4]]}))};
 result.elements.push({id:'entrance',kind:'door',points:[[400,100],[500,100]],openingEvidence:{located:true,swingScore:1,autoDoor:true}});
 const m=materializeInterpretation(result,{x:0,y:0,width:10,height:10,calibrated:true});assert.equal(m.doors.length,0);assert.equal(m.candidates[0].suggestedExit,true);assert.equal(m.candidates[0].kind,'entrance');
});
test('Duplicate reverse-direction wall hints collapse; disconnected parallel walls stay separate',()=>{
 const input=[{...wall('a',[0,0],[100,0]),band:2,explicit:true},{...wall('b',[100,.5],[0,.5]),band:2,explicit:true},{...wall('c',[0,20],[100,20]),band:2,explicit:true}];
 assert.equal(normalizeWallNetwork(input,{unit:1,supported:()=>true}).length,2);
});
test('Source refinement and door evidence survive saving without treating the geometry as user-confirmed',()=>{
 const f=fixture(),r=validateInterpretation(refineSourceWalls(f.result,f.imageData));assert.equal(r.sourceRefinement.version,8);
 assert.ok(r.elements.some(e=>e.openingEvidence?.autoDoor&&!e.confirmed));assert.ok(r.elements.some(e=>e.kind==='wall'&&e.sourceBand>0));
 assert.deepEqual(refineSourceWalls(r,f.imageData).elements,r.elements);
});

for(const swingAngle of [45,60,90,120])test('Read the actual '+swingAngle+' degree door leaf instead of drawing a generic quarter circle',()=>{const f=fixture({swingAngle}),e=doorSwingEvidence(f.a,f.b,strokeMask(f.imageData),.2);assert.ok(e.score>=.55);assert.equal(e.swingAngle,swingAngle);});

for(const angle of [0,.37])test('A source door against a perpendicular wall preserves two room enclosures at '+angle,()=>{const f=fixture({corner:true,angle}),r=refineSourceWalls(f.result,f.imageData),m=materializeInterpretation(r,{x:0,y:0,width:20,height:20,calibrated:true});assert.equal(m.pendingSpaces.length,0);assert.equal(m.rooms.length,2);assert.equal(m.doors.length,1);assert.ok(m.walls.find(w=>w.id===m.doors[0].wallId));});
