// First-person navigation uses the actual displayed triangles, in metres.
// Grid entries reference the orbit camera's existing triangle runs.
import {Box3,Vector3} from './lib/three.module.min.js';
import {indexMesh} from './camera-clearance.js?v=5e0d138cc1';

const epsilon=1e-6;
const minNormalY=.70;
const bodyRadius=.22;
const bodyHeight=1.78;
const stepHeight=.26;

function visible(object){
 for(let node=object;node;node=node.parent)if(!node.visible)return false;
 return true;
}

function floorRole(mesh,isDistrict) {
 if(typeof mesh.userData.walkable==='boolean')return mesh.userData.walkable?1:0;
 if(mesh.userData.groundSurface)return 1;
 const path=(mesh.userData.atlasPath||mesh.userData.layer||mesh.name||'').toLowerCase();
 const label=(path+' '+mesh.name).replaceAll('_',' ');
 if(/rail|guard|gutter|beam|girder|joist|blocking|stringer|truss|coping|collector|hanger|splice|frame|post|column|connection|brac|core|door|wall|partition|furnitur|table|counter|chair|cabinet|shel(?:f|ves)|equipment|mechanical|plant|tree|window|mullion|foundation|footing|trestle|solar|photovoltaic|insulation|soffit|ceiling|标线|家具|墙|柱|梁|门|窗|顶棚/.test(label))return 0;
 if(/roof|canopy|屋顶|屋面/.test(label)&&!/(?:roof|屋顶)[ _-]*(?:terrace|garden path|露台)/.test(label))return 0;
 if(isDistrict)return 0; // Non-ground city geometry consists of closed context buildings and vegetation.
 if(/court overlook/.test(label)||(/\bstair\b/.test(label)&&/graphite steel/.test(label)))return 0;
 if(/(?:floor|ground|terrain|topograph|pav(?:e|ing)|sidewalk|road|street|curb|walkway|boardwalk|platform|plaza|ramp|incline|landing|bridge|threshold|sill|corridor|terrace|balcony|porch|gallery|stair|step|tread|belvedere|tribune|plinth|studios and bridges|vestibule link|market turn|studios entrance|slab|楼板|地面|楼梯|坡道|平台|人行道|地坪|露台)/.test(label))return 1;
 // Unlabelled Rhino/GLB geometry: accept broad, upward-facing patches.
 // A named furniture/roof component above is always excluded.
 return /^(?:structure|enclosure|energy|interior|market|site)\s*[/:]/i.test(path)?0:2;
}

const north=new Vector3(),east=new Vector3(),normal=new Vector3();
function upward(a,b,c) {
 north.subVectors(b,a);east.subVectors(c,a);normal.crossVectors(north,east);
 return normal.y/Math.max(1e-20,normal.length());
}
function walkFace(entry,a,b,c) {
 return entry.role>0&&upward(a,b,c)*entry.winding>=minNormalY;
}

function planeHeight(a,b,c,x,z) {
 const ux=b.x-a.x,uz=b.z-a.z,vx=c.x-a.x,vz=c.z-a.z,det=ux*vz-uz*vx;
 if(Math.abs(det)<1e-10)return null;
 const dx=x-a.x,dz=z-a.z,u=(dx*vz-dz*vx)/det,v=(ux*dz-uz*dx)/det;
 return u>=-epsilon&&v>=-epsilon&&u+v<=1+epsilon?a.y+u*(b.y-a.y)+v*(c.y-a.y):null;
}

// Keep the portion of the triangle between the ankle and head planes. Project
// this convex polygon to the horizontal plane and sweep a disk along the move.
// This catches thin closed doors and walls even between very distant endpoints.
function clipY(source,count,result,y,above) {
 let n=0,old=3*(count-1);
 for(let i=0;i<count;i++) {
  const cur=3*i,first=source[old+1]-y,last=source[cur+1]-y;
  if((first<0)!==(last<0)){
   const t=first/(first-last);
   result[n++]=source[old]+t*(source[cur]-source[old]);
   result[n++]=y;
   result[n++]=source[old+2]+t*(source[cur+2]-source[old+2]);
  }
  if(above?last>=0:last<=0){
   result[n++]=source[cur];result[n++]=source[cur+1];result[n++]=source[cur+2];
  }
  old=cur;
 }
 return n/3;
}
function pointDist2(x,z,ax,az,bx,bz) {
 const dx=bx-ax,dz=bz-az,length=dx*dx+dz*dz;
 const t=length?Math.max(0,Math.min(1,((x-ax)*dx+(z-az)*dz)/length)):0;
 const rx=x-ax-t*dx,rz=z-az-t*dz;
 return rx*rx+rz*rz;
}
function touched(p,n,from,to,radius){
 let positive=false,negative=false,area=0,old=3*(n-1);
 const dx=to.x-from.x,dz=to.z-from.z,r2=radius*radius;
 for(let i=0;i<n;i++){
  const cur=3*i,ax=p[old],az=p[old+2],bx=p[cur],bz=p[cur+2],ex=bx-ax,ez=bz-az;
  const cross=(from.x-ax)*ez-(from.z-az)*ex;
  positive ||= cross>epsilon;negative ||= cross< -epsilon;
  area+=ax*bz-bx*az;
  if(pointDist2(from.x,from.z,ax,az,bx,bz)<r2||pointDist2(to.x,to.z,ax,az,bx,bz)<r2||
     pointDist2(ax,az,from.x,from.z,to.x,to.z)<r2)return true;
  const det=dx*ez-dz*ex;
  if(Math.abs(det)>epsilon){
   const ox=ax-from.x,oz=az-from.z,t=(ox*ez-oz*ex)/det,u=(ox*dz-oz*dx)/det;
   if(t>=0&&t<=1&&u>=0&&u<=1)return true;
  }
  old=cur;
 }
 return Math.abs(area)>epsilon&&!(positive&&negative);
}

const gridKey=(x,z)=>x+','+z;
class RunGrid {
 constructor(){this.levels=new Map();this.serial=0;}
 insert(entry,run){
  const {bounds}=run;
  let size=4;
  while(Math.max(bounds.max.x-bounds.min.x,bounds.max.z-bounds.min.z)>size*2)size*=4;
  if(!this.levels.has(size))this.levels.set(size,new Map());
  const cells=this.levels.get(size),item={entry,run,serial:0};
  const maxX=Math.floor(bounds.max.x/size),maxZ=Math.floor(bounds.max.z/size);
  for(let z=Math.floor(bounds.min.z/size);z<=maxZ;z++)for(let x=Math.floor(bounds.min.x/size);x<=maxX;x++){
   const key=gridKey(x,z);
   if(!cells.has(key))cells.set(key,[]);
   cells.get(key).push(item);
  }
 }
 query(bounds,visit){
  const serial=++this.serial;
  for(const [size,cells] of this.levels){
   const maxX=Math.floor(bounds.max.x/size),maxZ=Math.floor(bounds.max.z/size);
   for(let z=Math.floor(bounds.min.z/size);z<=maxZ;z++)for(let x=Math.floor(bounds.min.x/size);x<=maxX;x++){
    const items=cells.get(gridKey(x,z));if(!items)continue;
    for(const item of items){
     if(item.serial===serial)continue;
     item.serial=serial;
     if(item.run.bounds.intersectsBox(bounds)&&visible(item.entry.mesh)&&visit(item.entry,item.run))return true;
    }
   }
  }
  return false;
 }
}

export class WalkSurfaces {
 constructor(roots,{clearance=null,doors=null}={}) {
  this.entries=[];this.grid=new RunGrid();this.doors=doors;
  this.box=new Box3();this.doorBounds=new Box3();this.a=new Vector3();this.b=new Vector3();this.c=new Vector3();
  this.rayPoint=new Vector3();this.clipIn=new Float64Array(24);this.clipOut=new Float64Array(24);
  const reuse=new Map((clearance?.meshes||[]).map(r=>[r.mesh,r]));
  roots.forEach((root,which)=>{
   if(!root)return;
   root.updateWorldMatrix(true,true);
   root.traverse(mesh=>{
    if(!mesh.isMesh||!mesh.geometry?.attributes.position||mesh.userData.contextSourceSupport||
       mesh.userData.contextOutline||mesh.userData.walkDoor)return;
    const existing=reuse.get(mesh);
    const data=existing&&existing.indices===mesh.geometry.index?.array?existing:indexMesh(mesh);
    let role=floorRole(mesh,which>0);
    // A tessellated, unnamed slab can consist entirely of small triangles.
    // Check its bounding footprint rather than requiring large individual faces.
    if(role===2&&(data.bounds.max.x-data.bounds.min.x<.8||data.bounds.max.z-data.bounds.min.z<.8))role=0;
    const entry={...data,role,winding:mesh.matrixWorld.determinant()<0?-1:1};
    this.entries.push(entry);
    for(const block of entry.blocks)for(const run of block.runs)this.grid.insert(entry,run);
   });
  });
 }
 eachTriangle(entry,start,end,visit,world) {
  const {vertices,indices}=entry,{a,b,c}=this;
  for(let i=start;i<end;i+=3){
   a.fromBufferAttribute(vertices,indices?indices[i]:i);
   b.fromBufferAttribute(vertices,indices?indices[i+1]:i+1);
   c.fromBufferAttribute(vertices,indices?indices[i+2]:i+2);
   if(world){a.applyMatrix4(world);b.applyMatrix4(world);c.applyMatrix4(world);}
   if(visit(entry,i/3,a,b,c))return true;
  }
  return false;
 }
 eachDoor(test,visit){
  for(const mesh of this.doors?.meshes||[]){
   if(!visible(mesh))continue;
   const geometry=mesh.geometry;
   if(!geometry.boundingBox)geometry.computeBoundingBox();
   const world=mesh.matrixWorld;
   this.doorBounds.copy(geometry.boundingBox).applyMatrix4(world);
   if(!test(this.doorBounds))continue;
   const vertices=geometry.attributes.position,indices=geometry.index?.array;
   if(this.eachTriangle({mesh,role:0,vertices,indices},0,indices?.length??vertices.count,visit,world))return true;
  }
  return false;
 }
 eachNearby(box,visit,onlyFloors=false){
  if(this.grid.query(box,(entry,run)=>(!onlyFloors||entry.role)&&this.eachTriangle(entry,run.start,run.end,visit)))return true;
  return !onlyFloors&&this.eachDoor(b=>box.intersectsBox(b),visit);
 }
 firstHit(ray,maxDistance=Infinity){
  let result=null,nearest=maxDistance;
  const scan=(entry,faceIndex,a,b,c)=>{
   if(!ray.intersectTriangle(a,b,c,false,this.rayPoint))return false;
   const distance=ray.origin.distanceTo(this.rayPoint);if(distance>nearest+epsilon)return false;
   const walkable=walkFace(entry,a,b,c);
   if(result&&Math.abs(nearest-distance)<=epsilon&&!walkable)return false;
   nearest=distance;
   result={object:entry.mesh,faceIndex,distance,point:this.rayPoint.clone(),walkable};
   return false;
  };
  // Looking for an operable door is frequent and limited to arm's reach.
  // Query just that short portion of the grid, regardless of district size.
  if(Number.isFinite(maxDistance)){
   const box=this.box;
   box.makeEmpty().expandByPoint(ray.origin).expandByPoint(ray.at(maxDistance,this.rayPoint)).expandByScalar(epsilon);
   this.eachNearby(box,scan);
   return result;
  }
  for(const entry of this.entries){
   if(!visible(entry.mesh)||!ray.intersectsBox(entry.bounds))continue;
   for(const block of entry.blocks)if(ray.intersectsBox(block.bounds))
    for(const run of block.runs)if(ray.intersectsBox(run.bounds))this.eachTriangle(entry,run.start,run.end,scan);
  }
  this.eachDoor(b=>ray.intersectsBox(b),scan);
  return result;
 }
 pick(ray) {
  const hit=this.firstHit(ray);
  return hit?.walkable&&this.canStand(hit.point)?hit:null;
 }
 floorAt(x,z,minY,maxY){
  const box=this.box;box.min.set(x,minY,z);box.max.set(x,maxY,z);
  let highest=-Infinity;
  this.eachNearby(box,(entry,_i,a,b,c)=>{
   if(!walkFace(entry,a,b,c))return false;
   const y=planeHeight(a,b,c,x,z);
   if(y!==null&&y>=minY-epsilon&&y<=maxY+epsilon&&y>highest)highest=y;
   return false;
  },true);
  return Number.isFinite(highest)?highest:null;
 }
 ceilingAt(x,z,minY,maxY,radius=.20){
  const box=this.box;box.min.set(x-radius,minY,z-radius);box.max.set(x+radius,maxY,z+radius);
  let lowest=Infinity;
  const dx=[0,radius,-radius,0,0],dz=[0,0,0,radius,-radius];
  this.eachNearby(box,(_entry,_i,a,b,c)=>{
   for(let i=0;i<5;i++){
    const y=planeHeight(a,b,c,x+dx[i],z+dz[i]);
    if(y!==null&&y>=minY-epsilon&&y<=maxY+epsilon&&y<lowest)lowest=y;
   }
   return false;
  });
  return Number.isFinite(lowest)?lowest:null;
 }
 canMove(from,to,radius=bodyRadius,height=bodyHeight,step=stepHeight){
  // The controller substeps movement. Ankle clearance admits ordinary risers;
  // floorAt separately limits how far that substep can rise.
  const lo=Math.max(from.y,to.y)+step+epsilon,hi=Math.max(from.y,to.y)+height-epsilon;
  const box=this.box,p=this.clipIn,q=this.clipOut;
  box.min.set(Math.min(from.x,to.x)-radius,lo,Math.min(from.z,to.z)-radius);
  box.max.set(Math.max(from.x,to.x)+radius,hi,Math.max(from.z,to.z)+radius);
  const blocked=this.eachNearby(box,(_entry,_i,a,b,c)=>{
   if(Math.max(a.y,b.y,c.y)<lo||Math.min(a.y,b.y,c.y)>hi||
      Math.max(a.x,b.x,c.x)<box.min.x||Math.min(a.x,b.x,c.x)>box.max.x||
      Math.max(a.z,b.z,c.z)<box.min.z||Math.min(a.z,b.z,c.z)>box.max.z)return false;
   a.toArray(p,0);b.toArray(p,3);c.toArray(p,6);
   const count=clipY(p,3,q,lo,true);
   if(!count)return false;
   const n=clipY(q,count,p,hi,false);
   return n>0&&touched(p,n,from,to,radius);
  });
  return !blocked;
 }
 canStand(point,radius=bodyRadius,height=bodyHeight){return this.canMove(point,point,radius,height);}
}
