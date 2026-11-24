// A burst of mouse events and a walking step should present a single final pose.
import assert from 'node:assert/strict';
import * as T from '../../../teaching/id3/lib/three.module.min.js';
import {Walker,WalkMode} from '../../../teaching/id3/walk-mode.js';
import {limitViewRange} from '../../../teaching/id3/view-ranges.js';

const pending=new Map();let id=0,draws=0,targets=0;
globalThis.requestAnimationFrame=callback=>{pending.set(++id,callback);return id;};
const mode=Object.create(WalkMode.prototype);
Object.assign(mode,{active:true,held:new Set(),doors:{moving:false},forward:new T.Vector3(),
 walker:new Walker({},new T.Vector3(),new T.Vector3(0,0,-1)),
 v:{camera:new T.PerspectiveCamera(),controls:{target:new T.Vector3()},drawNow(){draws++;}},
 updateTarget(){targets++;}});
for(let n=0;n<30;n++)mode.look(2,-1);
assert.equal(pending.size,1);assert.equal(draws,0);assert.equal(targets,0);
const [[key,advance]]=pending;pending.delete(key);advance(performance.now()+16);
assert.equal(draws,1);assert.equal(targets,1);assert.equal(pending.size,0);
assert(Math.abs(mode.walker.yaw-60*.00165)<1e-12);assert(Math.abs(mode.walker.pitch-30*.00165)<1e-12);
assert(mode.v.camera.getWorldDirection(new T.Vector3()).distanceTo(mode.forward)<1e-9);

// A single Rhino layer with a translated instance and an authored material range.
const coords=[];
for(const x of [-50,0,50])for(let i=0;i<64;i++)coords.push(x-1,-1,-8,x+1,-1,-8,x,1,-8);
const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(coords,3));
g.setIndex(Array.from({length:coords.length/3},(_,n)=>n));g.setDrawRange(3,570);
const first=new T.Mesh(g),second=new T.Mesh(g);second.position.x=-50;
for(const mesh of [first,second]){limitViewRange(mesh);mesh.updateMatrixWorld();}
const cam=new T.PerspectiveCamera(50,1,.1,100);cam.updateMatrixWorld();
const scene=new T.Scene(),mat=first.material;
function range(mesh,expected,group=null){
 mesh.onBeforeRender({},scene,cam,g,mat,group);assert.deepEqual(g.drawRange,expected);
 mesh.onAfterRender({},scene,cam,g,mat,group);assert.deepEqual(g.drawRange,{start:3,count:570});
}
range(first,{start:192,count:192});range(second,{start:384,count:189});
range(first,{start:192,count:192},{start:0,count:420,materialIndex:0});
cam.position.x=200;cam.updateMatrixWorld();range(first,{start:576,count:0});
console.log('Mouse bursts, camera direction, indexed material ranges, shared instances and range restoration passed.');

// Capture the chord before the next physics step, including a modifier that
// was already held when the viewport received focus.
for(const [keys,boosted,modifier=false] of [[['ShiftLeft','Space'],true],[['Space','ShiftRight'],true],[['Space'],false],[['Space'],true,true]]){
 const controller=Object.create(WalkMode.prototype);
 const jumps=[];
 Object.assign(controller,{active:true,held:new Set(),doors:{moving:false},walker:{
  grounded:true,jump(boost){jumps.push(boost);this.grounded=false;},step(){return false;}
 }});
 for(const key of keys)controller.press(key,modifier);
 const [[frame,run]]=pending;pending.delete(frame);run(performance.now()+16);
 assert.deepEqual(jumps,[boosted]);controller.press('Space',true);assert.equal(controller.queuedJump,null);
 pending.clear();
}
