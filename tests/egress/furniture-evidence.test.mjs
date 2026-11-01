import test from 'node:test';import assert from 'node:assert/strict';
import {refineFurnitureGeometry,usableFurnitureGeometry} from '../../teaching/egress/src/furniture-evidence.mjs';
import {validateInterpretation,materializeInterpretation,featureObstacles} from '../../teaching/egress/src/semantic-plan.mjs';
const rect=(x,y,w,h)=>[[x,y],[x+w,y],[x+w,y+h],[x,y+h]];
function drawing({angle=0,gray=20,group=false,shift=2,blank=false}={}){
 const width=400,height=400,data=new Uint8ClampedArray(width*height*4).fill(255),c=Math.cos(angle),s=Math.sin(angle),rotate=([x,y])=>[200+(x-200)*c-(y-200)*s,200+(x-200)*s+(y-200)*c];
 const shapes=group?[rect(60,70,70,50),rect(230,70,70,50),rect(140,230,70,50)]:[rect(100,120,170,70)];
 if(!blank)for(const poly of shapes)poly.forEach((a,i)=>{const b=poly[(i+1)%poly.length],n=Math.ceil(Math.hypot(b[0]-a[0],b[1]-a[1])*4);for(let j=0;j<=n;j++){const t=j/n,[x,y]=rotate([a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t]).map(Math.round),k=(y*width+x)*4;data[k]=data[k+1]=data[k+2]=gray;}});
 const outline=group?rect(60,70,240,210):shapes[0].map(([x,y])=>[x+shift,y+shift]);
 return {source:{width,height,data},expected:shapes[0].map(rotate),result:{version:1,outline:[],warnings:[],elements:[{id:'table',kind:'furniture',label:group?'Dining tables and chairs':'Table',confidence:'medium',evidence:'Synthetic contour fixture.',points:outline.map(rotate).map(p=>p.map(v=>v/4))}]}};
}
// Normalize source pixels independently to the contract's 0..1000 coordinates.
function run(options){const f=drawing(options);f.result.elements[0].points=f.result.elements[0].points.map(p=>p.map(v=>v*10));return{...f,result:refineFurnitureGeometry(f.result,f.source)};}
for(const options of [{},{angle:.48},{angle:-.31,gray:205}])test('A nearby visible furniture contour is fitted at '+JSON.stringify(options),()=>{
 const f=run(options),e=f.result.elements[0];assert.equal(e.sourceGeometry.status,'fitted');assert.ok(e.points.every((p,i)=>Math.hypot(p[0]*.4-f.expected[i][0],p[1]*.4-f.expected[i][1])<2));
});
test('A single bounding box around three tables and their aisles is unresolved',()=>{const e=run({group:true}).result.elements[0];assert.equal(e.sourceGeometry.status,'unresolved');assert.equal(usableFurnitureGeometry(e),false);});
test('Blank space and substantially displaced outlines never become fitted furniture',()=>{for(const options of [{blank:true},{shift:16}])assert.equal(run(options).result.elements[0].sourceGeometry.status,'unresolved');});
test('Unresolved or legacy unreviewed furniture cannot silently block a route',()=>{
 const r=validateInterpretation(run({group:true}).result),m=materializeInterpretation(r,{x:0,y:0,width:10,height:10,calibrated:true});assert.equal(m.walls.length,0);assert.equal(m.rooms.length,0);assert.equal(m.features.length,1);
 const e=m.features[0];e.blocksMovement=true;assert.equal(featureObstacles(m).length,0);delete e.sourceGeometry;assert.equal(featureObstacles(m).length,0);e.recognition.reviewed=true;assert.equal(featureObstacles(m).length,1);
});
test('Fitted contour provenance survives validation and model serialization',()=>{const r=validateInterpretation(run({angle:.2}).result),m=materializeInterpretation(r,{x:0,y:0,width:10,height:10,calibrated:true}),e=JSON.parse(JSON.stringify(m.features[0]));assert.equal(e.sourceGeometry.status,'fitted');assert.equal(usableFurnitureGeometry(e),true);assert.equal(e.blocksMovement,false);});
