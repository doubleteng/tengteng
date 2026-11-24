// node tools/id3/market-switchback/check_walk_doors.mjs
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import * as T from '../../../teaching/id3/lib/three.module.min.js';
import {GLTFLoader} from '../../../teaching/id3/lib/loaders/GLTFLoader.js';
import {WalkDoors} from '../../../teaching/id3/walk-doors.js';
const v=(x,y,z)=>new T.Vector3(x,y,z);
const bytes=await fs.readFile(new URL('../../../teaching/id3/models/market-switchback.glb',import.meta.url));
const {scene}=await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');
const doors=new WalkDoors(scene,{caseStudy:true});
const eye=v(-70.4,4.12,16.38),forward=v(1,0,0);
const hall=doors.target(eye,forward);
assert.equal(hall.label,'Large hall');
assert.equal(doors.target(eye,forward,.55),null,'solid walls occlude a handle');
const ray=new T.Raycaster(eye,forward,0,3);
const nearest=()=>ray.intersectObject(scene,true)[0]?.distance??Infinity;
const step=(d,p)=>{for(let i=0;i<45;i++)d.update(1/60,p);assert.equal(d.moving,false);};
assert.ok(nearest()>1&&nearest()<1.4);
assert.ok(doors.toggle(hall,eye));step(doors,eye);assert.equal(nearest(),Infinity);
assert.equal(doors.target(eye,forward),hall,'look into the open portal to close');
assert.equal(doors.toggle(hall,v(-69.105,4.12,16.32)),false,'do not close through a walker in the threshold');
assert.ok(doors.toggle(hall,eye));step(doors,eye);assert.ok(nearest()<1.4);
for(const m of hall.meshes)m.visible=false;
assert.equal(doors.target(eye,forward),null);
for(const m of hall.meshes)m.visible=true;
const screens=doors.entries.filter(d=>d.initial===1);
assert.equal(screens.length,3);assert.ok(screens.every(d=>d.meshes.length===3));
for(const d of screens){
 const rest=d.meshes.map(m=>m.matrixWorld.clone());
 assert.ok(doors.toggle(d));step(doors);
 assert.ok(d.meshes.every((m,i)=>!m.matrixWorld.equals(rest[i])));
 doors.reset();assert.ok(d.meshes.every((m,i)=>m.matrixWorld.equals(rest[i])));
}
// glTF block rotated and scaled in a student model, with a separately modeled
// handle under the same door node. Place and pivot in registered world space.
const student=new T.Group(),block=new T.Group();student.add(block);
block.rotation.y=.6;block.scale.set(1.4,1,.8);block.position.set(25,3,11);
const assembly=new T.Group();assembly.name='public door';assembly.userData.walkDoor={hinge:[0,0,0],angle:-85,label:'Lobby'};
assembly.position.set(2,0,1);block.add(assembly);
const material=new T.MeshStandardMaterial();
const leaf=new T.Mesh(new T.BoxGeometry(.95,2.25,.045),material);
leaf.position.set(.475,1.125,0);assembly.add(leaf);
const handle=new T.Mesh(new T.BoxGeometry(.12,.025,.07),material);
handle.position.set(.81,1,.045);assembly.add(handle);
const result=new WalkDoors(student);assert.equal(result.entries.length,1);
const d=result.entries[0],hinge=assembly.getWorldPosition(v()),old=leaf.matrixWorld.clone();
assert.equal(d.meshes.length,2);assert.ok(result.toggle(d));step(result);
assert.ok(assembly.getWorldPosition(v()).distanceTo(hinge)<1e-7);
assert.ok(!leaf.matrixWorld.equals(old));result.reset();
assert.ok(leaf.matrixWorld.equals(old));
console.log('Real hall passage, threshold protection, folded panels, layers, authored block transforms and reset passed.');
