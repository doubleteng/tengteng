// Run with node from the repository. Coordinates and component names are metres and model layers.
import assert from 'node:assert/strict';
import {BoxGeometry,Group,Mesh,Vector3,PerspectiveCamera,Raycaster} from '../../../teaching/id3/lib/three.module.min.js';
import {Walker} from '../../../teaching/id3/walk-mode.js';
import {WalkSurfaces} from '../../../teaching/id3/walk-surfaces.js';
import {StreetTraversal} from '../../../teaching/id3/street-traversal.js';
import {ChaseCamera,streetSpawn} from '../../../teaching/id3/street-mode.js';

const forward=new Vector3(0,0,-1),walk=new Set(['KeyW']);
function block(parent,name,w,h,d,x,y,z){
 const mesh=new Mesh(new BoxGeometry(w,h,d));mesh.name=name;mesh.position.set(x,y,z);parent.add(mesh);return mesh;
}
function crossing(group,jump=false){
 const surface=new WalkSurfaces([group]),w=new Walker(surface,new Vector3(),forward);
 const motion=new StreetTraversal(surface),seen=new Set();
 if(jump){w.jump();motion.jumped=true;}
 for(let i=0;i<180;i++){
  motion.step(w,1/60,walk);
  if(motion.action)seen.add(motion.action.type);
  if(seen.size&&!motion.action)break;
 }
 return {w,seen,surface};
}
function scene(){const group=new Group();block(group,'Ground floor',8,.2,9,0,-.1,0);return group;}
const yard=scene(),rail=block(yard,'Steel handrail',2,.08,.045,0,.94,-1);
let r=crossing(yard);assert.deepEqual([...r.seen],['vault']);assert(r.w.feet.z<-1.4&&r.w.grounded);
rail.visible=false;r=crossing(yard);assert.equal(r.seen.size,0);
rail.visible=true;rail.position.y=1.8;assert.equal(crossing(yard).seen.size,0);
rail.position.y=.94;block(yard,'Concrete wall',3,2.8,.13,0,1.4,-1.5);
assert.equal(crossing(yard).seen.size,0,'An occupied landing must reject the vault.');
const gap=new Group();block(gap,'Floor',4,.2,3,0,-.1,.65);
block(gap,'Edge guard',3,.09,.07,0,1,-.78);assert.equal(crossing(gap).seen.size,0);
const furniture=scene();block(furniture,'Market table',2,.09,.18,0,.88,-1);
assert.equal(crossing(furniture).seen.size,0);
const roof=scene();block(roof,'Annex roof',4,.22,4,0,2.14,-3.2);
block(roof,'Annex wall',4,2.06,3.8,0,1.03,-3.3);
r=crossing(roof,true);assert.deepEqual([...r.seen],['climb']);assert(Math.abs(r.w.feet.y-2.25)<1e-6&&r.w.grounded);
assert.equal(crossing(roof).seen.size,0,'Walking into a tall wall never initiates a climb.');
block(roof,'Roof mechanical box',2,2,1.4,0,3.25,-2);
assert.equal(crossing(roof,true).seen.size,0,'Headroom must be clear at the roof landing.');
const court=scene(),wall=block(court,'Brick wall',4,4,.12,0,2,1.4);
const surface=new WalkSurfaces([court]),cam=new PerspectiveCamera(),target=new Vector3(),rig=new ChaseCamera(surface);
const walker=new Walker(surface,new Vector3(),forward);
rig.update(walker,cam,target,1/60);assert(cam.position.z<1.33&&cam.position.z>.7);
wall.visible=false;for(let i=0;i<75;i++)rig.update(walker,cam,target,1/60);
assert(cam.position.z>3.7,'The camera should ease back after leaving the wall.');
const ray=new Raycaster();cam.position.set(1,1.65,1);cam.lookAt(1,1.65,-1);cam.updateMatrixWorld();
const spawn=streetSpawn({camera:cam},surface,ray);
assert(spawn.point.distanceTo(new Vector3(1,0,1))<1e-6);
console.log('Street traversal, landing clearance, hidden layers, camera obstruction and eye-level spawning passed.');

// Use the exhibition GLBs as well as fixtures. Check both palm-to-model contact
// during the planted phase and the visitor's support after releasing the grip.
import {readFile} from 'node:fs/promises';
import {GLTFLoader} from '../../../teaching/id3/lib/loaders/GLTFLoader.js';
import {WalkDoors} from '../../../teaching/id3/walk-doors.js';
import {createStreetAvatar} from '../../../teaching/id3/street-avatar.js';
import {StreetMode} from '../../../teaching/id3/street-mode.js';
globalThis.self=globalThis;
globalThis.createImageBitmap=async()=>({width:1,height:1,close(){}});
async function model(name){
 const bytes=await readFile(new URL('../../../teaching/id3/models/'+name+'.glb',import.meta.url));
 const asset=await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');
 asset.scene.traverse(o=>{if(o.userData.initialHidden)o.visible=false;});return asset.scene;
}
const [building,...district]=await Promise.all(['market-switchback','urban-core-materials','urban-near','urban-outer'].map(model));
const city=new Group();city.add(...district);
const geometry=new WalkSurfaces([building,city],{doors:new WalkDoors(building,{caseStudy:true})});
for(const [type,x,z,dx,dz] of [['vault',-74.9,7.4,0,1],['climb',-95,26.4,1,0]]){
 const level=geometry.floorAt(x,z,-2,3);
 const w=new Walker(geometry,new Vector3(x,level,z),new Vector3(dx,0,dz));
 const traversal=new StreetTraversal(geometry),avatar=createStreetAvatar(),palm=new Vector3(),lookAt=new Vector3();
 const street=Object.assign(Object.create(StreetMode.prototype),{avatar,traversal,camera:new ChaseCamera(geometry),gait:0,
  gripLocal:new Vector3(),palmsLocal:[new Vector3(),new Vector3()],contactRoot:new Vector3(),contact:new Group(),rotation:w.yaw,last:w.feet.clone()});
 if(type==='climb'){w.jump(true,walk);traversal.jumped=true;}
 let samples=0,worst=0,landing;
 for(let i=0;i<240;i++){
  traversal.step(w,1/60,walk);street.present(w,cam,lookAt,1/60);
  const a=traversal.action;
  if(a){
   assert.equal(a.type,type);landing=a.far;
   const vault=type==='vault';
   if(a.progress>=(vault?.22:.18)&&a.progress<=(vault?.52:.64)){
    for(const [side,grip] of vault?[['Right',a.grip]]:[['Left',a.palms[0]],['Right',a.palms[1]]]){
     avatar.root.getObjectByName(side+' palm contact').getWorldPosition(palm);
     worst=Math.max(worst,palm.distanceTo(grip));samples++;
    }
   }
  }else if(landing&&w.grounded)break;
 }
 assert(samples>8&&worst<.035,type+' palms contact the measured edge, error in m: '+worst);
 assert(w.grounded&&landing&&w.feet.distanceTo(landing)<.01);
 assert(Math.abs(geometry.floorAt(w.feet.x,w.feet.z,w.feet.y-.08,w.feet.y+.08,true)-w.feet.y)<.01);
 console.log(type,samples+' planted palm samples','max error '+worst.toFixed(4)+' m','landing',w.feet.toArray());
 avatar.dispose();
}
