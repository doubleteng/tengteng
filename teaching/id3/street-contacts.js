// Collision dimensions share each rendered actor's ground origin, heading and size.
function local(body, point) {
 const dx=point.x-body.x, dz=point.z-body.z;
 return [dx*body.cos-dz*body.sin, dx*body.sin+dz*body.cos];
}
function contact(body, from, to, radius, normal) {
 const [x,z]=local(body,from), [tx,tz]=local(body,to);
 const dx=tx-x, dz=tz-z;
 let nx,nz;
 if(body.vehicle){
  const w=body.width*.5+radius, l=body.length*.5+radius;
  if(Math.abs(x)<=w && Math.abs(z)<=l){
   // A player entering third person directly beside a vehicle can always back out.
   if(!dx&&!dz)return true;
   const depth=Math.min(w-Math.abs(x),l-Math.abs(z));
   if(Math.min(w-Math.abs(tx),l-Math.abs(tz))<=depth+1e-7)return false;
   if(w-Math.abs(x)<l-Math.abs(z)){nx=Math.sign(x)||-Math.sign(dx);nz=0;}
   else{nx=0;nz=Math.sign(z)||-Math.sign(dz);}
  }else{
   let start=0,end=1;
   for(const [p,v,extent,axis] of [[x,dx,w,0],[z,dz,l,1]]){
    if(Math.abs(v)<1e-9){if(Math.abs(p)>extent)return false;continue;}
    const a=(-extent-p)/v,b=(extent-p)/v,lo=Math.min(a,b);
    if(lo>start){start=lo;nx=axis?0:-Math.sign(v);nz=axis?-Math.sign(v):0;}
    end=Math.min(end,Math.max(a,b));
    if(start>end||start>1||end<0)return false;
   }
  }
 }else{
  const r=radius+body.width*.5, dist2=x*x+z*z, dot=x*dx+z*dz;
  const path2=dx*dx+dz*dz;
  if(dist2<=r*r && path2 && dot>=-1e-10)return false;
  const t=path2?Math.min(1,Math.max(0,-dot/path2)):0;
  const px=x+t*dx,pz=z+t*dz;
  if(px*px+pz*pz>r*r)return false;
  // Use the entering normal, so an angled approach slides along the tangent.
  const inv=1/(Math.hypot(x,z)||1);nx=x*inv;nz=z*inv;
 }
 if(normal)normal.set(nx*body.cos+nz*body.sin,0,-nx*body.sin+nz*body.cos);
 return true;
}

export class StreetContacts {
 constructor(people,vehicles){this.bodies=[...people,...vehicles];this.vehicles=vehicles;this.enabled=true;}
 blocks(from,to,radius,height,normal){
  if(!this.enabled)return false;
  const left=Math.min(from.x,to.x),right=Math.max(from.x,to.x),near=Math.min(from.z,to.z),far=Math.max(from.z,to.z);
  for(const body of this.bodies){
   const reach=body.reach+radius;
   if(body.x<left-reach||body.x>right+reach||body.z<near-reach||body.z>far+reach)continue;
   if(Math.min(from.y,to.y)>=body.y+body.height-.025||Math.max(from.y,to.y)+height<=body.y+.04)continue;
   if(contact(body,from,to,radius,normal))return true;
  }
  return false;
 }
 roofAt(x,z,min,max){
  let floor=-Infinity;
  if(this.enabled)for(const car of this.vehicles){
   const y=car.y+car.height;
   if(y<min||y>max||Math.abs(x-car.x)>car.reach||Math.abs(z-car.z)>car.reach)continue;
   const [side,along]=local(car,{x,z});
   if(Math.abs(side)<=car.width*.5 && Math.abs(along)<=car.length*.5)floor=Math.max(floor,y);
  }
  return floor;
 }
}
