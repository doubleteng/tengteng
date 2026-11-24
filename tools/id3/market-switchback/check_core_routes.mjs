// Traverse each real switchback stair in both directions using the visitor controller.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {Vector3} from '../../../teaching/id3/lib/three.module.min.js';
import {GLTFLoader} from '../../../teaching/id3/lib/loaders/GLTFLoader.js';
import {Walker} from '../../../teaching/id3/walk-mode.js';
import {WalkSurfaces} from '../../../teaching/id3/walk-surfaces.js';

const file=process.argv[2]??new URL('../../../teaching/id3/models/market-switchback.glb',import.meta.url);
const bytes=await fs.readFile(file);
const {scene}=await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');
const surface=new WalkSurfaces([scene]);
const levels=[-1.056,2.50,6.4116,10.6788];
const originX=-82.906;
const forward=new Set(['KeyW']);

function follow(walker,x,z,description){
 const dx=x-walker.feet.x,dz=z-walker.feet.z,length=Math.hypot(dx,dz);
 walker.yaw=Math.atan2(dx,-dz);
 const steps=Math.ceil(length/.03);
 for(let k=0;k<steps;k++)walker.step(length/(steps*2.15),forward);
 assert.ok(Math.hypot(x-walker.feet.x,z-walker.feet.z)<.05,
  description+' is obstructed near '+walker.feet.toArray().map(n=>n.toFixed(2)).join(', '));
}

for(const [core,x,z,width] of [['West',14,1.70,3.20],['East',48.30,14,3.65]]){
 for(let i=0;i<levels.length-1;i++){
  const low=levels[i],high=levels[i+1];
  const landingX=originX+x+.75, near=z+width/4, far=z+3*width/4;
  const risers=Math.round((high-low)/.1778);
  const turnX=originX+x+1.44+Math.floor(risers/2)*.2794+.40;
  const path=[[landingX,near],[turnX,near],[turnX,far],[landingX,far]];
  for(const ascent of [true,false]){
   const route=ascent?path:[...path].reverse();
   const start=ascent?low:high,finish=ascent?high:low;
   const walker=new Walker(surface,new Vector3(route[0][0],start,route[0][1]),new Vector3(1,0,0));
   for(const [x,z] of route.slice(1))follow(walker,x,z,core+' stair at level '+i);
   assert.ok(walker.grounded&&Math.abs(walker.feet.y-finish)<.025,core+' stair missed its destination landing');
  }
 }
}
console.log('Passed 12 floor-to-floor routes in the two stair cores, ascending and descending.');
