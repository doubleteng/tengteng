// Follow the exhibited GLB with the same stair stepping, floor picking and
// door meshes as a gallery visitor. Coordinates in the schedule are in metres.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {Ray,Vector3} from '../../../teaching/id3/lib/three.module.min.js';
import {GLTFLoader} from '../../../teaching/id3/lib/loaders/GLTFLoader.js';
import {Walker} from '../../../teaching/id3/walk-mode.js';
import {WalkDoors} from '../../../teaching/id3/walk-doors.js';
import {WalkSurfaces} from '../../../teaching/id3/walk-surfaces.js';

const file=process.argv[2]??new URL('../../../teaching/id3/models/market-switchback.glb',import.meta.url);
const bytes=await fs.readFile(file);
const {scene}=await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');
scene.traverse(o=>{if(o.userData.initialHidden)o.visible=false;});
const doors=new WalkDoors(scene,{caseStudy:true});
for(const door of doors.entries)door.pose(1);
const surface=new WalkSurfaces([scene],{doors});
const levels=[-1.056,2.50,6.4116,10.6788];
const originX=-82.906, forward=new Set(['KeyW']);
const up=new Vector3(0,1,0);
let minimum=Infinity, routes=0;
function trace(label,points,start,finish){
 const walker=new Walker(surface,new Vector3(originX+points[0][0],start,points[0][1]),up);
 for(const [x,z] of points.slice(1)){
  const dx=originX+x-walker.feet.x,dz=z-walker.feet.z,length=Math.hypot(dx,dz);
  walker.yaw=Math.atan2(dx,-dz);
  const steps=Math.ceil(length/.04);
  for(let i=0;i<steps;i++){
   walker.step(length/(steps*2.15),forward);
   const p=walker.feet;
   const where=()=>label+' at '+[p.x-originX,p.z,p.y].map(v=>v.toFixed(2)).join(', ');
   assert.ok(walker.grounded&&surface.floorAt(p.x,p.z,p.y-.01,p.y+.01)!==null,'Unsupported step on '+where());
   const head=surface.ceilingAt(p.x,p.z,p.y+.65,p.y+6,.16);
   if(head!==null){
    minimum=Math.min(minimum,head-p.y);
    assert.ok(head-p.y>=2.03,'Overhead clearance '+(head-p.y).toFixed(3)+' on '+where());
   }
  }
  assert.ok(Math.hypot(originX+x-walker.feet.x,z-walker.feet.z)<.02,label+' blocked going to '+[x,z]+' near '+[walker.feet.x-originX,walker.feet.z].map(v=>v.toFixed(2)));
 }
 assert.ok(Math.abs(walker.feet.y-finish)<.025,label+' failed its destination level');
 routes++;
}
function both(label,points,low,high=low){
 trace(label,points,low,high);
 trace(label,[...points].reverse(),high,low);
}
for(const [name,x,z,width] of [['West',14,1.70,3.20],['East',48.30,14,3.65]]){
 for(let i=0;i<levels.length-1;i++){
  const low=levels[i],high=levels[i+1],landing=x+.75;
  const steps=Math.round((high-low)/.1778);
  const turn=x+1.44+Math.floor(steps/2)*.2794+.52;
  for(const offset of [-.25,0,.25]){
   const near=z+width/4+offset,far=z+3*width/4-offset;
   both(name+' switchback '+i,[[landing,near],[turn+offset,near],[turn+offset,far],[landing,far]],low,high);
  }
 }
}
const [B,G,L2,L3]=levels;
const approaches=[
 ['West lower-ground to stockroom',B,[[14.78,3.3],[14.78,6.35],[15.75,7.35]]],
 ['West ground to Fourth Avenue side of hall',G,[[14.78,3.3],[14.78,5.76],[13.2,5.76],[12.7,5.76]]],
 ['West second-floor to reading tiers',L2,[[14.75,3.02],[13.08,3.02],[13.08,7.50],[10.40,7.50]],L2+3*.181],
 ['West upper to studio classroom',L3,[[14.78,3.50],[14.78,10.18],[11.18,10.18],[11.18,8.25]]],
 ['Teaching gallery around stair to studios',L3,[[31.25,4.47],[22.45,4.47],[22.12,5.64],[14.78,5.64],[14.78,10.18],[11.18,10.18]]],
 ['East lower-ground to store aisle',B,[[49.05,15.82],[46.20,15.82],[45.20,16.6]]],
 ['East ground to public foyer',G,[[49.05,15.82],[46.25,15.82],[46.25,14.2],[44.4,14.2]]],
 ['East second-floor to staff gallery',L2,[[49.11,15.85],[49.11,12.55],[50.25,12.55]]],
 ['East upper to reception',L3,[[49.11,15.85],[49.11,13.18],[50.0,13.18],[50.0,9.85]]]
];
for(const [label,h,points,finish=h] of approaches)both(label,points,h,finish);
for(const y of [7.50,14.22])
 both('Reading-room stepped aisle',[[13.08,y],[9.20,y]],L2,L2+.724);
for(const [x,near,width] of [[14,1.70,3.20],[48.30,14,3.65]]){
 for(const at of [.40,.70,.90]){
  const p=new Vector3(originX+x+.89,L3+1.08,near+width*.5*at);
  const hit=surface.firstHit(new Ray(p,new Vector3(1,0,0)),.6);
  assert.equal(hit?.object.userData.layer,'Circulation / Top landing guards','Unguarded top landing');
 }
}
// Former south exits led into the hall void, retaining wall and trusses.
// Require the actual wall face across each opening, at three body heights.
for(const [x,z,h] of [[14.78,4.90,L2],...levels.map(h=>[49.08,17.65,h])]){
 for(const dx of [-.4,0,.4])for(const dy of [.2,1,1.95]){
  const hit=surface.firstHit(new Ray(new Vector3(originX+x+dx,h+dy,z-.31),new Vector3(0,0,1)),.35);
  assert.equal(hit?.object.userData.layer,'Structure / Concrete stair cores','Open side of stair at '+[x+dx,z,h]);
 }
}
console.log(routes+' directional traversals; all eight storey exits and five closed former openings checked; minimum sampled headroom '+minimum.toFixed(3)+' m.');
