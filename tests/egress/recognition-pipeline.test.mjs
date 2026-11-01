import test from 'node:test';
import assert from 'node:assert/strict';
import {refineSourceWalls} from '../../teaching/egress/src/source-refinement.mjs';
import {compileRecognition,mergeDetail} from '../../teaching/egress/src/recognition-pipeline.mjs';
import {materializeInterpretation} from '../../teaching/egress/src/semantic-plan.mjs';
import {area,segDist} from '../../teaching/egress/src/geometry.mjs';
const el=(id,kind,points)=>({id,kind,label:id,points,confidence:'medium',evidence:'Synthetic contract fixture'});
const rect=(x,y,w,h)=>[[x,y],[x+w,y],[x+w,y+h],[x,y+h]];
const image={x:0,y:0,width:10,height:10,rotation:0,calibrated:true};
function fixture(style='black',angle=0){
 const width=240,height=240,data=new Uint8ClampedArray(width*height*4).fill(255),c=Math.cos(angle),s=Math.sin(angle),point=([x,y])=>[120+(x-120)*c-(y-120)*s,120+(x-120)*s+(y-120)*c];
 const lines=[[[40,40],[200,40]],[[200,40],[200,200]],[[200,200],[40,200]],[[40,200],[40,40]],[[120,40],[120,200]]].map(pair=>pair.map(point));
 const ink=(x,y)=>{x=Math.round(x);y=Math.round(y);if(x<0||y<0||x>=width||y>=height)return;let i=(y*width+x)*4;data[i]=data[i+1]=data[i+2]=style==='gray'?185:20;};
 function draw([a,b],thick=1){const l=Math.hypot(b[0]-a[0],b[1]-a[1]),nx=-(b[1]-a[1])/l,ny=(b[0]-a[0])/l;for(let i=0;i<=l*2;i++){const t=i/(l*2),jitter=style==='sketch'?Math.sin(t*14)*.6:0;for(let k=-thick;k<=thick;k++){const offset=(style==='double'?3:1)*k+jitter;ink(a[0]+(b[0]-a[0])*t+nx*offset,a[1]+(b[1]-a[1])*t+ny*offset);}}}
 lines.forEach(l=>draw(l));
 const furniture=rect(64,75,25,20).map(point);for(let i=0;i<4;i++)draw([furniture[i],furniture[(i+1)%4]],0);
 const norm=p=>[p[0]/width*1000,p[1]/height*1000];
 const result={version:1,summary:'Two rooms',warnings:[],outline:rect(40,40,160,160).map(point).map(norm),elements:[el('left','room',rect(40,40,80,160).map(point).map(norm)),el('right','room',rect(120,40,80,160).map(point).map(norm)),el('table','furniture',furniture.map(norm)),...lines.map((l,i)=>el('w'+i,'wall',l.map(p=>norm([p[0]+1.1,p[1]-.8]))))]};
 return {imageData:{width,height,data},result,lines};
}
for(const [style,angle] of [['black',0],['gray',0],['double',0],['sketch',0],['black',.47],['gray',-.32]])test('Source fitting preserves two rooms across '+style+' strokes at '+angle+' radians',()=>{
 const f=fixture(style,angle),r=refineSourceWalls(f.result,f.imageData),compiled=compileRecognition(r,image);
 assert.equal(compiled.pending.length,0);assert.equal(compiled.model.rooms.length,2);assert.ok(compiled.model.walls.length<=10);
 for(const e of r.elements.filter(e=>e.kind==='wall'))for(const p of e.points){const q={x:p[0]*.24,y:p[1]*.24};assert.ok(f.lines.some(([a,b])=>segDist(q,{x:a[0],y:a[1]},{x:b[0],y:b[1]})<5),'wall must follow source structure');}
 assert.equal(compiled.model.features.filter(e=>e.kind==='furniture').length,1);
});
test('Preview and applied areas are identical, and missing walls stay explicitly missing',()=>{
 const f=fixture(),r=refineSourceWalls(f.result,f.imageData),a=compileRecognition(r,image),b=materializeInterpretation(r,image);
 assert.deepEqual(a.model.rooms.map(r=>area(r.points)),b.rooms.map(r=>area(r.points)));
 const incomplete={...r,elements:r.elements.filter(e=>e.kind!=='wall')},c=compileRecognition(incomplete,image);
 assert.equal(c.complete,false);assert.equal(c.model.rooms.length,0);assert.equal(c.pending.length,2);
});
test('Blank paper and furniture alone never become structural enclosure',()=>{
 const f=fixture(),blank={...f.imageData,data:new Uint8ClampedArray(f.imageData.data.length).fill(255)};
 assert.equal(refineSourceWalls(f.result,blank).elements.filter(e=>e.kind==='wall').length,0);
 const onlyFurniture={...f.result,outline:[],elements:f.result.elements.filter(e=>e.kind==='furniture')};
 assert.equal(refineSourceWalls(onlyFurniture,f.imageData).elements.filter(e=>e.kind==='wall').length,0);
});
test('Overlapping AI room and corridor suggestions resolve to non-overlapping wall cells',()=>{
 const f=fixture();f.result.elements.find(e=>e.id==='left').points=rect(40/240*1000,40/240*1000,110/240*1000,160/240*1000);
 const right=f.result.elements.find(e=>e.id==='right');right.kind='corridor';right.points=rect(100/240*1000,40/240*1000,100/240*1000,160/240*1000);
 const compiled=compileRecognition(refineSourceWalls(f.result,f.imageData),image);
 assert.equal(compiled.model.rooms.length,2);assert.equal(compiled.pending.length,0);
 const sum=compiled.model.rooms.reduce((n,r)=>n+area(r.points),0);assert.ok(Math.abs(sum-(160/240*10)**2)<1);
});
test('Detail replacement preserves outside and confirmed geometry without duplicating a replaced wall',()=>{
 const r={version:1,summary:'',warnings:[],outline:rect(0,0,1000,1000),elements:[el('long','wall',[[0,500],[1000,500]]),{...el('checked','wall',[[450,200],[450,800]]),confirmed:true},el('far','wall',[[0,0],[50,0]])]};
 const detail={...r,elements:[el('replacement','wall',[[100,500],[900,500]])]},region={id:0,x:200,y:200,width:600,height:600,spaceIds:[],core:{left:200,top:200,right:800,bottom:800}};
 const before=structuredClone(r),merged=mergeDetail(r,detail,region);assert.deepEqual(r,before);assert.equal(merged.accepted,true);assert.ok(merged.result.elements.some(e=>e.id==='checked'&&e.confirmed));assert.ok(merged.result.elements.some(e=>e.id.startsWith('far')));assert.equal(merged.result.elements.filter(e=>e.id==='long').length,0);
 assert.equal(mergeDetail(r,{...detail,elements:[]},region).accepted,false);
});
test('A positively identified detail door replaces only its own span of coarse glazing',()=>{
 const r={version:1,summary:'',warnings:[],outline:[],elements:[el('glazing','window',[[0,500],[1000,500]])]},region={id:'opening',x:400,y:400,width:200,height:200,core:{left:400,top:400,right:600,bottom:600}};
 const detail={version:1,summary:'',warnings:[],outline:[],elements:[{...el('door','door',[[200,500],[800,500]]),doorType:'double',confidence:'high'}]};
 const m=mergeDetail(r,detail,region).result;
 assert.deepEqual(m.elements.filter(e=>e.kind==='window').map(e=>e.points),[[[0,500],[440,500]],[[560,500],[1000,500]]]);
 assert.equal(m.elements.filter(e=>e.kind==='door').length,1);
});
test('An unrelated doorway or unknown gap cannot delete windows elsewhere in the inspected crop',()=>{
 const r={version:1,summary:'',warnings:[],outline:[],elements:[el('glazing','window',[[100,500],[900,500]])]},region={id:'opening',x:0,y:0,width:1000,height:1000};
 for(const doorway of [el('gap','door',[[400,500],[500,500]]),{...el('known','door',[[400,300],[500,300]]),doorType:'single',confidence:'high'}]){
  const m=mergeDetail(r,{...r,elements:[doorway]},region).result;
  assert.deepEqual(m.elements.find(e=>e.kind==='window').points,r.elements[0].points);
 }
});

test('A crop-clipped exterior or void remains pending and cannot erase an indoor cell',()=>{
 const f=fixture(),r=refineSourceWalls(f.result,f.imageData);
 r.elements.push({...el('clipped','exterior',rect(0,0,1000,1000)),partial:true,roofState:'covered'});
 const c=compileRecognition(r,image);
 assert.equal(c.model.rooms.length,2);assert.equal(c.model.features.some(e=>e.kind==='exterior'),false);
 assert.equal(c.pendingFeatures.length,1);assert.equal(c.complete,false);
});
test('A complete outdoor footprint survives a smaller partial tile with the same space',()=>{
 const result={version:1,summary:'',warnings:[],outline:[],elements:[el('balcony','exterior',rect(100,100,600,600))]};
 const detail={...result,elements:[el('balcony','exterior',rect(0,0,800,800))]};
 const merged=mergeDetail(result,detail,{id:'tile',x:200,y:200,width:500,height:500}).result;
 assert.equal(merged.elements.length,1);assert.equal(merged.elements[0].id,'balcony');
});
test('Only a full architecture reread replaces a pending outdoor guess; confirmed areas remain',()=>{
 const result={version:1,summary:'',warnings:[],outline:[],elements:[{...el('guess','exterior',rect(200,200,200,200)),partial:true},{...el('reviewed','exterior',rect(400,400,100,100)),partial:true,confirmed:true}]};
 const detail={...result,elements:[el('context','wall',[[100,100],[800,100]])]},region={id:'repair',x:0,y:0,width:1000,height:1000};
 for(const focus of [undefined,'openings'])assert.ok(mergeDetail(result,detail,{...region,focus}).result.elements.some(e=>e.id==='guess'));
 const merged=mergeDetail(result,detail,{...region,focus:'architecture'}).result;
 assert.equal(merged.elements.some(e=>e.id==='guess'),false);assert.ok(merged.elements.some(e=>e.id==='reviewed'));
 assert.ok(mergeDetail(result,{...detail,elements:[]},{...region,focus:'architecture'}).result.elements.some(e=>e.id==='guess'));
});
