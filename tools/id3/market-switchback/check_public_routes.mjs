// Walk the displayed Market Crossing geometry. Distances are metres. This is a
// design and navigation regression, not a building-code assessment.
// node tools/id3/market-switchback/check_public_routes.mjs [case.glb]
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {Vector3, Box3, Ray} from '../../../teaching/id3/lib/three.module.min.js';
import {GLTFLoader} from '../../../teaching/id3/lib/loaders/GLTFLoader.js';
import {WalkSurfaces} from '../../../teaching/id3/walk-surfaces.js';
import {WalkDoors} from '../../../teaching/id3/walk-doors.js';

const originX = -82.906;
const walkingRadius = .22;
const laneRadius = .33;
const maxStep = .26;
const vec = (x,y,z) => new Vector3(x,y,z);
const casePath = process.argv[2] || new URL('../../../teaching/id3/models/market-switchback.glb', import.meta.url);
const data = await readFile(casePath);
const {scene} = await new GLTFLoader().parseAsync(data.buffer.slice(data.byteOffset,data.byteOffset+data.byteLength),'');
scene.traverse(object => {if(object.userData.initialHidden) object.visible=false;});
const doors = new WalkDoors(scene,{caseStudy:true});

// Collect real blockers from the exact triangle/body intersection used in FPS.
// An assembly is excluded only when testing its own rotating leaf against the
// rest of the model. Other leaves, fittings, furniture and walls still collide.
class AuditSurfaces extends WalkSurfaces {
 eachNearby(bounds,visit,onlyFloors=false){
  if(!this.collect && !this.exclude) return super.eachNearby(bounds,visit,onlyFloors);
  return super.eachNearby(bounds,(entry,index,a,b,c)=>{
   if(this.exclude?.has(entry.mesh)) return false;
   const intersects = visit(entry,index,a,b,c);
   if(intersects && this.collect){
    this.collect.add(entry.mesh.userData.layer || entry.mesh.name);
    return false;
   }
   return intersects;
  },onlyFloors);
 }
}
const surfaces = new AuditSurfaces([scene],{doors});

function doorway(door) {
 door.pose(0);
 const box=new Box3();
 for(const leaf of door.meshes) box.union(leaf.geometry.boundingBox.clone().applyMatrix4(leaf.matrixWorld));
 const size=box.getSize(new Vector3()),along=size.x>size.z?'x':'z';
 const point=box.getCenter(new Vector3());
 point.y=box.min.y;
 door.pose(door.initial);
 return {door,point,along,normal:along==='x'?'z':'x',width:size[along]};
}
const portals=doors.entries.map(doorway);
const issues=[];
// Check the exported sliding panels, wall above the opening, flush metal
// threshold and clear waiting rectangle on each floor. The lift doors are
// modelled closed. Adjacent hinged doors are tested in both extreme poses.
function freightLandings(){
 for(const opened of [false,true]){
  for(const door of doors.entries)door.pose(Number(opened));
  for(const [storey,level] of [['B',-1.056],['G',2.5],['L2',6.4116],['L3',10.6788]]){
   const failures=new Set();
   function hit(x,z,h,direction,layer,distance){
    const ray=new Ray(vec(originX+x,level+h,z),direction);
    const result=surfaces.firstHit(ray,1.2);
    if(result?.object.userData.layer!==layer || Math.abs(result.distance-distance)>.003)
     failures.add(layer+' position');
   }
   for(const z of [11.23,11.7,12.50,12.97]){
    hit(55.90,z,1.10,vec(-1,0,0),'Circulation / Lift doors',.825);
    hit(55.90,z,2.40,vec(-1,0,0),'Structure / Freight lift lintels',.60);
   }
   hit(53.82,13.84,1.10,vec(0,0,-1),'Structure / Freight lift core',.24);
   // The shaft side of the landing is on the sill, the gallery side on the
   // actual slab. Sample on both sides of their shared joint as well.
   for(let row=0;row<=15;row++){
    const z=11.35+row*.10;
    for(const x of [55.10,55.29,55.31,55.55,55.85,56.15,56.35,56.59]){
     const floor=surfaces.floorAt(originX+x,z,level-.008,level+.008);
     if(floor===null || Math.abs(floor-level)>.003)failures.add('missing or uneven sill / floor');
    }
   }
   // Adjacent sweeps overlap, covering 1.50 by 1.50 m up to 2.10 m high.
   for(let row=0;row<=29;row++){
    const z=11.375+row*.05;
    if(!surfaces.canMove(vec(originX+55.12,level,z),vec(originX+56.57,level,z),.0251,2.10,.02))
     failures.add('obstructed waiting space');
   }
   if(failures.size)issues.push('Freight landing '+storey+' / doors '+(opened?'open':'closed')+': '+[...failures].join(', '));
  }
 }
 for(const door of doors.entries)door.pose(door.initial);
}
freightLandings();
function report(portal,reason,details){
 const {door,point:p}=portal;
 issues.push(door.label+' ('+[p.x-originX,p.z,p.y].map(x=>x.toFixed(2)).join(', ')+') '+reason+(details?' — '+details:''));
}

function leafSweep({door}) {
 const blockers = new Set();
 surfaces.collect=blockers;
 surfaces.exclude=new Set(door.meshes);
 const tipTravel=Math.max(...door.meshes.map(leaf=>leaf.geometry.boundingBox.getSize(new Vector3()).length()));
 const steps=Math.ceil(Math.PI*tipTravel/(2*.06));
 for(let i=0;i<=steps;i++) {
  door.pose(i/steps);
  for(const leaf of door.meshes){
   const bounds=leaf.geometry.boundingBox;
   const size=bounds.getSize(new Vector3()),along=size.x>size.z?'x':'z';
   const from=bounds.getCenter(new Vector3()),to=from.clone();
   // Probe the solid panel body. The jamb, compression seals, hardware and
   // alignment within the rebate are not part of this obstruction probe.
   from[along]=bounds.min[along]+.10;to[along]=bounds.max[along]-.10;
   from.y=to.y=bounds.min.y;
   from.applyMatrix4(leaf.matrixWorld);to.applyMatrix4(leaf.matrixWorld);
   surfaces.canMove(from,to,.025,size.y-.13,.17);
  }
 }
 surfaces.collect=null;surfaces.exclude=null;
 door.pose(door.initial);
 return blockers;
}

// Each tested lane crosses the real open leaf between standing spaces on both
// sides. Include the midpoint explicitly even at narrow single-leaf doors.
function lanes(portal){
 const {point,along,normal,width}=portal;
 const room=width/2-laneRadius;
 const offsets=[0];
 for(let offset=.05;offset<=room;offset+=.05) offsets.push(offset,-offset);
 const result=[];
 function landing(start,end) {
  // A 0.66 m strip must have support at the centre and at both shoes.
  const count=Math.ceil(start.distanceTo(end)/.16);
  let previous;
  const dx=end.x-start.x,dz=end.z-start.z,length=Math.hypot(dx,dz);
  for(let i=0;i<=count;i++){
   const p=new Vector3().lerpVectors(start,end,i/count);
   const floor=surfaces.floorAt(p.x,p.z,point.y-.27,point.y+.27);
   if(floor===null)return null;
   p.y=floor;
   for(const side of [-.17,.17]){
    const h=surfaces.floorAt(p.x+side*dz/length,p.z-side*dx/length,floor-.18,floor+.18);
    if(h===null)return null;
   }
   if(!surfaces.canStand(p,laneRadius) || previous &&
      (Math.abs(p.y-previous.y)>maxStep || !surfaces.canMove(previous,p,laneRadius)))return null;
   previous=p;
  }
  return previous;
 }
 function approach(center,sign){
  const front=center.clone();front[normal]+=sign*1.05;
  const direct=landing(center,front);
  if(direct)return [direct];
  // A door beside a corridor may face its opposite wall or balcony guard.
  // Test a genuinely supported turn on the balcony. A post, table or planter
  // directly in front of an interior doorway must not get this exception.
  const outside=surfaces.floorAt(front.x,front.z,point.y-.27,point.y+.27)===null;
  surfaces.collect=new Set();
  surfaces.canMove(center,front,laneRadius);
  const oppositeWall=surfaces.collect.size>0 && [...surfaces.collect].every(label=>/rail|guard|Partitions and doors/i.test(label));
  surfaces.collect=null;
  if(!outside&&!oppositeWall)return [];
  if(!oppositeWall&&surfaces.canMove(center,front,laneRadius)===false)return [];
  const turn=center.clone();turn[normal]+=sign*.64;
  if(!landing(center,turn))return [];
  const ends=[];
  for(const hand of [-1,1]){
   const end=turn.clone();end[along]+=hand*1.1;
   const side=landing(turn,end);if(side)ends.push(side);
  }
  return ends;
 }
 for(const offset of offsets){
  if(room<0)break;
  const center=point.clone();center[along]+=offset;
  const sideA=approach(center,-1),sideB=approach(center,1);
  for(const a of sideA)for(const b of sideB)result.push([a,b]);
 }
 return result;
}

// Exercise the same target selection and opening-body sweep as the F key. A
// wide leaf may require stepping back along the approach before it can swing.
function canOperate(portal,approach){
 const {door,point}=portal;
 const back=approach.clone().sub(point);back.y=0;
 if(!back.lengthSq())return false;
 back.normalize();
 for(const setback of [0,.35,.70,.95]){
  const feet=approach.clone().addScaledVector(back,setback);
  const floor=surfaces.floorAt(feet.x,feet.z,approach.y-.27,approach.y+.27);
  if(floor===null)continue;
  feet.y=floor;
  if(!surfaces.canStand(feet,walkingRadius) || !surfaces.canMove(approach,feet,walkingRadius)) continue;
  const eye=feet.clone();eye.y+=1.62;
  for(const {mesh,world} of door.closed){
   const handle=mesh.geometry.boundingBox.getCenter(new Vector3()).applyMatrix4(world);
   handle.y=point.y+1.1;
   const ray=new Ray(eye,handle.sub(eye).normalize()),hit=surfaces.firstHit(ray,2.8);
   const max=hit&&!hit.object.userData.walkDoor?hit.distance+.015:2.8;
   if(doors.target(eye,ray.direction,max)!==door)continue;
   if(doors.toggle(door,eye)){doors.active.delete(door);door.open=false;return true;}
  }
 }
 return false;
}

// Sample every supported elevation at each plan cell. Join neighbouring cells
// only across a supported midpoint, walker-width collision clearance and a
// rise that a single FPS step can make. Shafts, stairs and storeys stay
// separate unless an actual sloping/stepped path connects them.
function streetReachability(){
 const pitch=.25, x0=.5+originX, z0=.40;
 const cols=Math.ceil(71.5/pitch),rows=Math.ceil(26.6/pitch),cells=[],nodes=[];
 for(let j=0;j<rows;j++)for(let i=0;i<cols;i++){
  const x=x0+i*pitch,z=z0+j*pitch,cell=[];
  for(let top=11.5;top>-1.25;){
   const floor=surfaces.floorAt(x,z,-1.25,top);
   if(floor===null)break;
   top=floor-.10;
   const p=vec(x,floor,z);
   if(surfaces.canStand(p,walkingRadius)){cell.push(nodes.length);nodes.push({p,cell:j*cols+i});}
  }
  cells.push(cell);
 }
 const leaders=Int32Array.from(nodes,(_,i)=>i);
 function root(i){
  while(leaders[i]!==i){leaders[i]=leaders[leaders[i]];i=leaders[i];}
  return i;
 }
 function adjacent(p,q){
  if(Math.abs(p.y-q.y)>maxStep+.00001 || !surfaces.canMove(p,q,walkingRadius))return false;
  const h=surfaces.floorAt((p.x+q.x)/2,(p.z+q.z)/2,Math.min(p.y,q.y)-.03,Math.max(p.y,q.y)+.03);
  return h!==null;
 }
 for(let index=0;index<nodes.length;index++){
  const {p,cell}=nodes[index],i=cell%cols,j=Math.floor(cell/cols);
  for(const [di,dj] of [[-1,0],[0,-1],[-1,-1],[1,-1]]){
   const I=i+di,J=j+dj;
   if(I<0||I>=cols||J<0)continue;
   for(const next of cells[J*cols+I]){
    const a=root(index),b=root(next);
    if(a!==b && adjacent(p,nodes[next].p)) leaders[a]=b;
   }
  }
 }
 function components(point){
  const groups=new Set(),ci=Math.round((point.x-x0)/pitch),cj=Math.round((point.z-z0)/pitch);
  for(let j=Math.max(0,cj-2);j<=Math.min(rows-1,cj+2);j++)
   for(let i=Math.max(0,ci-2);i<=Math.min(cols-1,ci+2);i++)
    for(const index of cells[j*cols+i]){
     const p=nodes[index].p;
     if(Math.hypot(p.x-point.x,p.z-point.z)<=.40 && adjacent(point,p)) groups.add(root(index));
    }
  return groups;
 }
 // Fourth Avenue forecourt is on the parcel boundary beyond the canopy.
 const x=originX+1.05,z=16;
 const floor=surfaces.floorAt(x,z,-.2,1.0);
 assert.notEqual(floor,null,'Fourth Avenue forecourt must have a floor');
 const frontage=components(vec(x,floor,z));
 assert.ok(frontage.size,'Fourth Avenue forecourt must have a navigation node');
 return point => [...components(point)].some(group=>frontage.has(group));
}

for(const portal of portals){
 const blocked=leafSweep(portal);
 if(blocked.size)report(portal,'door swing intersects fixed geometry',[...blocked].join('; '));
}
for(const {door} of portals){door.pose(1);door.value=1;door.open=true;}
const reachable=streetReachability();
let navigable=0;
for(const portal of portals){
 const approaches=lanes(portal);
 if(!approaches.length){report(portal,'no continuous 0.66 m clear passage across opened door');continue;}
 if(!approaches.some(([a,b])=>reachable(a)&&reachable(b))){
  report(portal,'no walkable connection from both sides to Fourth Avenue');continue;
 }
 navigable++;
 const {door}=portal;
 door.pose(0);door.value=0;door.open=false;
 const sides=[false,false];
 for(const path of approaches){
  for(let i=0;i<2;i++) if(!sides[i])sides[i]=canOperate(portal,path[i]);
  if(sides.every(Boolean))break;
 }
 if(!sides.every(Boolean))report(portal,'cannot aim at and open the door from both approaches');
 door.pose(1);door.value=1;door.open=true;
}
// rooms.py builds each worktable top as an indexed rectangular solid, batched
// by layer and finish. Test actual standing space along each tabletop edge so
// a room with a clear doorway but inaccessible furniture also fails.
let tables=0;
for(const mesh of scene.children){
 if(mesh.userData.layer!=='Interior / Loose furniture'||mesh.material?.name!=='Oiled birch')continue;
 const {index,attributes}=mesh.geometry,vertex=new Vector3();
 assert.equal(index.count%36,0,'Expected fitted furniture built from closed boxes');
 for(let start=0;start<index.count;start+=36){
  const box=new Box3();
  for(let i=start;i<start+36;i++)box.expandByPoint(vertex.fromBufferAttribute(attributes.position,index.getX(i)).applyMatrix4(mesh.matrixWorld));
  const size=box.getSize(new Vector3()),center=box.getCenter(new Vector3());
  if(size.x<.70||size.z<.50||size.y>.12)continue;
  const floor=surfaces.floorAt(center.x,center.z,center.y-.81,center.y-.65);
  if(floor===null)continue;
  tables++;
  let usable=false;
  for(const side of [-1,1])for(const offset of [.2,.5,.8])for(const along of ['x','z']){
   const p=box.min.clone().lerp(box.max,offset);
   p[along]=(side<0?box.min:box.max)[along]+side*.40;
   p.y=floor;
   const foot=surfaces.floorAt(p.x,p.z,floor-.025,floor+.025);
   if(foot!==null&&surfaces.canStand(p,walkingRadius)&&reachable(p)) usable=true;
  }
  if(!usable)issues.push('Unreachable worktable at ('+[center.x-originX,center.z,floor].map(x=>x.toFixed(2)).join(', ')+')');
 }
}
assert.ok(tables>=30,'Expected furnished classrooms, workshops, café and offices');
assert.ok(portals.length>=48,'Expected the full teaching-case door schedule');
if(issues.length)console.error(issues.join('\n'));
console.log(navigable+'/'+portals.length+' portals connect to the street; '+tables+' worktables and four freight landings checked; '+issues.length+' clearance or route issues.');
process.exitCode=issues.length?1:0;
