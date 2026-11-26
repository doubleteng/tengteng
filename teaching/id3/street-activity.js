import {Frustum,Matrix4,Sphere} from './lib/three.module.min.js';
import {createActivityModels} from './street-activity-models.js?v=ebe52d772b';
import {vehicleRoutes,pedestrianRoutes} from './street-activity-routes.js?v=484d0f8e86';
import {StreetContacts} from './street-contacts.js?v=b6145ceb42';

const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const wrap=(d,length)=>((d%length)+length)%length;
class Route {
 constructor({points,closed}){
  this.closed=closed;this.legs=[];let distance=0;
  for(let i=0;i<points.length-(closed?0:1);i++){
   const a=points[i],b=points[(i+1)%points.length];
   const dx=b[0]-a[0],dy=b[1]-a[1],dz=b[2]-a[2],length=Math.hypot(dx,dz);
   if(length<.001)continue;
   this.legs.push({x:a[0],y:a[1],z:a[2],dx:dx/length,dy:dy/length,dz:dz/length,start:distance});
   distance+=length;
  }
  this.length=distance;
 }
 sample(d,out){
  d=this.closed?wrap(d,this.length):clamp(d,0,this.length);
  let lo=0,hi=this.legs.length;
  while(lo+1<hi){const mid=(lo+hi)>>1;if(this.legs[mid].start<=d)lo=mid;else hi=mid;}
  const leg=this.legs[lo],t=d-leg.start;
  out.x=leg.x+leg.dx*t;out.y=leg.y+leg.dy*t;out.z=leg.z+leg.dz*t;
 }
}
function populate(routes,count,vehicle,random){
 const paths=routes.map(r=>new Route(r)).filter(p=>p.length>5);
 const slots=paths.map(()=>0);
 for(let i=0;i<count&&paths.length;i++){
  let best=0;
  for(let j=1;j<paths.length;j++)if(paths[j].length/(slots[j]+1)>paths[best].length/(slots[best]+1))best=j;
  slots[best]++;
 }
 const result=[];
 paths.forEach((route,index)=>{
  const phase=random(),num=slots[index];
  for(let j=0;j<num;j++){
   const cruise=vehicle?4.1+random()*2.7:1.0+random()*.55;
   result.push({id:result.length,vehicle,route,distance:wrap((j+phase+(random()-.5)*.30)/num*route.length,route.length),
    direction:vehicle||random()>.5?1:-1,cruise,speed:cruise,phase:random()*Math.PI*2,yieldTime:0});
  }
 });
 return result;
}
const ahead={},behind={};
function place(body,dt=0){
 const {route,distance,direction}=body;
 route.sample(distance,body);
 const look=body.vehicle?1.35:.24;
 route.sample(distance+look*direction,ahead);route.sample(distance-look*direction,behind);
 body.heading=Math.atan2(ahead.x-behind.x,ahead.z-behind.z);
 body.sin=Math.sin(body.heading);body.cos=Math.cos(body.heading);
 if(!body.vehicle){
  // A modest right-hand walking line leaves room for people passing the other way.
  body.lateral??=.32*direction;
  body.lateral+=clamp(.32*direction-body.lateral,-dt*.4,dt*.4);
  body.x+=body.lateral*direction*body.cos;body.z-=body.lateral*direction*body.sin;
 }
}
function speedForGap(gap,braking){return Math.sqrt(2*braking*Math.max(0,gap));}
// Reserve crossing space where two recorded travel lanes intersect. Cars in
// parallel Fifth Avenue lanes can keep moving independently.
function laneCrossings(cars){
 const paths=[...new Set(cars.map(c=>c.route))],crossings=[];
 for(let i=0;i<paths.length;i++)for(let j=0;j<i;j++){
  const a=paths[i],b=paths[j];
  for(const [k,u] of a.legs.entries())for(const [n,v] of b.legs.entries()){
   const det=u.dx*v.dz-u.dz*v.dx;
   if(Math.abs(det)<.25)continue;
   const dx=v.x-u.x,dz=v.z-u.z,du=(dx*v.dz-dz*v.dx)/det,dv=(dx*u.dz-dz*u.dx)/det;
   if(du<0||dv<0||du>((a.legs[k+1]?.start??a.length)-u.start)||dv>((b.legs[n+1]?.start??b.length)-v.start))continue;
   if(Math.abs(u.y+du*u.dy-v.y-dv*v.dy)>1.2)continue;
   const da=u.start+du,db=v.start+dv;
   if(crossings.some(c=>Math.abs((c.distance.get(a)??Infinity)-da)<4))continue;
   crossings.push({distance:new Map([[a,da],[b,db]]),owner:null});
  }
 }
 return crossings;
}
function reserveCrossings(crossings,cars){
 for(const car of cars)car.stopAt=Infinity;
 for(const crossing of crossings){
  let first=null,nearest=Infinity,keep=false;
  for(const car of cars){
   const d=crossing.distance.get(car.route);
   if(d===undefined)continue;
   const left=wrap(d-car.distance+car.route.length*.5,car.route.length)-car.route.length*.5;
   if(left<-(car.length*.5+2)||left>19)continue;
   if(car===crossing.owner)keep=true;
   if(left<nearest){first=car;nearest=left;}
  }
  if(!keep)crossing.owner=first;
  if(!crossing.owner)continue;
  for(const car of cars){
   const d=crossing.distance.get(car.route);
   if(d===undefined||car.route===crossing.owner.route)continue;
   const left=wrap(d-car.distance,car.route.length);
   if(left<19)car.stopAt=Math.min(car.stopAt,Math.max(0,left-car.length*.5-2.6));
  }
 }
}
export class StreetPopulation {
 constructor(software=false,random=Math.random){
  this.people=populate(pedestrianRoutes,software?14:24,false,random);
  this.cars=populate(vehicleRoutes,software?6:10,true,random);
  this.models=createActivityModels(this.people.length,this.cars.length,random,software);
  for(const [bodies,sizes] of [[this.people,this.models.personSizes],[this.cars,this.models.vehicleSizes]]){
   bodies.forEach((body,i)=>{
    Object.assign(body,sizes[i]);body.reach=Math.hypot(body.width,body.length)*.5;
    place(body);
   });
  }
  this.crossings=laneCrossings(this.cars);
  this.contacts=new StreetContacts(this.people,this.cars);this.group=this.models.group;
 }
 advance(dt,player){
  reserveCrossings(this.crossings,this.cars);
  for(const b of this.contacts.bodies){
   const car=b.vehicle,braking=car?3.6:2.8;
   let maxMove=car?b.stopAt:Infinity;
   let desired=Math.min(b.cruise,speedForGap(maxMove,braking));
   const half=car?b.length*.5:b.width*.5;
   if(player&&player.y<b.y+b.height+.65&&player.y+1.78>b.y+.03){
    const dx=player.x-b.x,dz=player.z-b.z;
    const along=dx*b.sin+dz*b.cos,side=Math.abs(dx*b.cos-dz*b.sin);
    if(side<b.width*.5+(car?.55:.40)&&along> -half-.33){
     const gap=along-half-(car?.78:.53);
     desired=Math.min(desired,speedForGap(gap,braking));maxMove=Math.min(maxMove,Math.max(0,gap));
     if(!car&&gap<.55){
      b.yieldTime+=dt;
      if(b.yieldTime>1.2){b.direction*=-1;b.yieldTime=0;place(b);}
     }else b.yieldTime=0;
    }else b.yieldTime=0;
   }else b.yieldTime=0;
   if(car){
    for(const other of this.cars){
     if(other===b||other.route!==b.route)continue;
     const lead=wrap(other.distance-b.distance,b.route.length);
     if(lead>18)continue;
     const gap=lead-half-other.length*.5-1.25;
     desired=Math.min(desired,speedForGap(gap,braking));maxMove=Math.min(maxMove,Math.max(0,gap));
    }
   }
   b.speed+=clamp(desired-b.speed,-braking*dt,(car?1.9:1.45)*dt);
   const travel=Math.min(b.speed*dt,maxMove);
   if(travel+1e-8<b.speed*dt)b.speed=travel/dt;
   b.distance+=travel*b.direction;
   if(b.route.closed)b.distance=wrap(b.distance,b.route.length);
   else if(b.distance<0||b.distance>b.route.length){
    b.distance=clamp(b.distance,0,b.route.length);b.direction*=-1;
   }
   if(!car)b.phase+=travel*5.1;
   place(b,travel);
  }
 }
 dispose(){this.models.dispose();}
}

// One clock belongs to the registered district and survives switching projects.
export class StreetActivity {
 constructor(viewer){
  this.v=viewer;this.software=!viewer.renderer.isWebGLRenderer;
  this.population=new StreetPopulation(this.software);
  this.contacts=this.population.contacts;this.group=this.population.group;
  this.frustum=new Frustum();this.projection=new Matrix4();this.sphere=new Sphere();
  viewer.scene.add(this.group);
  this.group.visible=false;this.enabled=false;this.inView=true;this.visibleCount=0;
  this.motion=matchMedia('(prefers-reduced-motion: reduce)');
  this.refresh=()=>this.schedule();
  this.motion.addEventListener('change',this.refresh);
  document.addEventListener('visibilitychange',this.refresh);
  this.observer=new IntersectionObserver(entries=>{this.inView=entries.at(-1).isIntersecting;this.schedule();});
  this.observer.observe(viewer.host);
 }
 setEnabled(on){
  if(this.enabled===on)return;
  this.enabled=this.group.visible=this.contacts.enabled=on;this.schedule();
 }
 schedule(){
  clearTimeout(this.timer);this.lastTime=performance.now();
  if(!this.enabled||!this.inView||document.hidden)return;
  this.cull();
  this.timer=setTimeout(()=>this.tick(),50);
 }
 cull(poseChanged=false){
  const camera=this.v.camera;camera.updateMatrixWorld();
  this.frustum.setFromProjectionMatrix(this.projection.multiplyMatrices(camera.projectionMatrix,camera.matrixWorldInverse));
  let count=0,changed=poseChanged;
  for(const b of this.contacts.bodies){
   this.sphere.center.set(b.x,b.y+b.height*.5,b.z);this.sphere.radius=Math.hypot(b.height*.5,b.reach);
   const visible=this.frustum.intersectsSphere(this.sphere);
   if(visible!==b.visible)changed=true;
   b.visible=visible;if(visible)count++;
  }
  if(changed)this.population.models.update(this.population.people,this.population.cars);
  this.visibleCount=count;return count;
 }
 tick(){
  if(!this.enabled||!this.inView||document.hidden)return;
  const v=this.v,now=performance.now(),player=v.walkMode?.street?v.walkMode.walker.feet:null;
  let elapsed=Math.min((now-this.lastTime)*.001,.35);this.lastTime=now;
  if(!this.motion.matches||player){
   while(elapsed>.00001){const dt=Math.min(elapsed,.05);this.population.advance(dt,player);elapsed-=dt;}
   const previous=this.visibleCount;this.cull(true);
   if((previous||this.visibleCount)&&!v.frame&&!v.walkMode?.frame&&now-(v.lastFullDraw||0)>25){
    if(this.software)v.renderer.renderActivity(v.scene,v.camera);
    else v.renderer.render(v.scene,v.camera);
   }
  }
  const inside=!v.overview&&v.projectBounds?.containsPoint(v.camera.position);
  const frameMs=this.software?85:Math.max(inside?105:42,Math.min(180,(v.lastRenderDuration||0)*2));
  this.timer=setTimeout(()=>this.tick(),this.motion.matches&&!player?500:this.visibleCount?frameMs:220);
 }
 dispose(){
  this.enabled=false;clearTimeout(this.timer);this.observer.disconnect();
  document.removeEventListener('visibilitychange',this.refresh);this.motion.removeEventListener('change',this.refresh);
  this.group.removeFromParent();this.population.dispose();
 }
}
