import {Vector3,Raycaster,MathUtils} from './lib/three.module.min.js';
import {WalkSurfaces} from './walk-surfaces.js?v=b466ffcb39';

const EYE=1.62, BODY=1.78, RADIUS=.22, STEP=.26;
const keys=new Set(['KeyW','KeyA','KeyS','KeyD','KeyQ','KeyE','ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Space','ShiftLeft','ShiftRight','KeyF']);
const UP=new Vector3(0,1,0);

export class Walker {
 constructor(surface,point,direction){
  this.surface=surface;this.feet=point.clone();this.next=new Vector3();
  this.yaw=direction.x*direction.x+direction.z*direction.z>1e-5?Math.atan2(direction.x,-direction.z):0;
  this.pitch=0;this.grounded=true;this.verticalSpeed=0;
 }
 look(dx,dy){
  this.yaw+=dx;this.pitch=MathUtils.clamp(this.pitch+dy,-1.47,1.47);
 }
 direction(out){
  const p=Math.cos(this.pitch);
  return out.set(Math.sin(this.yaw)*p,Math.sin(this.pitch),-Math.cos(this.yaw)*p);
 }
 jump(){
  if(!this.grounded)return;
  this.grounded=false;this.verticalSpeed=4.4;
 }
 stepAcross(dx,dz){
  if(!dx&&!dz)return true;
  const feet=this.feet,s=this.surface,x=feet.x+dx,z=feet.z+dz;
  const floor=s.floorAt(x,z,-Infinity,feet.y+(this.grounded?STEP:.015));
  // The large backing plane below the site is only a shadow receiver.
  if(floor===null)return false;
  this.next.set(x,feet.y,z);
  if(this.grounded&&Math.abs(floor-feet.y)<=STEP)this.next.y=floor;
  if(!s.canMove(feet,this.next,RADIUS,BODY,this.grounded?STEP:.025))return false;
  if(this.next.y>feet.y&& !s.canStand(this.next,RADIUS,BODY))return false;
  if(this.grounded&&floor<feet.y-STEP)this.grounded=false;
  feet.copy(this.next);return true;
 }
 step(dt,held){
  const axis=(positive,negative)=>Number(positive)-Number(negative);
  const turn=axis(held.has('KeyE')||held.has('ArrowRight'),held.has('KeyQ')||held.has('ArrowLeft'));
  this.yaw+=turn*1.55*dt;
  const forward=axis(held.has('KeyW')||held.has('ArrowUp'),held.has('KeyS')||held.has('ArrowDown'));
  const right=axis(held.has('KeyD'),held.has('KeyA'));
  const pace=held.has('ShiftLeft')||held.has('ShiftRight')?4.8:2.15;
  const dist=pace*dt/Math.max(1,Math.hypot(forward,right));
  const dx=dist*(forward*Math.sin(this.yaw)+right*Math.cos(this.yaw));
  const dz=dist*(-forward*Math.cos(this.yaw)+right*Math.sin(this.yaw));
  const oldX=this.feet.x,oldY=this.feet.y,oldZ=this.feet.z;
  if(!this.stepAcross(dx,dz)&&dx&&dz){this.stepAcross(dx,0);this.stepAcross(0,dz);}
  if(!this.grounded){
   this.verticalSpeed-=10.5*dt;
   let nextY=this.feet.y+this.verticalSpeed*dt;
   if(this.verticalSpeed>0){
    const top=this.feet.y+BODY;
    const ceiling=this.surface.ceilingAt(this.feet.x,this.feet.z,top-.025,nextY+BODY+.025,RADIUS);
    if(ceiling!==null&&nextY+BODY>=ceiling-.015){
     nextY=Math.max(this.feet.y,ceiling-BODY-.015);this.verticalSpeed=0;
    }
   }else{
    const floor=this.surface.floorAt(this.feet.x,this.feet.z,-Infinity,this.feet.y+.025);
    if(floor!==null&&nextY<=floor){nextY=floor;this.verticalSpeed=0;this.grounded=true;}
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
  this.hud=this.area.querySelector('#walk-hud');
 }
 enter(ndc,touch=false){
  const v=this.v;if(this.active||!v.project)return false;
  v.camera.updateMatrixWorld();
  if(this.project!==v.project){
   this.project=v.project;this.doors=v.walkDoors;
   this.surfaces=new WalkSurfaces([v.project,v.city],{clearance:v.clearance,doors:this.doors});
  }
  this.ray.setFromCamera(ndc,v.camera);
  const hit=this.surfaces.pick(this.ray.ray);
  if(!hit)return false;
  this.walker=new Walker(this.surfaces,hit.point,v.camera.getWorldDirection(this.forward));
  this.saved={camera:v.camera,settings:v.perspectiveCamera.clone(),target:v.controls.target.clone(),
   context:v.contextView,navigated:v.userNavigated};
  this.active=true;this.area.dataset.walking='true';
  this.area.querySelector('#walk-help').hidden=true;this.hud.hidden=false;
  v.controls.enabled=false;v.userNavigated=true;v.contextView=null;
  v.camera=v.perspectiveCamera;v.camera.clearViewOffset();v.camera.fov=72;v.camera.zoom=1;
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
   e.preventDefault();if(!e.repeat)this.press(e.code);
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
 press(code){
  if(code==='KeyF'){this.useDoor();return;}
  if(code==='Space'){this.walker.jump();}else this.held.add(code);
  this.start();
 }
 start(){
  if(this.frame)return;
  this.previous=performance.now();
  const advance=now=>{
   this.frame=0;if(!this.active)return;
   let time=Math.min(.12,Math.max(0,(now-this.previous)*.001));this.previous=now;
   let moved=false;const doorDt=time;
   // Short steps keep the body on the correct side of thin slabs and walls.
   while(time>1e-7){const dt=Math.min(time,1/60);moved=this.walker.step(dt,this.held)||moved;time-=dt;}
   if(moved)this.pose();
   if(this.doors.moving&&this.doors.update(doorDt,this.v.camera.position)){this.v.refreshShadow();this.updateTarget();}
   if(this.doors.moving||!this.walker.grounded||[...this.held].some(key=>!key.startsWith('Shift')))
    this.frame=requestAnimationFrame(advance);
  };
  this.frame=requestAnimationFrame(advance);
 }
 look(dx,dy,pointerType='mouse'){
  if(!dx&&!dy)return;
  const radiansPerPixel=pointerType==='mouse' ? .00165 : .0022;
  this.walker.look(dx*radiansPerPixel,-dy*radiansPerPixel);this.pose();
 }
 pose(){
  const v=this.v,cam=v.camera;cam.position.copy(this.walker.feet).addScaledVector(UP,EYE);
  this.walker.direction(this.forward);v.controls.target.copy(cam.position).addScaledVector(this.forward,6);
  cam.lookAt(v.controls.target);cam.updateMatrixWorld();v.movingFrame=true;v.draw();
  this.updateTarget();
 }
 updateTarget(){
  const cam=this.v.camera;
  let target=this.doors.target(cam.position,this.forward);
  if(target){
   this.ray.ray.set(cam.position,this.forward);
   const hit=this.surfaces.firstHit(this.ray.ray,2.8);
   if(hit&&!hit.object.userData.walkDoor)target=this.doors.target(cam.position,this.forward,hit.distance+.015);
  }
  if(target!==this.door){
   this.door=target;
  }
  const hint=this.area.querySelector('#walk-door-hint');hint.hidden=!target;
  if(target){const text=target.open?'F · Close door':'F · Open door';if(hint.textContent!==text)hint.textContent=text;}
 }
 useDoor(){
  this.updateTarget();
  if(this.door&&this.doors.toggle(this.door,this.v.camera.position)!==false){
   this.v.refreshShadow();this.updateTarget();this.start();
  }
 }
 release(){
  this.exit();this.project=this.surfaces=this.doors=this.walker=this.saved=null;
 }
 exit(){
  if(!this.active)return;
  this.active=false;this.listeners.abort();this.wasLocked=false;this.drag=null;
  if(document.pointerLockElement===this.canvas)document.exitPointerLock();
  cancelAnimationFrame(this.frame);this.frame=0;this.held.clear();
  const v=this.v,s=this.saved;this.doors.reset();this.door=null;
  this.area.querySelector('#walk-door-hint').hidden=true;
  delete this.area.dataset.walking;this.hud.hidden=true;this.area.querySelector('#walk-help').hidden=false;
  v.perspectiveCamera.copy(s.settings,false);v.camera=s.camera;v.contextView=s.context;v.userNavigated=s.navigated;
  v.controls.object=v.camera;v.controls.target.copy(s.target);
  v.settingView=true;v.controls.enabled=true;v.controls.update();v.resize();v.settingView=false;
  v.clearance?.reset(v.camera.position,v.controls.target);v.refreshShadow();
 }
}
