import {Vector3,Ray,Group,Mesh,CircleGeometry,Float32BufferAttribute,MeshBasicMaterial,MathUtils} from './lib/three.module.min.js';
import {createStreetAvatar,strideLength} from './street-avatar.js?v=7fcd795d53';
import {enterStreetAtmosphere} from './street-atmosphere.js?v=b8acbb84d1';
import {StreetTraversal} from './street-traversal.js?v=18df453e06';

const up=new Vector3(0,1,0);

// Begin at eye level in an authored street/interior view, or at the market's
// Fourth Avenue approach when entering from an aerial or orthographic view.
export function streetSpawn(viewer,surfaces,ray){
 const eye=viewer.camera.position;
 const position=new Vector3(),direction=new Vector3();
 const ground=(x,z,min,max)=>{
  const y=surfaces.floorAt(x,z,min,max);
  if(y===null)return false;
  position.set(x,y,z);return surfaces.canStand(position);
 };
 if(viewer.camera.isPerspectiveCamera&&ground(eye.x,eye.z,eye.y-3.4,eye.y-.2)){
  viewer.camera.getWorldDirection(direction);
 }else if(viewer.cityURL==='./models/ann-arbor.glb'&&ground(-91,28.8,-1,3)){
  direction.set(viewer.overview?.52:.92,0,viewer.overview?.85:.34);
 }else{
  ray.setFromCamera({x:0,y:-.33},viewer.camera);
  const hit=surfaces.pick(ray.ray);
  if(hit)position.copy(hit.point);
  else{
   const b=viewer.projectBounds,c=viewer.center;
   if(!b||![0,.2,-.2,.38,-.38].some(i=>[0,.2,-.2].some(j=>ground(
    c.x+i*(b.max.x-b.min.x),c.z+j*(b.max.z-b.min.z),b.min.y-.1,b.max.y+.1))))return null;
  }
  viewer.camera.getWorldDirection(direction);
 }
 if(Math.hypot(direction.x,direction.z)<.06)direction.set(1,0,-.12);
 return {point:position,direction};
}

export class ChaseCamera {
 constructor(surface){
  this.surface=surface;this.ray=new Ray();this.target=new Vector3();this.arm=new Vector3();this.right=new Vector3();
 }
 update(walker,camera,target,dt,anchor=walker.feet){
  const {yaw}=walker;
  const pitch=MathUtils.clamp(walker.pitch,-.94,.75),sin=Math.sin(yaw),cos=Math.cos(yaw);
  this.target.copy(anchor).addScaledVector(up,1.31);
  const backPitch=.19-pitch;
  this.arm.set(-sin*Math.cos(backPitch),Math.sin(backPitch),cos*Math.cos(backPitch)).multiplyScalar(3.85);
  this.right.set(cos,0,sin);
  this.arm.addScaledVector(this.right,.32);
  const full=this.arm.length();this.arm.divideScalar(full);
  let clear=full;
  // Center plus two side rays keep the near plane out of walls at corners.
  for(const side of [0,-.13,.13]){
   this.ray.origin.copy(this.target).addScaledVector(this.right,side);this.ray.direction.copy(this.arm);
   const hit=this.surface.firstHit(this.ray,clear+.14);
   if(hit)clear=Math.min(clear,Math.max(.035,hit.distance-.15));
  }
  if(this.distance===undefined||clear<this.distance)this.distance=clear;
  else this.distance=MathUtils.lerp(this.distance,clear,1-Math.exp(-9*dt));
  this.settling=clear-this.distance>.012;
  camera.position.copy(this.target).addScaledVector(this.arm,this.distance);
  target.copy(this.target);target.x+=sin*.47;target.z-=cos*.47;target.y+=Math.sin(pitch)*.47;
  camera.lookAt(target);camera.updateMatrixWorld();
  return this.distance;
 }
}

export class StreetMode {
 constructor(viewer,walker){
  this.viewer=viewer;this.avatar=createStreetAvatar();
  this.surface=walker.surface;this.surface.streetContacts=viewer.activity?.contacts;
  this.traversal=new StreetTraversal(walker.surface);this.camera=new ChaseCamera(walker.surface);
  this.atmosphere=enterStreetAtmosphere(viewer);this.last=walker.feet.clone();this.gripLocal=new Vector3();this.palmsLocal=[new Vector3(),new Vector3()];this.contactRoot=new Vector3();this.gait=0;this.rotation=walker.yaw;
  this.root=new Group();this.root.add(this.avatar.root);
  const material=new MeshBasicMaterial({color:0x382c35,vertexColors:true,transparent:true,opacity:.32,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-1,polygonOffsetUnits:-1});
  const disk=new CircleGeometry(1,20),fade=new Float32Array(disk.attributes.position.count*4).fill(1);
  for(let i=1;i<disk.attributes.position.count;i++)fade[4*i+3]=0;
  disk.setAttribute('color',new Float32BufferAttribute(fade,4));
  disk.userData.contactShadow=true;
  this.contact=new Mesh(disk,material);
  this.contact.scale.set(.30,.22,1);this.contact.rotation.x=-Math.PI/2;
  this.root.add(this.contact);viewer.scene.add(this.root);
 }
 jump(walker,boosted,held){this.traversal.jump(walker,boosted,held);}
 step(walker,dt,held){return this.traversal.step(walker,dt,held);}
 present(walker,cam,target,dt){
  const dx=walker.feet.x-this.last.x,dz=walker.feet.z-this.last.z;
  const distance=Math.hypot(dx,dz),action=this.traversal.action,wall=this.traversal.wall;
  const speed=Math.min(7,distance/Math.max(dt,1e-4));
  const motion=walker.grounded&&!action&&!wall?speed:0;
  this.visualSpeed=MathUtils.lerp(this.visualSpeed??0,motion,1-Math.exp(-11*dt));
  this.poseTime=(this.poseTime??0)+dt;
  if(walker.grounded)this.gait+=distance*2*Math.PI/strideLength(speed);
  this.impact=(this.impact??0)*Math.exp(-10*dt);
  if(walker.grounded&&this.wasAirborne)this.impact=MathUtils.clamp(-(this.lastFall??0)/6,0,1);
  this.wasAirborne=!walker.grounded;this.lastFall=walker.verticalSpeed;
  const face=action?action.face:wall?wall.face:distance>.001?Math.atan2(dx,-dz):this.rotation;
  const delta=Math.atan2(Math.sin(face-this.rotation),Math.cos(face-this.rotation));
  this.rotation+=delta*(action||wall?1:(1-Math.exp(-18*dt)));
  this.avatar.root.position.copy(walker.feet);this.avatar.root.rotation.y=-this.rotation;
  // During the planted phase the palm stays on the measured world edge.
  // Feet used for collision stay on their swept path as the animated knees tuck.
  if(action){
   const vault=action.type==='vault',p=action.progress;
   const start=vault?.22:.18,end=vault?.52:.64;
   const reach=MathUtils.smoothstep(p,start,end);
   const weight=MathUtils.smoothstep(p,vault?.07:.045,start)*(1-MathUtils.smoothstep(p,end,vault?.77:.91));
   const depth=MathUtils.lerp(vault?.50:.47,vault?.19:.28,reach);
   const height=MathUtils.lerp(vault?1.06:1.49,vault?.90:.99,reach);
   this.contactRoot.set(-Math.sin(action.face)*depth,-height,Math.cos(action.face)*depth).add(action.grip);
   if(vault)this.contactRoot.y=Math.max(action.from.y-.20,this.contactRoot.y);
   this.avatar.root.position.lerp(this.contactRoot,weight);
   this.gripLocal.subVectors(action.grip,this.avatar.root.position).applyAxisAngle(up,this.rotation);
   if(action.palms)action.palms.forEach((hand,i)=>this.palmsLocal[i].subVectors(hand,this.avatar.root.position).applyAxisAngle(up,this.rotation));
  }else if(wall){
   // Hold one palm at a fixed world height while the other reaches up.
   wall.palms.forEach((point,i)=>{
    const phase=(wall.travel/.48+i*.5)%1;
    this.palmsLocal[i].copy(point).setY(walker.feet.y+1.59-.48*phase+.48*MathUtils.smoothstep(phase,.5,1))
     .sub(this.avatar.root.position).applyAxisAngle(up,this.rotation);
   });
  }
  this.avatar.pose({grip:action?this.gripLocal:null,palms:wall||action?.palms?this.palmsLocal:null,gait:this.gait,speed:this.visualSpeed,time:this.poseTime,turn:MathUtils.clamp(delta,-1,1),look:walker.pitch,impact:this.impact,grounded:walker.grounded,verticalSpeed:walker.verticalSpeed,
   action:wall?'wall':action?.type??null,progress:wall?wall.travel:action?.progress??0});
  this.last.copy(walker.feet);
  this.contact.position.copy(walker.feet);this.contact.position.y+=.018;
  this.contact.visible=walker.grounded;
  this.avatar.root.visible=this.camera.update(walker,cam,target,dt,this.avatar.root.position)>.44;
  this.needsFrame=this.camera.settling||(walker.grounded&&(speed>.03||this.visualSpeed>.018||this.impact>.01));
 }
 dispose(){
  this.surface.streetContacts=null;
  this.root.removeFromParent();this.avatar.dispose();this.contact.geometry.dispose();this.contact.material.dispose();this.atmosphere.dispose();
 }
}
