import test from 'node:test';
import assert from 'node:assert/strict';
import {strokeMask,wallEvidence,recoverBoundaryWalls,joinSourceJunctions,openingHost,openingSpaces,auditImport,pendingOpeningBarriers} from '../../teaching/egress/src/import-quality.mjs';
import {materializeInterpretation,validateInterpretation,confirmOpening} from '../../teaching/egress/src/semantic-plan.mjs';
import {rasterLinework} from '../../teaching/egress/src/pdf-plan.mjs';
import {makeGrid,flood,nearest,splitWalls} from '../../teaching/egress/src/geometry.mjs';
const rect=(x,y,w,h)=>[{x,y},{x:x+w,y},{x:x+w,y:y+h},{x,y:y+h}];
const wall=(id,x1,y1,x2,y2)=>({id,a:{x:x1,y:y1},b:{x:x2,y:y2},thickness:.15});
const image=()=>{const width=220,height=160,data=new Uint8ClampedArray(width*height*4).fill(255);return {width,height,data};};
const ink=(im,x,y,value=0)=>{const i=(y*im.width+x)*4;im.data[i]=im.data[i+1]=im.data[i+2]=value;};
const result=()=>({version:1,summary:'',warnings:[],outline:[[0,0],[1000,0],[1000,1000],[0,1000]],elements:[]});
test('A semantic outline never invents physical perimeter walls',()=>{
 const m=materializeInterpretation(result(),{x:0,y:0,width:10,height:10,calibrated:true});assert.equal(m.walls.length,0);assert.equal(m.outline.length,4);
});
test('Light gray and short source strokes survive vectorization',()=>{
 const im=image();for(let x=20;x<=195;x++)ink(im,x,30,195);for(let x=40;x<=47;x++)ink(im,x,90,80);
 const lines=rasterLinework(im).segments;assert.ok(lines.some(s=>Math.abs(s.a.y-(1-30/160))<.02&&Math.abs(s.b.x-s.a.x)>.7));assert.ok(lines.some(s=>Math.abs(s.a.y-(1-90/160))<.02&&Math.abs(s.b.x-s.a.x)>.02));
});
test('Local contrast preserves pencil on tinted paper and ignores a flat pale fill',()=>{
 const im=image();for(let x=0;x<im.width;x++)for(let y=0;y<im.height;y++)ink(im,x,y,228);for(let x=20;x<190;x++)ink(im,x,40,198);
 const s=strokeMask(im);assert.equal(s.mask[40*im.width+90],1);assert.equal(s.mask[100*im.width+90],0);
});
test('Missing-wall recovery uses source strokes and does not recover furniture polygons or blank boundaries',()=>{
 const im=image(),r=result();r.outline=[[50,200],[950,200],[950,800],[50,800]];for(let x=20;x<=195;x++)ink(im,x,32);
 const recovered=recoverBoundaryWalls(r,im);assert.ok(recovered.length>0);assert.ok(recovered.every(e=>e.kind==='wall'&&Math.abs(e.points[0][1]-200)<10));
 assert.equal(recoverBoundaryWalls(r,image()).length,0);
 const furniture=result();furniture.outline=[];furniture.elements=[{id:'table',kind:'furniture',points:r.outline}];assert.equal(recoverBoundaryWalls(furniture,im).length,0);
});
test('Source evidence distinguishes a visible wall from a line across white paper',()=>{
 const im=image();for(let x=20;x<=195;x++)ink(im,x,32,180);const source=strokeMask(im);
 const e={points:[[100,200],[850,200]]};assert.ok(wallEvidence(e,source).coverage>.95);e.points=[[100,700],[850,700]];assert.equal(wallEvidence(e,source).coverage,0);
});
test('Confirming a real wall gap preserves both jambs and never widens the adjacent walls',()=>{
 const f={elevation:0,outline:rect(0,-4,10,8),rooms:[],walls:[wall('left',0,0,4,0),wall('right',6,0,10,0)],doors:[],candidates:[]},c={id:'d',name:'Door',points:[{x:4,y:0},{x:6,y:0}]};f.candidates.push(c);
 const d=confirmOpening(f,c,{width:2});assert.equal(d.x,5);assert.equal(d.y,0);assert.equal(d.width,2);assert.equal(f.walls[0].b.x,4);assert.equal(f.walls[1].a.x,6);assert.equal(f.walls.length,3);assert.equal(splitWalls(f.walls,f.doors).length,2);assert.equal(f.candidates.length,0);
});
test('An opening cannot snap to the wrong endpoint, perpendicular wall or compete between wall faces',()=>{
 assert.ok(openingHost([wall('a',0,0,4,0)],[{x:4,y:0},{x:6,y:0}]).error);
 assert.ok(openingHost([wall('a',5,-2,5,2)],[{x:4,y:0},{x:6,y:0}]).error);
 assert.ok(openingHost([wall('a',0,-.04,10,-.04),wall('b',0,.04,10,.04)],[{x:4,y:0},{x:6,y:0}]).error);
});
test('Unconfirmed doorway is a temporary routing barrier, without adding a physical wall',()=>{
 const f={walls:[wall('a',5,0,5,4),wall('b',5,6,5,10)],doors:[],candidates:[{id:'gap',points:[{x:5,y:4},{x:5,y:6}]}]},regions=[rect(0,0,10,10)];
 const g=makeGrid(regions,[],[...splitWalls(f.walls,[]),...pendingOpeningBarriers(f)],.2),field=flood(g,[{x:8,y:5}]);assert.equal(Number.isFinite(field.d[nearest(g,{x:2,y:5})]),false);assert.equal(f.walls.length,2);
 f.candidates=[];const open=makeGrid(regions,[],splitWalls(f.walls,[]),.2);assert.equal(Number.isFinite(flood(open,[{x:8,y:5}]).d[nearest(open,{x:2,y:5})]),true);
});
test('Door-to-room/corridor relationships come from opposite sides, independently of furniture',()=>{
 const f={outline:rect(0,0,10,10),rooms:[{id:'room',name:'Room',points:rect(0,0,5,10)},{id:'corridor',name:'Corridor',points:rect(5,0,5,10)}],features:[{kind:'furniture',points:rect(2,2,1,1)}]};const c=openingSpaces(f,[{x:5,y:4},{x:5,y:6}]);assert.deepEqual(new Set(c.labels),new Set(['Room','Corridor']));
});
test('Audit locates gaps, duplicate walls and missing room boundaries without changing geometry',()=>{
 const f={outline:rect(0,0,10,10),walls:[wall('a',0,0,5,0),wall('b',5.1,0,5.1,5),wall('dup',0,0,5,0)],rooms:[{id:'r',name:'Room',role:'room',points:rect(0,0,5,5)}],doors:[],candidates:[]},before=JSON.stringify(f),a=auditImport(f);
 for(const code of ['wall-gap','duplicate-wall','room-boundary','room-opening'])assert.ok(a.issues.some(i=>i.code===code&&i.point));assert.equal(JSON.stringify(f),before);
});
test('Geometry confirmations and source evidence survive review/save/reload',()=>{
 const r=result();r.elements=[{id:'w',kind:'wall',points:[[100,100],[200,100]],confirmed:true,sourceCheck:{coverage:.3,missingPixels:30,samples:50}}];const v=validateInterpretation(r);assert.equal(v.elements[0].confirmed,true);assert.equal(v.elements[0].sourceCheck.coverage,.3);
});

test('Only source-supported subpixel junction gaps join; visible door gaps remain open',()=>{
 const im=image();for(let x=20;x<=110;x++)ink(im,x,80);for(let y=20;y<=130;y++)ink(im,110,y);
 const r=result();r.elements=[{id:'horizontal',kind:'wall',points:[[20/220*1000,500],[109/220*1000,500]]},{id:'vertical',kind:'wall',points:[[500,125],[500,812.5]]}];
 const linked=joinSourceJunctions(r,im);assert.ok(linked.joined>0);assert.ok(Math.abs(linked.interpretation.elements[0].points[1][0]-500)<.001);assert.equal(r.elements[0].points[1][0],109/220*1000);
 assert.equal(joinSourceJunctions(r,image()).joined,0);
 r.elements.push({id:'opening',kind:'door',points:[[107/220*1000,500],[113/220*1000,500]]});assert.equal(joinSourceJunctions(r,im).joined,0);
});
