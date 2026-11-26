import {Vector3,Raycaster,MathUtils} from './lib/three.module.min.js';
import {randomLook} from './visitor-look.js?v=850b7c0e56';
import {VisitorPresence} from './visitor-presence.js?v=f490dfb97e';
import {WalkSurfaces} from './walk-surfaces.js?v=e4d41e4566';

const EYE=1.62, BODY=1.78, RADIUS=.22, STEP=.26;
const GRAVITY=10.5, JUMP_SPEED=4.4, SUPER_LIFT=13, SUPER_TRAVEL=6.6;
const keys=new Set(['KeyW','KeyA','KeyS','KeyD','KeyQ','KeyE','ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Space','ShiftLeft','ShiftRight','KeyF','KeyG']);
const UP=new Vector3(0,1,0);

export class Walker {
 constructor(surface,point,direction){
  this.surface=surface;this.feet=point.clone();this.next=new Vector3();this.contactNormal=new Vector3();
  this.yaw=direction.x*direction.x+direction.z*direction.z>1e-5?Math.atan2(direction.x,-direction.z):0;
  this.pitch=0;this.grounded=true;this.verticalSpeed=0;
  this.motion=new Vector3();this.launch=new Vector3();this.takeoff=point.clone();this.boosted=false;
  this.lastSupport=point.clone();
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
 supportAt(x,z,minY,maxY){
  // The center gives the tread elevation on slopes. At a seam, use the same
  // foot disk for walking and for the entire downward sweep of a landing.
  return this.surface.floorAt(x,z,minY,maxY,true)??this.surface.rimFloorAt(x,z,minY,maxY,RADIUS);
 }
 land(point){
  this.feet.copy(point);this.lastSupport.copy(point);
  this.verticalSpeed=0;this.grounded=true;this.boosted=false;
 }
 stepAcross(dx,dz){
  if(!dx&&!dz)return true;
  this.contactNormal.set(0,0,0);
  const feet=this.feet,s=this.surface,x=feet.x+dx,z=feet.z+dz;
  this.next.set(x,feet.y,z);
  let floor=null;
  if(this.grounded){
   floor=this.supportAt(x,z,feet.y-STEP,feet.y+STEP);
   if(floor!==null)this.next.y=floor;
   // Leave an actual ledge over a lower level. At the unmodeled perimeter,
   // walking stops at the edge; a jump can still cross the intervening air.
   else if(s.floorAt(x,z,-Infinity,feet.y-STEP,true)===null)return false;
  }
  if(!s.canMove(feet,this.next,RADIUS,BODY,this.grounded?STEP:.025,this.contactNormal))return false;
  // Stepping up must not create a fresh overlap under a low soffit.
  if(this.next.y>feet.y&&!s.canStand(this.next,RADIUS,BODY)&&s.canStand(feet,RADIUS,BODY))return false;
  if(floor===null)this.grounded=false;
  feet.copy(this.next);
  if(this.grounded)this.lastSupport.copy(feet);
  return true;
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
    const floor=this.supportAt(this.feet.x,this.feet.z,nextY-.025,this.feet.y+.025);
    if(floor!==null&&nextY<=floor){
     this.land(this.next.copy(this.feet).setY(floor));nextY=floor;
    }else if(nextY<this.surface.lowestSupport-STEP){
     // All real lower landings have been tested. Also recover a missed
     // ordinary jump or a released climbing grip outside the modeled world.
     this.land(this.boosted?this.takeoff:this.lastSupport);nextY=this.feet.y;
    }
   }
   this.feet.y=nextY;
  }
  return !!turn||this.feet.x!==oldX||this.feet.y!==oldY||this.feet.z!==oldZ;
 }
}

export class WalkMode {
 constructor(viewer){
  this.v=viewer;viewer.visitorLook??=randomLook();this.canvas=viewer.renderer.domElement;this.area=viewer.host.parentElement;
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
   hit=this.surfaces.pick(this.ray.ray,v.sectionPlane);
  }
  if(!hit)return false;
  this.walker=new Walker(this.surfaces,hit.point,hit.direction||v.camera.getWorldDirection(this.forward));
  this.saved={camera:v.camera,settings:v.perspectiveCamera.clone(),target:v.controls.target.clone(),
   context:v.contextView,navigated:v.userNavigated,section:v.sectionSettings};
  v.setSection('off');
  this.street=streetModule?new streetModule.StreetMode(v,this.walker):null;
  this.active=true;this.area.dataset.walking=this.street?'street':'first';
  this.area.querySelector('#walk-help').hidden=true;this.hud.hidden=false;
  v.controls.enabled=false;v.userNavigated=true;v.contextView=null;
  v.camera=v.perspectiveCamera;v.camera.clearViewOffset();v.camera.fov=this.street?57:72;v.camera.zoom=1;
  v.camera.updateProjectionMatrix();this.attach();this.pose();
  if(v.visitorRoomKey){this.presence=new VisitorPresence(this,v.visitorRoomKey);this.presence.start();}
  this.area.focus({preventScroll:true});
  if(!touch)this.capture();
  return true;
 }
 async enterStreetHere(){
  if(!this.active||this.street)return;
  const walker=this.walker,notice=this.area.querySelector('#walk-mode-status');
  notice.hidden=true;
  try{
   const {StreetMode}=await this.v.loadStreetMode();
   if(!this.active||this.walker!==walker||this.street)return;
   this.street=new StreetMode(this.v,walker);
   this.area.dataset.walking='street';
   this.v.camera.fov=57;this.v.camera.updateProjectionMatrix();
   this.area.focus({preventScroll:true});this.pose();this.start();
  }catch{
   if(this.active&&this.walker===walker&&!this.street){
    notice.textContent='GTA mode could not load. Press G to retry.';notice.hidden=false;
   }
  }
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
  on(this.area.querySelector('#walk-gta'),'click',()=>this.enterStreetHere());
 }
 press(code,shiftKey=false){
  if(code==='KeyG'){this.enterStreetHere();return;}
  if(code==='KeyF'){this.useDoor();return;}
  if(code==='Space'){
   this.held.add(code);
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
    if(this.street)this.street.jump(this.walker,this.queuedJump==='super',this.held);
    else this.walker.jump(this.queuedJump==='super',this.held);
    this.queuedJump=null;
   }
   let moved=false;const doorDt=time;
   // Short steps keep the body on the correct side of thin slabs and walls.
   while(time>1e-7){const dt=Math.min(time,1/60);moved=(this.street?this.street.step(this.walker,dt,this.held):this.walker.step(dt,this.held))||moved;time-=dt;}
   const poseChanged=moved||this.lookPending||this.street?.needsFrame;
   if(poseChanged)this.syncCamera(doorDt);
   const wasMoving=this.doors.moving;
   const doorChanged=wasMoving&&this.doors.update(doorDt,this.interactionOrigin());
   if(wasMoving&&(now>=this.nextShadow||!this.doors.moving)){
    const renderer=this.v.renderer;
    renderer.shadowMap.needsUpdate=true;
    // Slow devices can reuse the preceding map during the swing. Always
    // refresh the final pose so the doorway and its shadow agree at rest.
    this.nextShadow=now+Math.min(350,Math.max(90,2*(renderer.lastFrameMs||this.v.motionFrameMs||0)));
   }
   if(poseChanged||doorChanged||wasMoving){
    // Keep aim feedback responsive. Pressing F always performs an immediate exact query.
    if(doorChanged||now>=(this.nextAimCheck||0)){
     this.updateTarget();this.nextAimCheck=now+75;
    }
    this.v.movingFrame=true;this.v.drawNow(now);
   }
   if(this.doors.moving||this.street?.needsFrame||!this.walker.grounded||[...this.held].some(key=>key!=='Space'&&!key.startsWith('Shift')))
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
  if(this.street&&(this.street.traversal.action||this.street.traversal.wall))return;
  if(this.lookPending)this.pose();
  this.updateTarget();
  if(this.door&&this.doors.toggle(this.door,this.interactionOrigin())!==false){
   this.nextShadow=0;this.updateTarget();this.start();
  }
 }
 release(){
  this.exit(false);this.project=this.surfaces=this.doors=this.walker=this.saved=null;
 }
 exit(restoreSection=true){
  if(!this.active)return;
  this.active=false;this.presence?.stop();this.presence=null;this.lookPending=false;this.queuedJump=null;this.listeners.abort();this.wasLocked=false;this.drag=null;
  if(document.pointerLockElement===this.canvas)document.exitPointerLock();
  cancelAnimationFrame(this.frame);this.frame=0;this.held.clear();
  const v=this.v,s=this.saved;const street=this.street;this.street=null;street?.dispose();this.doors.reset();this.door=null;
  this.area.querySelector('#walk-door-hint').hidden=true;this.area.querySelector('#walk-mode-status').hidden=true;
  delete this.area.dataset.walking;this.hud.hidden=true;this.area.querySelector('#walk-help').hidden=false;
  v.perspectiveCamera.copy(s.settings,false);v.camera=s.camera;v.contextView=s.context;v.userNavigated=s.navigated;
  v.controls.object=v.camera;v.controls.target.copy(s.target);
  v.settingView=true;v.controls.enabled=true;v.controls.update();v.resize();v.settingView=false;
  v.clearance?.reset(v.camera.position,v.controls.target);
  if(restoreSection&&s.section)v.setSection(s.section.axis,s.section.position,s.section.side);
  v.refreshShadow();
 }
}
