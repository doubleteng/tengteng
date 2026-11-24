import {Vector3,Raycaster,MathUtils} from './lib/three.module.min.js';
import {WalkSurfaces} from './walk-surfaces.js?v=992a1d3cd2';

const EYE=1.62, BODY=1.78, RADIUS=.22, STEP=.26;
const GRAVITY=10.5, JUMP_SPEED=4.4, SUPER_LIFT=13, SUPER_TRAVEL=6.6;
const keys=new Set(['KeyW','KeyA','KeyS','KeyD','KeyQ','KeyE','ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Space','ShiftLeft','ShiftRight','KeyF']);
const UP=new Vector3(0,1,0);

export class Walker {
 constructor(surface,point,direction){
  this.surface=surface;this.feet=point.clone();this.next=new Vector3();this.contactNormal=new Vector3();
  this.yaw=direction.x*direction.x+direction.z*direction.z>1e-5?Math.atan2(direction.x,-direction.z):0;
  this.pitch=0;this.grounded=true;this.verticalSpeed=0;
  this.motion=new Vector3();this.launch=new Vector3();this.takeoff=point.clone();this.boosted=false;
 }
 look(dx,dy){
  this.yaw+=dx;this.pitch=MathUtils.clamp(this.pitch+dy,-1.47,1.47);
 }
 direction(out){
  const p=Math.cos(this.pitch);
  return out.set(Math.sin(this.yaw)*p,Math.sin(this.pitch),-Math.cos(this.yaw)*p);
 }
 moveDirection(held){
  const forward=Number(held.has('KeyW')||held.has('ArrowUp'))-Number(held.has('KeyS')||held.has('ArrowDown'));
  const right=Number(held.has('KeyD'))-Number(held.has('KeyA'));
  const sin=Math.sin(this.yaw),cos=Math.cos(this.yaw);
  return this.motion.set(forward*sin+right*cos,0,-forward*cos+right*sin).normalize();
 }
 jump(boosted=false,held){
  if(!this.grounded)return;
  this.grounded=false;this.boosted=boosted;this.verticalSpeed=boosted?SUPER_LIFT:JUMP_SPEED;
  if(boosted){
   this.takeoff.copy(this.feet);
   if(held)this.launch.copy(this.moveDirection(held));else this.launch.set(0,0,0);
   if(this.launch.lengthSq()===0)this.launch.set(Math.sin(this.yaw),0,-Math.cos(this.yaw));
  }
 }
 stepAcross(dx,dz){
  if(!dx&&!dz)return true;
  this.contactNormal.set(0,0,0);
  const feet=this.feet,s=this.surface,x=feet.x+dx,z=feet.z+dz;
  const ceiling=feet.y+(this.grounded?STEP:.015);
  let floor=null;
  if(!this.boosted){
   if(this.grounded){
    floor=s.floorAt(x,z,feet.y-STEP,ceiling,true);
    if(floor===null)floor=s.rimFloorAt(x,z,feet.y-STEP,feet.y+.012,RADIUS);
   }
   if(floor===null)floor=s.floorAt(x,z,-Infinity,ceiling,true);
   if(floor===null)return false;
  }
  this.next.set(x,feet.y,z);
  if(this.grounded&&Math.abs(floor-feet.y)<=STEP)this.next.y=floor;
  if(!s.canMove(feet,this.next,RADIUS,BODY,this.grounded?STEP:.025,this.contactNormal))return false;
  // Stepping up must not create a fresh overlap under a low soffit.
  if(this.next.y>feet.y&&!s.canStand(this.next,RADIUS,BODY)&&s.canStand(feet,RADIUS,BODY))return false;
  if(this.grounded&&floor<feet.y-STEP)this.grounded=false;
  feet.copy(this.next);return true;
 }
 step(dt,held){
  const axis=(positive,negative)=>Number(positive)-Number(negative);
  const turn=axis(held.has('KeyE')||held.has('ArrowRight'),held.has('KeyQ')||held.has('ArrowLeft'));
  this.yaw+=turn*1.55*dt;
  let heading=this.moveDirection(held),pace=held.has('ShiftLeft')||held.has('ShiftRight')?4.8:2.15;
  if(this.boosted){
   // Releasing the chord preserves takeoff momentum. Movement keys steer it.
   if(heading.lengthSq()>0)this.launch.copy(heading);
   heading=this.launch;pace=SUPER_TRAVEL;
  }
  const dx=heading.x*pace*dt,dz=heading.z*pace*dt;
  const oldX=this.feet.x,oldY=this.feet.y,oldZ=this.feet.z;
  if(!this.stepAcross(dx,dz)){
   // Slide on the actual wall tangent, including walls oblique to the site grid.
   const n=this.contactNormal,inward=dx*n.x+dz*n.z;
   const sx=dx-inward*n.x,sz=dz-inward*n.z;
   const slid=inward<0&&sx*sx+sz*sz>1e-12&&this.stepAcross(sx,sz);
   if(!slid&&dx&&dz){this.stepAcross(dx,0);this.stepAcross(0,dz);}
  }
  if(!this.grounded){
   this.verticalSpeed-=GRAVITY*dt;
   let nextY=this.feet.y+this.verticalSpeed*dt;
   if(this.verticalSpeed>0){
    const top=this.feet.y+BODY;
    const ceiling=this.surface.ceilingAt(this.feet.x,this.feet.z,top-.025,nextY+BODY+.025,RADIUS);
    if(ceiling!==null&&nextY+BODY>=ceiling-.015){
     nextY=Math.max(this.feet.y,ceiling-BODY-.015);this.verticalSpeed=0;
    }
   }else{
    const floor=this.surface.floorAt(this.feet.x,this.feet.z,nextY-.025,this.feet.y+.025,true);
    if(floor!==null&&nextY<=floor){
     nextY=floor;this.verticalSpeed=0;this.grounded=true;this.boosted=false;
    }else if(this.boosted&&nextY<this.surface.lowestSupport-STEP){
     // A launch can cross empty space between modeled surfaces. Recover only
     // after falling below the entire navigable model with no landing.
     this.feet.copy(this.takeoff);nextY=this.feet.y;
     this.verticalSpeed=0;this.grounded=true;this.boosted=false;
    }
   }
   this.feet.y=nextY;
  }
  return !!turn||this.feet.x!==oldX||this.feet.y!==oldY||this.feet.z!==oldZ;
 }
}

export class WalkMode {
 constructor(viewer){
  this.v=viewer;this.canvas=viewer.renderer.domElement;this.area=viewer.host.parentElement;
  this.held=new Set();this.forward=new Vector3();this.ray=new Raycaster();
  this.hud=this.area.querySelector('#walk-hud');this.hint=this.area.querySelector('#walk-door-hint');
 }
 enter(ndc,touch=false,streetModule=null){
  const v=this.v;if(this.active||!v.project)return false;
  v.camera.updateMatrixWorld();
  if(this.project!==v.project){
   this.project=v.project;this.doors=v.walkDoors;
   this.surfaces=new WalkSurfaces([v.project,v.city],{clearance:v.clearance,doors:this.doors});
  }
  let hit;
  if(streetModule)hit=streetModule.streetSpawn(v,this.surfaces,this.ray);
  else{
   this.ray.setFromCamera(ndc,v.camera);
   hit=this.surfaces.pick(this.ray.ray);
  }
  if(!hit)return false;
  this.walker=new Walker(this.surfaces,hit.point,hit.direction||v.camera.getWorldDirection(this.forward));
  this.saved={camera:v.camera,settings:v.perspectiveCamera.clone(),target:v.controls.target.clone(),
   context:v.contextView,navigated:v.userNavigated};
  this.street=streetModule?new streetModule.StreetMode(v,this.walker):null;
  this.active=true;this.area.dataset.walking=this.street?'street':'first';
  this.area.querySelector('#walk-help').hidden=true;this.hud.hidden=false;
  v.controls.enabled=false;v.userNavigated=true;v.contextView=null;
  v.camera=v.perspectiveCamera;v.camera.clearViewOffset();v.camera.fov=this.street?57:72;v.camera.zoom=1;
  v.camera.updateProjectionMatrix();this.attach();this.pose();
  this.area.focus({preventScroll:true});
  if(!touch)this.capture();
  return true;
 }
 capture(){
  try {
   const request=this.canvas.requestPointerLock?.();
   request?.then(()=>{if(!this.active&&document.pointerLockElement===this.canvas)document.exitPointerLock();}).catch(()=>{});
  }catch{}
 }
 attach(){
  const signal=(this.listeners=new AbortController()).signal;
  const on=(el,type,fn)=>el.addEventListener(type,fn,{signal});
  on(document,'pointerlockchange',()=>{
   if(document.pointerLockElement===this.canvas)this.wasLocked=true;
   else if(this.wasLocked)this.exit();
  });
  on(document,'mousemove',e=>{
   if(document.pointerLockElement===this.canvas)this.look(e.movementX,e.movementY);
  });
  on(this.canvas,'pointerdown',e=>{
   if(e.button!==0||document.pointerLockElement===this.canvas)return;
   this.drag={id:e.pointerId,x:e.clientX,y:e.clientY};this.canvas.setPointerCapture?.(e.pointerId);
   this.area.focus({preventScroll:true});
  });
  on(this.canvas,'pointermove',e=>{
   if(!this.drag||e.pointerId!==this.drag.id||document.pointerLockElement===this.canvas)return;
   this.look(e.clientX-this.drag.x,e.clientY-this.drag.y,e.pointerType);this.drag.x=e.clientX;this.drag.y=e.clientY;
  });
  on(this.canvas,'pointerup',()=>{this.drag=null;});
  on(this.canvas,'pointercancel',()=>{this.drag=null;});
  on(document,'keydown',e=>{
   if(e.code==='Escape'){e.preventDefault();this.exit();return;}
   if(e.target!==this.area&&e.target!==this.canvas&&document.pointerLockElement!==this.canvas)return;
   if(!keys.has(e.code)||e.altKey||e.metaKey||e.ctrlKey)return;
   e.preventDefault();if(!e.repeat)this.press(e.code,e.shiftKey);
  });
  on(document,'keyup',e=>{if(this.held.delete(e.code))e.preventDefault();});
  on(this.area,'focusout',e=>{
   if(e.relatedTarget&&!this.area.contains(e.relatedTarget))this.exit();
   else this.held.clear();
  });
  on(window,'blur',()=>this.exit());
  on(document,'visibilitychange',()=>{if(document.hidden)this.exit();});
  on(this.hud,'pointerdown',e=>{
   const key=e.target.closest('[data-walk-key]')?.dataset.walkKey;
   if(!key)return;e.preventDefault();e.target.setPointerCapture(e.pointerId);this.press(key);
  });
  const release=e=>{const key=e.target.closest('[data-walk-key]')?.dataset.walkKey;if(key)this.held.delete(key);};
  on(this.hud,'pointerup',release);on(this.hud,'pointercancel',release);
  on(this.area.querySelector('#walk-exit'),'click',()=>this.exit());
 }
 press(code,shiftKey=false){
  if(code==='KeyF'){this.useDoor();return;}
  if(code==='Space'){
   if(this.walker.grounded)this.queuedJump=shiftKey||this.held.has('ShiftLeft')||this.held.has('ShiftRight')?'super':'normal';
  }else{
   this.held.add(code);
   if(this.queuedJump&&(code==='ShiftLeft'||code==='ShiftRight'))this.queuedJump='super';
  }
  this.start();
 }
 start(){
  if(this.frame)return;
  this.previous=performance.now();
  const advance=now=>{
   this.frame=0;if(!this.active)return;
   let time=Math.min(.12,Math.max(0,(now-this.previous)*.001));this.previous=now;
   if(this.queuedJump){
    this.street?.jump(this.walker);this.walker.jump(this.queuedJump==='super',this.held);this.queuedJump=null;
   }
   let moved=false;const doorDt=time;
   // Short steps keep the body on the correct side of thin slabs and walls.
   while(time>1e-7){const dt=Math.min(time,1/60);moved=(this.street?this.street.step(this.walker,dt,this.held):this.walker.step(dt,this.held))||moved;time-=dt;}
   const poseChanged=moved||this.lookPending||this.street?.needsFrame;
   if(poseChanged)this.syncCamera(doorDt);
   const wasMoving=this.doors.moving;
   const doorChanged=wasMoving&&this.doors.update(doorDt,this.interactionOrigin());
   if(wasMoving&&(now>=this.nextShadow||!this.doors.moving)){
    this.v.renderer.shadowMap.needsUpdate=true;this.nextShadow=now+90;
   }
   if(poseChanged||doorChanged||wasMoving){
    this.updateTarget();this.v.movingFrame=true;this.v.drawNow(now);
   }
   if(this.doors.moving||this.street?.needsFrame||!this.walker.grounded||[...this.held].some(key=>!key.startsWith('Shift')))
    this.frame=requestAnimationFrame(advance);
  };
  this.frame=requestAnimationFrame(advance);
 }
 look(dx,dy,pointerType='mouse'){
  if(!dx&&!dy)return;
  const radiansPerPixel=pointerType==='mouse' ? .00165 : .0022;
  this.walker.look(dx*radiansPerPixel,-dy*radiansPerPixel);this.lookPending=true;this.start();
 }
 syncCamera(dt=1/60){
  this.lookPending=false;
  const v=this.v,cam=v.camera;
  if(this.street){
   this.walker.direction(this.forward);
   this.street.present(this.walker,cam,v.controls.target,dt);return;
  }
  cam.position.copy(this.walker.feet).addScaledVector(UP,EYE);
  this.walker.direction(this.forward);v.controls.target.copy(cam.position).addScaledVector(this.forward,6);
  cam.lookAt(v.controls.target);cam.updateMatrixWorld();
 }
 pose(){
  this.syncCamera();this.updateTarget();this.v.movingFrame=true;this.v.draw();
 }
 interactionOrigin(){
  if(!this.street)return this.v.camera.position;
  this.eye??=new Vector3();return this.eye.copy(this.walker.feet).addScaledVector(UP,EYE);
 }
 updateTarget(){
  const origin=this.interactionOrigin();
  let target=this.doors.target(origin,this.forward);
  if(target){
   this.ray.ray.set(origin,this.forward);
   const hit=this.surfaces.firstHit(this.ray.ray,2.8);
   if(hit&&!hit.object.userData.walkDoor)target=this.doors.target(origin,this.forward,hit.distance+.015);
  }
  if(target!==this.door){
   this.door=target;
  }
  const hint=this.hint;if(hint.hidden!==!target)hint.hidden=!target;
  if(target){const text=target.open?'F · Close door':'F · Open door';if(hint.textContent!==text)hint.textContent=text;}
 }
 useDoor(){
  if(this.street?.traversal.action)return;
  if(this.lookPending)this.pose();
  this.updateTarget();
  if(this.door&&this.doors.toggle(this.door,this.interactionOrigin())!==false){
   this.nextShadow=0;this.updateTarget();this.start();
  }
 }
 release(){
  this.exit();this.project=this.surfaces=this.doors=this.walker=this.saved=null;
 }
 exit(){
  if(!this.active)return;
  this.active=false;this.lookPending=false;this.queuedJump=null;this.listeners.abort();this.wasLocked=false;this.drag=null;
  if(document.pointerLockElement===this.canvas)document.exitPointerLock();
  cancelAnimationFrame(this.frame);this.frame=0;this.held.clear();
  const v=this.v,s=this.saved;const street=this.street;this.street=null;street?.dispose();this.doors.reset();this.door=null;
  this.area.querySelector('#walk-door-hint').hidden=true;
  delete this.area.dataset.walking;this.hud.hidden=true;this.area.querySelector('#walk-help').hidden=false;
  v.perspectiveCamera.copy(s.settings,false);v.camera=s.camera;v.contextView=s.context;v.userNavigated=s.navigated;
  v.controls.object=v.camera;v.controls.target.copy(s.target);
  v.settingView=true;v.controls.enabled=true;v.controls.update();v.resize();v.settingView=false;
  v.clearance?.reset(v.camera.position,v.controls.target);v.refreshShadow();
 }
}
