// Exercise first-person movement with the same metre-based collision queries used in the viewer.
import assert from 'node:assert/strict';
import {BoxGeometry,Group,Mesh,Vector3} from '../../../teaching/id3/lib/three.module.min.js';
import {Walker} from '../../../teaching/id3/walk-mode.js';
import {WalkSurfaces} from '../../../teaching/id3/walk-surfaces.js';
const scene=new Group();
function box(name,size,location){
 const mesh=new Mesh(new BoxGeometry(...size));mesh.name=name;mesh.position.set(...location);scene.add(mesh);
 return mesh;
}
box('Floor slab',[20,.2,20],[0,-.1,0]);
box('Upper floor slab',[3,.2,4],[0,2.05,-6]);
box('Wall',[.05,4,8],[3,2,0]);
const surface=new WalkSurfaces([scene]);
const visitor=(x=0,y=0,z=0)=>new Walker(surface,new Vector3(x,y,z),new Vector3(1,0,0));
function advance(w,keys,seconds){const held=new Set(keys);for(let i=0;i<Math.round(seconds*60);i++)w.step(1/60,held);}
const walking=visitor(),fast=visitor(),diagonal=visitor();
advance(walking,['KeyW'],.5);advance(fast,['KeyW','ShiftLeft'],.5);advance(diagonal,['KeyW','KeyA'],.5);
assert.ok(Math.abs(walking.feet.x-1.075)<1e-5&&Math.abs(fast.feet.x-2.4)<1e-5);
assert.ok(Math.abs(diagonal.feet.length()-walking.feet.length())<1e-5);
advance(fast,['KeyW','ShiftLeft'],1);assert.ok(fast.feet.x<2.77,'Cannot run through the partition');
advance(walking,['KeyQ'],.5);assert.ok(walking.direction(new Vector3()).z<-.6);
advance(walking,['KeyE'],.5);assert.ok(walking.direction(new Vector3()).x>.999);
const jumper=visitor();jumper.jump();advance(jumper,[],.15);const rising=jumper.verticalSpeed;
assert.ok(jumper.feet.y>.4);jumper.jump();assert.equal(jumper.verticalSpeed,rising,'Airborne jump is ignored');
advance(jumper,[],1.2);assert.ok(jumper.grounded&&Math.abs(jumper.feet.y)<1e-5);
const below=visitor(0,0,-6);below.jump();let high=0;
for(let i=0;i<60;i++){below.step(1/60,new Set());high=Math.max(high,below.feet.y);}
assert.ok(high>.11&&high<.18&&below.grounded,'Head stops at the underside of the upper slab');
const above=visitor(0,2.15,-6);advance(above,['KeyW'],1);advance(above,[],2);
assert.ok(above.grounded&&Math.abs(above.feet.y)<1e-5,'Fall onto the lower floor after stepping off an edge');
console.log('Walk/sprint, diagonal speed, wall stop, Q/E turn, jump, headroom and landing passed.');
