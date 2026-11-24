// Resolve a vault or a mantle against the visible model triangles in the walking grid.
import {Box3,Vector3,MathUtils} from './lib/three.module.min.js';

const radius=.22,body=1.78;
const railName=/handrail|guard|railing|balustrad|parapet|fence|(?:^|[ /_-])rails?(?:$|[ /_-])|栏杆|护栏|矮墙/i;
const exclude=/tree|vegetation|furnitur|window|door|mullion|signage|furnishing|light fixture|planting|门|窗|家具|树/i;
const roofName=/roof|canop|terrace|balcony|walkway|floor|landing|slab|platform|membrane|deck|屋面|屋顶|雨棚|平台|楼板/i;
const smooth=t=>t*t*(3-2*t);
const clamp=MathUtils.clamp;

// Clip a horizontal approach line to the triangle's projected footprint; even
// a narrow rail cap can be found between two successive physics steps.
function nearEdge(a,b,c,origin,direction,reach){
 const ux=b.x-a.x,uz=b.z-a.z,vx=c.x-a.x,vz=c.z-a.z;
 const det=ux*vz-uz*vx;
 if(Math.abs(det)<1e-10)return null;
 const ox=origin.x-a.x,oz=origin.z-a.z;
 const u=(ox*vz-oz*vx)/det,v=(ux*oz-uz*ox)/det;
 const du=(direction.x*vz-direction.z*vx)/det,dv=(ux*direction.z-uz*direction.x)/det;
 let start=0,end=reach;
 const bounds=(at,rate)=>{
  if(Math.abs(rate)<1e-9)return at>=-1e-7;
  const t=-at/rate;
  if(rate>0)start=Math.max(start,t);else end=Math.min(end,t);
  return end>=start-1e-7;
 };
 if(!bounds(u,du)||!bounds(v,dv)||!bounds(1-u-v,-du-dv)||start<.16)return null;
 return {distance:start,height:a.y+(u+start*du)*(b.y-a.y)+(v+start*dv)*(c.y-a.y)};
}

export class StreetTraversal {
 constructor(surface){
  this.surface=surface;this.bounds=new Box3();this.edgeKinds=new WeakMap();
  this.a=new Vector3();this.b=new Vector3();this.cross=new Vector3();this.cooldown=0;this.jumped=false;
 }
 kind(entry){
  let flags=this.edgeKinds.get(entry);
  if(flags!==undefined)return flags;
  const mesh=entry.mesh,data=mesh.userData,label=[data.atlasPath,data.layer,mesh.name].join(' ');
  const allowed=data.walkable!==false&&!data.walkDoor&&!exclude.test(label);
  const rail=allowed&&railName.test(label);
  const generic=allowed&&(entry.role===2||(!label.trim()&&entry.role!==-1));
  flags=(rail||generic?1:0)|(allowed&&!rail&&(roofName.test(label)||data.contextBuildingColor||generic)?2:0);
  this.edgeKinds.set(entry,flags);return flags;
 }
 findEdge(from,direction,type,reach=type==='vault'?.80:.76){
  const low=from.y+(type==='vault'?.42:.34),high=from.y+(type==='vault'?1.43:1.93);
  const end=this.a.copy(from).addScaledVector(direction,reach);
  this.bounds.min.set(Math.min(from.x,end.x)-.01,low,Math.min(from.z,end.z)-.01);
  this.bounds.max.set(Math.max(from.x,end.x)+.01,high,Math.max(from.z,end.z)+.01);
  let edge=null;const flag=type==='vault'?1:2;
  this.surface.eachNearby(this.bounds,(entry,_i,a,b,c)=>{
   if(!(this.kind(entry)&flag))return false;
   const n=this.cross.crossVectors(this.a.subVectors(b,a),this.b.subVectors(c,a));
   if(n.y*entry.winding<.70*n.length())return false;
   const hit=nearEdge(a,b,c,from,direction,reach);
   if(hit&&hit.height>=low&&hit.height<=high&&(!edge||hit.distance<edge.distance-.09||
      (Math.abs(hit.distance-edge.distance)<=.09&&hit.height>edge.height)))edge=hit;
   return false;
  });return edge;
 }
 plan(walker,direction,type){
  const edge=this.findEdge(walker.feet,direction,type);if(!edge)return null;
  const from=walker.feet.clone(),surface=this.surface;
  const at=(d,y)=>from.clone().addScaledVector(direction,d).setY(y);
  const grip=at(edge.distance,edge.height);
  let palms=null,face=Math.atan2(direction.x,-direction.z);
  if(type==='climb'){
   // Measure both places on the lip: oblique approaches and sloping eaves
   // put the two hands at different depths and elevations.
   const right=new Vector3(-direction.z,0,direction.x);palms=[];
   for(const side of [-1,1]){
    const offset=from.clone().addScaledVector(right,side*.18);
    const hit=this.findEdge(offset,direction,type,1.0);
    if(!hit||Math.abs(hit.height-grip.y)>.17||Math.abs(hit.distance-edge.distance)>.26)return null;
    palms.push(offset.addScaledVector(direction,hit.distance).setY(hit.height));
   }
   face=Math.atan2(palms[1].z-palms[0].z,palms[1].x-palms[0].x);
   grip.lerpVectors(palms[0],palms[1],.5);
  }
  const near=at(Math.max(0,edge.distance-.34),from.y);
  const far=at(edge.distance+(type==='vault'?.54:.44),0);
  const isVault=type==='vault';
  const min=isVault?from.y-.85:edge.height-.23,max=isVault?edge.height-.19:edge.height+.24;
  const landing=surface.floorAt(far.x,far.z,min,max,true);
  if(landing===null)return null;
  far.y=landing;
  // Both feet must fit on the destination, including narrow or sloped roofs.
  for(const offset of [-.15,.15]){
   if(surface.floorAt(far.x+direction.z*offset,far.z-direction.x*offset,landing-.18,landing+.18,true)===null)return null;
  }
  const crest=Math.max(grip.y,landing)+.14;
  const highNear=near.clone().setY(crest),highFar=far.clone().setY(crest);
  if(!surface.canStand(far,radius,body)||!surface.canMove(from,near,radius,body,.06)||
     !surface.canMove(highNear,highFar,radius,body,.04))return null;
  // Test the vertical body sweeps at both ends as well as the bridge between them.
  for(const p of [near,far]){
   if(surface.ceilingAt(p.x,p.z,p.y+body-.01,crest+body,radius)!==null)return null;
  }
  return {type,from,near,highNear,highFar,far,grip,palms,face,
   duration:isVault?.66:1.02,elapsed:0,progress:0};
 }
 advance(walker,dt){
  const a=this.action;
  a.elapsed+=dt;const t=a.progress=Math.min(a.elapsed/a.duration,1);
  const vault=a.type==='vault',lift=vault?.40:.55,across=vault?.78:.84;
  if(t<.14)walker.feet.lerpVectors(a.from,a.near,smooth(t/.14));
  else if(t<lift)walker.feet.lerpVectors(a.near,a.highNear,smooth((t-.14)/(lift-.14)));
  else if(t<across)walker.feet.lerpVectors(a.highNear,a.highFar,smooth((t-lift)/(across-lift)));
  else walker.feet.lerpVectors(a.highFar,a.far,smooth(clamp((t-across)/(1-across),0,1)));
  if(t===1){walker.feet.copy(a.far);walker.grounded=true;this.action=null;this.cooldown=.24;this.jumped=false;}
  return true;
 }
 step(walker,dt,held){
  if(this.action)return this.advance(walker,dt);
  this.cooldown=Math.max(0,this.cooldown-dt);
  if(walker.grounded)this.jumped=false;
  const direction=walker.moveDirection(held);
  if(direction.lengthSq()===0&&walker.boosted)direction.copy(walker.launch);
  // Do not start an automatic ledge action while just standing or falling.
  if(this.cooldown===0&&direction.lengthSq()>.5&&(walker.grounded||this.jumped)){
   const type=walker.grounded?'vault':'climb';
   this.cooldown=walker.grounded?.085:.045;
   this.action=this.plan(walker,direction,type);
   if(this.action){
    walker.boosted=false;walker.verticalSpeed=0;walker.grounded=false;
    return this.advance(walker,dt);
   }
  }
  return walker.step(dt,held);
 }
}
