// node tools/id3/market-switchback/check_walk_surfaces.mjs
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import * as T from '../../../teaching/id3/lib/three.module.min.js';
import {GLTFLoader} from '../../../teaching/id3/lib/loaders/GLTFLoader.js';
import {WalkSurfaces} from '../../../teaching/id3/walk-surfaces.js';
import {WalkDoors} from '../../../teaching/id3/walk-doors.js';
import {CameraClearance} from '../../../teaching/id3/camera-clearance.js';

const vec=(x,y,z)=>new T.Vector3(x,y,z);
const down=vec(0,-1,0),towards=(x,y,z,d=down)=>new T.Ray(vec(x,y,z),d);
const near=(value,ref,tol=.002)=>assert.ok(value!==null&&Math.abs(value-ref)<tol,'Expected '+ref+'; got '+value);
const room=new T.Group(),wood=new T.MeshBasicMaterial({side:T.DoubleSide});
function box(label,size,location,root=room){
 const o=new T.Mesh(new T.BoxGeometry(...size),wood);
 o.position.set(...location);o.userData.layer=label;root.add(o);return o;
}
box('Floor slab',[8,.16,8],[0,-.08,0]);
const high=box('Floor slab',[3,.3,3],[0,2.85,0]);
const roof=box('Roof',[5,.10,5],[0,6,0]);
const furniture=box('Furniture / Table',[1.2,.1,1.2],[2,1,0]);
const wall=box('Partition',[.04,2.6,3],[1.3,1.3,0]);
const leaf=box('Door leaf',[1.1,2.1,.05],[0,1.05,-2]);leaf.userData.walkDoor=true;
const surface=new WalkSurfaces([room],{doors:{meshes:[leaf]}});
near(surface.floorAt(0,0,-5,.3),0);near(surface.floorAt(0,0,.3,4),3);
near(surface.ceilingAt(0,0,1.7,3.1),2.7);
assert.equal(surface.floorAt(10,0,-Infinity,Infinity),null);
assert.equal(surface.pick(towards(0,10,0)),null,'Roof must mask the floor beneath it');
roof.visible=false;near(surface.pick(towards(0,9,0)).point.y,3);
high.visible=false;near(surface.pick(towards(0,9,0)).point.y,0);
high.visible=true;assert.equal(surface.pick(towards(2,1.8,0)),null,'Table is an obstruction, not a floor');
furniture.visible=false;
assert.equal(surface.canMove(vec(0,0,0),vec(2,0,0)),false,'A thin wall blocks a long crossing');
wall.visible=false;assert.ok(surface.canMove(vec(0,0,0),vec(2,0,0)));
assert.equal(surface.canMove(vec(0,0,-1),vec(0,0,-3)),false,'Closed leaf blocks');
leaf.rotation.y=Math.PI/2;leaf.position.x=.55;leaf.position.z=-2.55;leaf.updateWorldMatrix(true,true);
assert.ok(surface.canMove(vec(0,0,-1),vec(0,0,-3)),'Open door is traversable');
assert.equal(surface.canMove(vec(0,0,-2.6),vec(1,0,-2.6)),false,'Open leaf blocks at its real swung location');
near(surface.firstHit(towards(0,1,-2.6,vec(1,0,0)),2).point.x,.525);
const overhang=box('Roof',[2,.2,2],[0,1.2,0]);
const low=new WalkSurfaces([room]);
assert.equal(low.canStand(vec(0,0,0)),false,'Too little headroom');
overhang.visible=false;assert.ok(low.canStand(vec(0,0,0)));

const mirrored=new T.Group();
const fine=new T.PlaneGeometry(4,4,32,32).rotateX(-Math.PI/2);
const unknown=new T.Mesh(fine,wood);unknown.name='Layer001';unknown.scale.x=-1;
mirrored.add(unknown);
near(new WalkSurfaces([mirrored]).floorAt(.02,.03,-1,1),0);
globalThis.self=globalThis;
globalThis.createImageBitmap??=async()=>({width:1,height:1,close(){}});
const loader=new GLTFLoader(),dir=new URL('../../../teaching/id3/models/',import.meta.url);
const load=async name=>{
 const b=await readFile(new URL(name+'.glb',dir));
 const {scene}=await loader.parseAsync(b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength),'');
 scene.traverse(o=>{if(o.userData.initialHidden)o.visible=false;});
 return scene;
};
const [proposal,...district]=await Promise.all(['market-switchback','urban-near','urban-outer','urban-core-materials'].map(load));
const city=new T.Group();city.add(...district);
const roots=[proposal,city],clearance=new CameraClearance(roots);
const doors=new WalkDoors(proposal,{caseStudy:true});
const start=performance.now(),actual=new WalkSurfaces(roots,{clearance,doors});
const built=performance.now()-start;
const rampLength=47.45-6.55;
for(let i=1;i<100;i++){
 const t=i/100,x=47.45-rampLength*t-82.906,z=24,y=2.5+(6.4116-2.5)*.5*t;
 const floor=actual.floorAt(x,z,y-.17,y+.17);near(floor,y,.01);
 assert.ok(actual.canStand(vec(x,floor,z)),'Unobstructed ramp at '+[x,y,z]);
}
const rampX=27-82.906,upper=actual.floorAt(rampX,24,3,5),lower=actual.floorAt(rampX,24,-2,2.4);
assert.ok(lower!==null&&upper-lower>1.8,'Original floor below model ramp remains independently accessible');
const hits=actual.firstHit(towards(rampX,upper+.6,24));
assert.equal(hits.walkable,true);near(hits.point.y,upper);
assert.ok(actual.pick(towards(rampX,upper+.6,24)),'Pick the ramp from just above its surface');
let previous;
for(let i=0;i<10;i++){
 const x=8.13+.38*(i+.5)-82.906,z=16.2,y=2.5-(9-i)*.1778;
 near(actual.floorAt(x,z,y-.25,y+.25),y);
 const feet=vec(x,y,z);assert.ok(actual.canStand(feet),'Actual Fourth Avenue stair tread '+i);
 if(previous)assert.ok(actual.canMove(previous,feet),'Historical entrance steps '+i);
 previous=feet;
}
const eye=vec(-70.4,4.12,16.38),dirX=vec(1,0,0);
const feet=vec(eye.x,2.5,eye.z),end=vec(eye.x+2.1,2.5,eye.z);
let first=actual.firstHit(new T.Ray(eye,dirX),3);
near(first.distance,1.271,.02);
assert.equal(actual.canMove(feet,end),false);
const door=doors.target(eye,dirX,first.distance);
assert.ok(door&&doors.toggle(door,eye));
for(let i=0;i<15;i++)doors.update(.05,eye);
assert.ok(!actual.firstHit(new T.Ray(eye,dirX),3),'The opened hall gateway clears the sightline');
assert.ok(actual.canMove(feet,end),'Real hall door must let the body through');
assert.ok(doors.toggle(door,eye));for(let i=0;i<15;i++)doors.update(.05,eye);
assert.equal(actual.canMove(feet,end),false,'Real hall door must block when it recloses');
const sampleIndex=actual.floorAt(-94,38,-15,5);
assert.ok(sampleIndex!==null,'Surveyed city street is traversable');
city.visible=false;assert.equal(actual.floorAt(-94,38,-15,5),null,'Hiding the city removes its street from the pick/foot query');
console.log('Passed stacked floors, head clearance, actual moving door and layer visibility, real market walkable ramp and city terrain. Walk index:',Math.round(built),'ms');
