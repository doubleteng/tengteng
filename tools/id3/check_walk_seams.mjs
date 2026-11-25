// Reproduce walking and landing at actual Ava slab, jamb and stair edges.
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {gunzipSync} from 'node:zlib';
import {BoxGeometry,Group,Mesh,Vector3} from '../../teaching/id3/lib/three.module.min.js';
import {GLTFLoader} from '../../teaching/id3/lib/loaders/GLTFLoader.js';
import {WalkSurfaces} from '../../teaching/id3/walk-surfaces.js';
import {WalkDoors} from '../../teaching/id3/walk-doors.js';
import {Walker} from '../../teaching/id3/walk-mode.js';
import {StreetTraversal} from '../../teaching/id3/street-traversal.js';

globalThis.self=globalThis;
globalThis.createImageBitmap??=async()=>({width:1,height:1,close(){}});
const dir=new URL('../../teaching/id3/models/',import.meta.url);
async function load(file){
 const bytes=await readFile(new URL(file,dir)),raw=file.endsWith('.gz')?gunzipSync(bytes):bytes;
 const {scene}=await new GLTFLoader().parseAsync(raw.buffer.slice(raw.byteOffset,raw.byteOffset+raw.length),'');
 scene.traverse(o=>{if(o.userData.initialHidden)o.visible=false;});
 return scene;
}
const [project,...district]=await Promise.all(['ava-barbat.glb.gz','urban-near.glb','urban-outer.glb','urban-core-materials.glb'].map(load));
const city=new Group();city.add(...district);
const surface=new WalkSurfaces([project,city],{doors:new WalkDoors(project)});
const vec=(x,y,z)=>new Vector3(x,y,z),east=vec(1,0,0);
const forward=new Set(['KeyW']),idle=new Set();
function visitor(s,start,direction,thirdPerson){
 const w=new Walker(s,start,direction),tr=thirdPerson?new StreetTraversal(s):null;
 return {w,step:keys=>tr?tr.step(w,1/60,keys):w.step(1/60,keys),
  jump:()=>tr?tr.jump(w,false,idle):w.jump(false,idle)};
}
// World metres, with the direction of approach measured from the +X axis.
const seams=[
 [-56.838235,10.312604,29.465414,0],[-56.838235,6.045075,29.465414,0],[-56.838235,1.244527,29.465414,0],
 [-50.446762,10.312604,27.304120,67.5],[-50.446762,6.045075,27.304120,67.5],[-50.446762,1.244527,27.304120,67.5],
 [-37.560140,6.045075,24.467937,67.5],[-28.161090,2.438400,32.296320,112.5],
 [-27.779543,2.438400,38.606340,202.5],[-24.814546,1.228601,19.134098,0]
];
for(const thirdPerson of [false,true]){
 for(const [x,y,z,angle] of seams){
  const a=angle*Math.PI/180,direction=vec(Math.cos(a),0,Math.sin(a));
  const start=vec(x,y,z).addScaledVector(direction,-2.15*12/60);
  const base=surface.floorAt(start.x,start.z,y-.03,y+.03,true);
  assert.notEqual(base,null,'The approach starts on the modeled floor');
  const {w,step,jump}=visitor(surface,start.setY(base),direction,thirdPerson);
  for(let i=0;i<12;i++)step(forward);
  assert(w.grounded&&Math.hypot(w.feet.x-x,w.feet.z-z)<.005,'Reach the joint on foot');
  assert.equal(surface.floorAt(x,z,y-.05,y+.05,true),null,'The center of the foot is over a crack');
  const level=w.feet.y;
  jump();let peak=level;
  for(let i=0;i<150;i++){
   step(idle);peak=Math.max(peak,w.feet.y);
   assert(w.feet.y>=level-.002,'Fell through the joint at '+[x,y,z]);
  }
  assert(w.grounded&&peak-level>.08&&Math.abs(w.feet.y-level)<.002,'Land back on the original floor');
 }
 const atWall=vec(-37.765924,6.045075,20.001369);
 const {w,step}=visitor(surface,atWall,east,thirdPerson);
 w.feet.y+=.25;w.grounded=false;w.verticalSpeed=-.2;
 for(let i=0;i<120;i++)step(idle);
 assert(w.grounded&&Math.abs(w.feet.y-atWall.y)<.002,'Touch down beside the return wall');
}

// Model joints can be wider than a point ray and narrower than a visitor.
// A real opening should allow a fall onto the modeled floor underneath.
function slab(root,x,y,width,label='Floor slab'){
 const mesh=new Mesh(new BoxGeometry(width,.16,5));mesh.name=label;
 mesh.position.set(x,y-.08,0);root.add(mesh);
}
const pads=new Group();
slab(pads,-1.16,0,2);slab(pads,1.16,.06,2);slab(pads,0,-3,16);
const split=new WalkSurfaces([pads]);
for(const thirdPerson of [false,true]){
 const {w,step}=visitor(split,vec(-1,0,0),east,thirdPerson);
 for(let i=0;i<60;i++){step(forward);assert(w.grounded&&w.feet.y>=-.001,'Walk across the staggered joint');}
 assert(w.feet.x>1&&Math.abs(w.feet.y-.06)<.001);
 for(let i=0;i<100;i++)step(forward);
 assert(w.grounded&&Math.abs(w.feet.y+3)<.001,'An open drop still reaches the lower floor');
}
const edge=new Group();slab(edge,0,1,4);
const isolated=new WalkSurfaces([edge]);
for(const thirdPerson of [false,true]){
 const {w,step,jump}=visitor(isolated,vec(0,1,0),east,thirdPerson);
 for(let i=0;i<50;i++)step(forward);
 const safe=w.feet.clone();jump();
 for(let i=0;i<300&&!w.grounded;i++)step(forward);
 assert(w.grounded&&w.feet.distanceTo(safe)<.001,'Missed ordinary jump recovers at the last support');
}
console.log('Eleven Ava edge locations passed in FPS and third person, including ten walking approaches per mode. Split slabs, open drops and missed jumps passed.');
