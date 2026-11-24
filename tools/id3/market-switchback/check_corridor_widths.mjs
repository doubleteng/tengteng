// Model-space corridor check. Start and end points lie in halls and on room
// approaches, outside narrower door openings. Measures design walkways, not
// the legal occupancy/egress performance of the project.
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {Vector3} from '../../../teaching/id3/lib/three.module.min.js';
import {GLTFLoader} from '../../../teaching/id3/lib/loaders/GLTFLoader.js';
import {WalkSurfaces} from '../../../teaching/id3/walk-surfaces.js';
import {WalkDoors} from '../../../teaching/id3/walk-doors.js';

const file=process.argv[2]||new URL('../../../teaching/id3/models/market-switchback.glb',import.meta.url);
const bytes=await readFile(file);
const {scene}=await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');
scene.traverse(o=>{if(o.userData.initialHidden)o.visible=false;});
const doors=new WalkDoors(scene,{caseStudy:true});
const surfaces=new WalkSurfaces([scene],{doors});
const originX=-82.906, radius=1.2192/2;
const G=2.5, L2=6.4116, L3=10.6788, B=-1.056;
// Search bounds keep each path within its own corridor and floor. Walking
// outside the exterior wall or through an adjoining hall must not rescue it.
const routes=[
 ['Main hall central aisle',G,[16.46,9.30,39.91,12.90],[17.28,11],[38.90,11]],
 ['Main hall south side aisle',G,[16.45,15.33,39.88,18.24],[17.25,17.4],[38.85,17.3]],
 ['Small hall central aisle',L2,[58.72,6.32,69.80,9],[59.45,7.32],[68.8,7.32]],
 ['Stockroom cross aisle',B,[22,3.75,47.79,14.9],[22.60,4.62],[46.5,9.51]],
 ['West classroom gallery',L3,[3.1,9.36,13.74,11],[3.8,10.15],[12.6,10.15]],
 ['North office gallery',L3,[39.9,5.09,56.55,7.72],[40.93,5.85],[55.88,6]],
 ['Upper entrance passage',L3,[45.91,3.19,48.10,6.30],[47.02,4.10],[47.02,5.75]],
 ['East office passage to core',L3,[54.97,5.1,56.96,14.40],[55.86,6.50],[56.11,13.88]],
 ['Core to upper washroom',L3,[54.94,13.08,69.75,14.53],[56.11,13.88],[68.04,13.88]],
 ['Staff common lobby',L2,[46.28,3,48.17,6.9],[47.16,3.8],[47.09,6]],
 ['Small hall support gallery',L2,[61.30,13.11,69.75,17.88],[65,16.95],[62.15,15.23]],
 ['Street lobby to café entrance',G,[56.99,8.90,69.9,17.91],[61.28,16.80],[68.80,10.30]],
 ['Street lobby to main foyer',G,[39.95,1.75,69.76,18.35],[61.28,16.80],[47.55,12.93]],
 ['Street lobby to hall doorway',G,[39.95,1.75,69.76,18.35],[61.28,16.80],[40.70,14.10]],
 ['Hall doorway to street lobby',G,[39.95,1.75,69.76,18.35],[40.70,14.10],[61.28,16.80]],
 ['Lower-ground lift to receiving door',B,[48.05,7.70,57.15,13.80],[55.96,12.10],[48.85,9.51]],
 ['Lower-ground lift to workshop door',B,[54.07,7.42,56.63,13.81],[55.96,12.10],[55.90,9.10]],
 ['Ground lift to street lobby',G,[54.70,8.90,64.40,17.91],[55.96,12.10],[61.28,16.80]],
 ['Second-floor lift to auditorium support entrance',L2,[54.70,9.45,61.20,17.90],[55.96,12.10],[60.48,15.20]],
 ['Second-floor lift to public hall entrance',L2,[54.70,9.45,61.20,17.90],[55.96,12.10],[58.62,13.95]],
 ['Second-floor lift to staff and courtyard',L2,[46.25,5.45,56.70,13.00],[55.96,12.10],[47.09,6]],
 ['Upper lift to reception desk',L3,[52.9,6.35,57.02,13.79],[55.96,12.10],[53.53,8.65]],
 ['Reception desk to waiting benches',L3,[48.21,6.30,55.65,13.94],[53.53,8.65],[49.91,11.66]],
];
const compass=Array.from({length:8},(_,i)=>[Math.cos(i*Math.PI/4),Math.sin(i*Math.PI/4)]);
const headings=[[0,1],[0,-1],[1,0],[-1,0]];
function supported(p,bodyRadius=radius){
 if(!surfaces.canStand(p,bodyRadius))return false;
 if(surfaces.floorAt(p.x,p.z,p.y-.10,p.y+.10)===null)return false;
 return compass.every(([x,z])=>surfaces.floorAt(p.x+x*bodyRadius,p.z+z*bodyRadius,p.y-.10,p.y+.10)!==null);
}
function pathExists(h,box,start,end,pitch=.08,bodyRadius=radius){
 const [x,z,X,Z]=box,cols=1+Math.floor((X-x)/pitch),rows=1+Math.floor((Z-z)/pitch);
 const visited=new Int8Array(cols*rows),queue=[];
 const position=i=>new Vector3(originX+x+(i%cols)*pitch,h,z+Math.floor(i/cols)*pitch);
 const near=(point,p)=>Math.hypot(point.x-originX-p[0],point.z-p[1])<=.30;
 for(let j=0;j<rows;j++)for(let i=0;i<cols;i++){
  const index=j*cols+i,p=position(index);
  if(near(p,start)&&supported(p,bodyRadius)){visited[index]=1;queue.push(index);}
 }
 for(let k=0;k<queue.length;k++){
  const index=queue[k],p=position(index),i=index%cols,j=Math.floor(index/cols);
  if(near(p,end))return true;
  for(const [dx,dz] of headings){
   const xx=i+dx,zz=j+dz;
   if(xx<0||xx>=cols||zz<0||zz>=rows)continue;
   const next=zz*cols+xx;
   if(visited[next])continue;
   const q=position(next);
   if(!supported(q,bodyRadius)){visited[next]=-1;continue;}
   if(surfaces.canMove(p,q,bodyRadius)){visited[next]=1;queue.push(next);}
  }
 }
 return false;
}
const failed=[];
for(const open of [false,true]){
 for(const door of doors.entries)door.pose(Number(open));
 for(const [name,y,bounds,a,b] of routes){
  // Refine any ambiguous lattice result: a tight physical lane can lie
  // between the coarse sample axes without having been blocked by geometry.
  if(!pathExists(y,bounds,a,b)&&!pathExists(y,bounds,a,b,.04))failed.push(name+' / '+(open?'open':'closed'));
 }
 if(open){
  const outside=new Vector3(originX+40.70,G,14.10),inside=new Vector3(originX+39.30,G,14.10);
  if(!supported(outside)||!supported(inside)||
     !surfaces.canMove(outside,inside,radius)||!surfaces.canMove(inside,outside,radius))
   failed.push('Open hall threshold cannot be crossed continuously in both directions.');
  const fixtures=[[46.32,12.18],[48.15,11.37],[49.40,11.37],[47.25,8.39],[48.50,8.39],[49.75,8.39]];
  for(const target of fixtures){
   if(!pathExists(G,[44.65,7.05,52.00,13.26],[51.50,10.26],target,.08,.33))
    failed.push('Cannot reach southern washroom fixture at '+target.join(', '));
  }
 }
}
assert.deepEqual(failed,[],'Corridors below 1.2192 m or disconnected');
console.log(routes.length+' mapped interior corridor routes support 1.2192 m with doors shut and fully open. The open hall threshold and six washroom fixture approaches are clear.');
