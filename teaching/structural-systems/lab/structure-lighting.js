/* Shared, world-space lighting for every Structure Lab model. No network dependencies. */
(function(root){
'use strict';
const dot=(a,b)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2];
const sub=(a,b)=>a.map((v,i)=>v-b[i]);
const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const unit=a=>{const n=Math.hypot(...a)||1;return a.map(v=>v/n);};
const direction=unit([-.65,1,.45]),right=unit(cross([0,1,0],direction)),up=cross(direction,right);
const cubeFaces=[[0,1,2,3],[4,7,6,5],[0,4,5,1],[1,5,6,2],[2,6,7,3],[3,7,4,0]];
const normal=points=>unit(cross(sub(points[1],points[0]),sub(points[2],points[0])));
function shade(hex,n){
 if(!/^#[0-9a-f]{6}$/i.test(hex))return hex;
 // World-space Lambert lighting: visible side faces and soffits stay distinct as the camera orbits.
 const k=.25+.18*Math.max(0,n[1])+.60*Math.max(0,dot(n,direction));
 return '#'+[1,3,5].map(i=>Math.min(255,Math.round(parseInt(hex.slice(i,i+2),16)*k)).toString(16).padStart(2,'0')).join('');
}
class ShadowMap{
 constructor(items,corners,resolution=1536){
  this.size=resolution;this.depth=new Float32Array(resolution*resolution);this.depth.fill(-Infinity);
  const faces=[],points=[];
  for(const it of items){
   // Alpha also encodes teaching overlays; actual beam solids and corrugated deck remain opaque in solid view.
   if(it.castShadow===false||(it.type==='poly'&&(it.alpha??1)<.4&&!it.corrugation))continue;
   if(it.type==='beam'){
    const p=corners(it);if(p.length!==8)continue;points.push(...p);
    for(const f of cubeFaces)faces.push(f.map(i=>p[i]));
   }else if(it.type==='poly'&&it.points?.length>=3){faces.push(it.points);points.push(...it.points);}
  }
  this.valid=points.length>0;if(!this.valid)return;
  const min=[Infinity,Infinity,Infinity],max=[-Infinity,-Infinity,-Infinity];
  let left=Infinity,bottom=Infinity,rightEdge=-Infinity,top=-Infinity;
  for(const p of points){
   for(let k=0;k<3;k++){min[k]=Math.min(min[k],p[k]);max[k]=Math.max(max[k],p[k]);}
   const x=dot(p,right),y=dot(p,up);left=Math.min(left,x);rightEdge=Math.max(rightEdge,x);bottom=Math.min(bottom,y);top=Math.max(top,y);
  }
  const span=Math.max(rightEdge-left,top-bottom,1);this.texel=span/(resolution-8);this.scale=1/this.texel;
  this.left=left-4*this.texel;this.bottom=bottom-4*this.texel;
  this.groundY=min[1]-.025;
  const pad=Math.max(4,(max[1]-min[1])*.9);
  this.ground=[[min[0]-pad,this.groundY,min[2]-pad],[min[0]-pad,this.groundY,max[2]+pad],[max[0]+pad,this.groundY,max[2]+pad],[max[0]+pad,this.groundY,min[2]-pad]];
  for(const face of faces){const q=face.map(p=>this.project(p));for(let i=1;i<q.length-1;i++)this.triangle(q[0],q[i],q[i+1]);}
 }
 project(p){return [(dot(p,right)-this.left)*this.scale,(dot(p,up)-this.bottom)*this.scale,dot(p,direction)];}
 triangle(a,b,c){
  const area=(b[0]-a[0])*(c[1]-a[1])-(c[0]-a[0])*(b[1]-a[1]);if(Math.abs(area)<1e-10)return;
  const dx=((b[2]-a[2])*(c[1]-a[1])-(c[2]-a[2])*(b[1]-a[1]))/area;
  const dy=((b[0]-a[0])*(c[2]-a[2])-(c[0]-a[0])*(b[2]-a[2]))/area;
  const p=[a,b,c].sort((x,y)=>x[1]-y[1]),lo=p[0],mid=p[1],hi=p[2],N=this.size;
  const ymin=Math.max(0,Math.ceil(lo[1]-.5)),ymax=Math.min(N-1,Math.floor(hi[1]-.5));
  const long=(hi[0]-lo[0])/(hi[1]-lo[1]),upper=(mid[0]-lo[0])/(mid[1]-lo[1]||1),lower=(hi[0]-mid[0])/(hi[1]-mid[1]||1);
  for(let y=ymin;y<=ymax;y++){
   const py=y+.5,xa=lo[0]+(py-lo[1])*long,xb=py<mid[1]?lo[0]+(py-lo[1])*upper:mid[0]+(py-mid[1])*lower;
   const x0=Math.max(0,Math.ceil(Math.min(xa,xb)-.5)),x1=Math.min(N-1,Math.floor(Math.max(xa,xb)-.5));
   let z=a[2]+(x0+.5-a[0])*dx+(py-a[1])*dy,index=y*N+x0;
   for(let x=x0;x<=x1;x++,index++,z+=dx)if(z>this.depth[index])this.depth[index]=z;
  }
 }
 receiver(n,ground=false){
  const nl=dot(n,direction),den=Math.abs(nl)<.12?(nl<0?-.12:.12):nl;
  return {map:this,bias:this.texel*.18,slopeX:-dot(n,right)/den*this.texel,slopeY:-dot(n,up)/den*this.texel,strength:ground?.44:(nl>0?.48:.10)};
 }
 // Receiver-plane depth correction avoids acne without lifting shadows off their contacts.
 visibility(x,y,z,receiver){
  const N=this.size,ix=Math.floor(x),iy=Math.floor(y);if(ix<1||iy<1||ix>=N-1||iy>=N-1)return 1;
  let blocked=0;
  for(let oy=-1;oy<=1;oy++)for(let ox=-1;ox<=1;ox++){
   const depth=z+receiver.slopeX*(ix+ox+.5-x)+receiver.slopeY*(iy+oy+.5-y)+receiver.bias;
   if(this.depth[(iy+oy)*N+ix+ox]>depth)blocked++;
  }
  return 1-receiver.strength*blocked/9;
 }
}
root.LabLighting={direction,normal,shade,ShadowMap,version:'20261110-workspace'};
})(window);
