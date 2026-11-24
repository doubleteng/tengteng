// Resolve a vault or a mantle against the visible model triangles in the walking grid.
import {Box3,Ray,Vector3,MathUtils} from './lib/three.module.min.js';

const radius=.22,body=1.78;
const railName=/handrail|guard|railing|balustrad|parapet|fence|(?:^|[ /_-])rails?(?:$|[ /_-])|栏杆|护栏|矮墙/i;
const exclude=/tree|vegetation|furnitur|window|door|mullion|signage|furnishing|light fixture|planting|门|窗|家具|树/i;
const wallName=/wall|facade|façade|enclosure|cladding|cassette|masonry|plinth|porch|parapet|building|建筑|墙|围护/i;
const roofName=/roof|canop|porch|terrace|balcony|walkway|floor|landing|slab|platform|membrane|deck|屋面|屋顶|雨棚|平台|楼板/i;
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
 let start=0,end=reach,nx=0,nz=0;
 const bounds=(at,rate,gx,gz)=>{
  if(Math.abs(rate)<1e-9)return at>=-1e-7;
  const t=-at/rate;
  if(rate>0){if(t>start){start=t;nx=gx;nz=gz;}}else end=Math.min(end,t);
  return end>=start-1e-7;
 };
 if(!bounds(u,du,vz/det,-vx/det)||!bounds(v,dv,-uz/det,ux/det)||
    !bounds(1-u-v,-du-dv,(uz-vz)/det,(vx-ux)/det)||start<.075)return null;
 const length=Math.hypot(nx,nz);
 return {distance:start,nx:nx/length,nz:nz/length,height:a.y+(u+start*du)*(b.y-a.y)+(v+start*dv)*(c.y-a.y)};
}

export class StreetTraversal {
 constructor(surface){
  this.surface=surface;this.bounds=new Box3();this.edgeKinds=new WeakMap();
  this.a=new Vector3();this.b=new Vector3();this.cross=new Vector3();this.cooldown=0;this.jumped=false;
  this.ray=new Ray();this.wall=null;
 }
 kind(entry){
  let flags=this.edgeKinds.get(entry);
  if(flags!==undefined)return flags;
  const mesh=entry.mesh,data=mesh.userData,label=[data.atlasPath,data.layer,mesh.name].join(' ');
  const allowed=data.walkable!==false&&!data.walkDoor&&!exclude.test(label);
  const rail=allowed&&railName.test(label);
  const generic=allowed&&(entry.role===2||(!label.trim()&&entry.role!==-1));
  const wall=allowed&&(wallName.test(label)||data.contextBuildingColor||generic);
  flags=(rail||generic||wall?1:0)|(allowed&&!rail&&(entry.role===1||roofName.test(label)||wall)?2:0);
  this.edgeKinds.set(entry,flags);return flags;
 }
 findEdge(from,direction,type,reach=type==='vault'?.91:.92){
  const low=from.y+(type==='vault'?.32:.28),high=from.y+(type==='vault'?1.50:2.02);
  const end=this.a.copy(from).addScaledVector(direction,reach);
  this.bounds.min.set(Math.min(from.x,end.x)-.01,low,Math.min(from.z,end.z)-.01);
  this.bounds.max.set(Math.max(from.x,end.x)+.01,high,Math.max(from.z,end.z)+.01);
  let edge=null;const flag=type==='climb'?2:1;
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
  let action=this.planLanding(walker.feet,direction,type,edge);
  // A diagonal approach may leave one hand or the landing outside a narrow deck.
  // Retry square to its actual lip without changing which side the walker is on.
  const dot=direction.x*edge.nx+direction.z*edge.nz;
  if(!action&&dot>.32&&dot<.985){
   const inward=new Vector3(edge.nx,0,edge.nz),square=this.findEdge(walker.feet,inward,type);
   if(square&&Math.abs(square.height-edge.height)<.16)action=this.planLanding(walker.feet,inward,type,square);
  }
  return action;
 }
 planLanding(point,direction,type,edge){
  const from=point.clone(),surface=this.surface;
  const at=(d,y)=>from.clone().addScaledVector(direction,d).setY(y);
  const grip=at(edge.distance,edge.height);
  let palms=null,face=Math.atan2(direction.x,-direction.z);
  if(type!=='vault'){
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
  const near=at(Math.max(0,edge.distance-.36),from.y);
  const far=at(edge.distance+(type==='vault'?.54:.44),0);
  const overRail=type!=='climb',isVault=type==='vault';
  const min=overRail?from.y-2.8:edge.height-.23,max=overRail?edge.height-.19:edge.height+.24;
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
  return {type:isVault?'vault':'climb',from,near,highNear,highFar,far,grip,palms,face,
   duration:isVault?.66:1.02,elapsed:0,progress:0};
 }
 // A tall wall needs an actual vertical face in reach of both hands. Use
 // the first visible hit so a door, projection or opening interrupts contact.
 wallHit(feet,dir,height,offset=0){
  this.ray.origin.set(feet.x-dir.z*offset,feet.y+height,feet.z+dir.x*offset);
  this.ray.direction.copy(dir);
  const hit=this.surface.firstHit(this.ray,.78);
  if(!hit)return null;
  const mesh=hit.object,data=mesh.userData,label=[data.atlasPath,data.layer,mesh.name].join(' ');
  if(data.walkDoor||data.walkable===false||exclude.test(label)||railName.test(label)||
     !(wallName.test(label)||data.contextBuildingColor||!label.trim()))return null;
  const geometry=mesh.geometry,index=geometry.index;
  const vertex=(offset,out)=>{
   const i=3*hit.faceIndex+offset;
   return out.fromBufferAttribute(geometry.attributes.position,index?index.getX(i):i).applyMatrix4(mesh.matrixWorld);
  };
  const a=vertex(0,this.a),b=vertex(1,this.b),c=vertex(2,this.cross);
  const n=c.sub(a).cross(b.sub(a)).normalize();
  if(Math.abs(n.y)>.28)return null;
  n.y=0;n.normalize();
  if(n.dot(dir)<0)n.negate();
  return n.dot(dir)>=.40?{point:hit.point,inward:n.clone()}:null;
 }
 wallContact(feet,dir){
  const hit=this.wallHit(feet,dir,1.30);
  if(!hit)return null;
  const inward=hit.inward,palms=[];
  for(const side of [-.17,.17]){
   const hand=this.wallHit(feet,inward,1.36,side);
   if(!hand||hand.inward.dot(inward)<.83||Math.abs(this.a.subVectors(hand.point,hit.point).dot(inward))>.15)return null;
   palms.push(hand.point);
  }
  return {inward,point:hit.point,palms};
 }
 begin(walker,action){
  this.action=action;this.wall=null;walker.boosted=false;walker.verticalSpeed=0;walker.grounded=false;
 }
 jump(walker,boosted,held){
  if(!walker.grounded||this.action||this.wall)return;
  this.jumped=true;this.cooldown=0;
  const dir=walker.moveDirection(held);
  if(!dir.lengthSq())dir.set(Math.sin(walker.yaw),0,-Math.cos(walker.yaw));
  if(!boosted){
   const action=this.plan(walker,dir,'vault')||this.plan(walker,dir,'climb');
   if(action){this.begin(walker,action);return;}
  }
  walker.jump(boosted,held);
 }
 startWall(walker,dir){
  const wall=this.wallContact(walker.feet,dir);
  if(!wall)return false;
  const target=wall.point.clone().addScaledVector(wall.inward,-.36).setY(walker.feet.y);
  if(!this.surface.canMove(walker.feet,target,radius,body,.03,walker.contactNormal)||
     !this.surface.canStand(target,radius,body))return false;
  walker.feet.copy(target);walker.grounded=false;walker.boosted=false;walker.verticalSpeed=0;
  this.wall={inward:wall.inward,palms:wall.palms,face:Math.atan2(wall.inward.x,-wall.inward.z),travel:0,probe:0};
  return true;
 }
 ascend(walker,dt,held){
  const w=this.wall,feet=walker.feet,dir=w.inward,move=walker.moveDirection(held);
  const up=move.dot(dir)>.28||(!move.lengthSq()&&held.has('Space'));
  if(up){
   w.probe-=dt;
   if(w.probe<=0){
    w.probe=.09;
    const action=this.plan(walker,dir,'climb')||this.plan(walker,dir,'rail-climb');
    if(action){this.begin(walker,action);return this.advance(walker,dt);}
    const contact=this.wallContact(feet,dir);
    if(contact)w.palms=contact.palms;else this.wall=null;
   }
   if(this.wall){
    const dy=1.65*dt,top=feet.y+body;
    if(this.surface.ceilingAt(feet.x,feet.z,top-.015,top+dy+.015,radius)===null){
     feet.y+=dy;w.travel+=dy;return true;
    }
    // Hold against a solid soffit until the visitor releases the climb.
    return false;
   }
  }
  this.wall=null;this.jumped=false;this.cooldown=.15;
  return walker.step(dt,held);
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
  if(this.wall)return this.ascend(walker,dt,held);
  this.cooldown=Math.max(0,this.cooldown-dt);
  if(walker.grounded)this.jumped=false;
  const direction=walker.moveDirection(held),moving=direction.lengthSq()>.5;
  if(!direction.lengthSq()&&walker.boosted)direction.copy(walker.launch);
  if(!direction.lengthSq()&&this.jumped)direction.set(Math.sin(walker.yaw),0,-Math.cos(walker.yaw));
  if(this.cooldown===0&&direction.lengthSq()>.5&&(walker.grounded||this.jumped)){
   this.cooldown=walker.grounded?.085:.055;
   const action=walker.grounded?this.plan(walker,direction,'vault'):
    this.plan(walker,direction,'climb')||this.plan(walker,direction,'rail-climb');
   if(action){this.begin(walker,action);return this.advance(walker,dt);}
   // Let the existing super jump reach its apex before engaging a tall wall.
   if(this.jumped&&(!walker.boosted||walker.verticalSpeed<=0)&&
      (held.has('Space')||moving)&&
      this.startWall(walker,direction))return true;
  }
  return walker.step(dt,held);
 }
}
