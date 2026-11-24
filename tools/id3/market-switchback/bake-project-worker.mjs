// Authoring worker, invoked explicitly from bake-project.html. The gallery uses
// the published compressed asset and never loads this code.
import {readOpaqueCase,TriangleScene} from './light-bvh.mjs';

const directions=48, spacing=.76, limit=36;
const clamp=(v,lo,hi)=>Math.max(lo,Math.min(hi,v));
function lattice(bounds,step) {
 const origin=Array.from(bounds.slice(0,3),a=>(Math.floor(a/step)-2)*step);
 const size=origin.map((p,i)=>Math.ceil((bounds[i+3]-p)/step)+3);
 return {origin,size,step};
}

function quadrature(){
 const rays=[];
 for(let i=0;i<directions/2;i++){
  const y=(i+.5)/(directions/2), a=(i+.5)*Math.PI*(3-Math.sqrt(5)),r=Math.sqrt(1-y*y);
  const x=r*Math.cos(a),z=r*Math.sin(a);
  rays.push(x,y,z,-x,-y,-z);
 }
 return new Float64Array(rays);
}

function measure(scene,grid,coarse,progress) {
 const [nx,ny,nz]=grid.size,[ox,oy,oz]=grid.origin,ray=quadrature(),tri=scene.triangles;
 const packed=coarse!==null;
 const data=packed?new Uint8Array(nx*ny*nz*4):new Float32Array(nx*ny*nz*4);
 const [cx,cy,cz]=coarse?.origin||[0,0,0], [w,h,d]=coarse?.size||[0,0,0], step=grid.step;
 for(let k=0;k<nz;k++) {
  for(let j=0;j<ny;j++){
   for(let i=0;i<nx;i++){
    const x=ox+i*step,y=oy+j*step,z=oz+k*step,ind=4*(i+nx*(j+k*ny));
    let b=0,sx=0,sy=0,sz=0;
    for(let r=0;r<ray.length;r+=3) {
     const dx=ray[r],dy=ray[r+1],dz=ray[r+2],f=scene.trace(x,y,z,dx,dy,dz,limit);
     let q=1;
     if(f>=0) {
      q=0;
      if(coarse){
       const t=scene.hitDistance,sign=tri[f+9]*dx+tri[f+10]*dy+tri[f+11]*dz<=0?1:-1;
       const a=sign*tri[f+9],b=sign*tri[f+10],c=sign*tri[f+11];
       const ci=clamp(Math.round((x+t*dx-cx)/coarse.step+.62*a),0,w-1);
       const cj=clamp(Math.round((y+t*dy-cy)/coarse.step+.62*b),0,h-1);
       const ck=clamp(Math.round((z+t*dz-cz)/coarse.step+.62*c),0,d-1);
       const l=4*(ci+w*(cj+ck*h)),v=coarse.data;
       q=tri[f+12]*clamp(v[l]+a*v[l+1]+b*v[l+2]+c*v[l+3],0,1);
      }
     }
     b+=q;sx+=q*dx;sy+=q*dy;sz+=q*dz;
    }
    const m=b/directions,sh=2/directions;
    if(packed){
     data[ind]=clamp(8*Math.round(255*m/8),0,255);
     data[ind+1]=clamp(128+8*Math.round(255*sx*sh/8),0,255);
     data[ind+2]=clamp(128+8*Math.round(255*sy*sh/8),0,255);
     data[ind+3]=clamp(128+8*Math.round(255*sz*sh/8),0,255);
    }else{
     data[ind]=m;data[ind+1]=sh*sx;data[ind+2]=sh*sy;data[ind+3]=sh*sz;
    }
   }
  }
  if(k%3===0)progress(k+1,nz);
 }
 return Object.assign(grid,{data});
}

export async function bakeProject(buffer,notify=()=>{}) {
 const start=performance.now(), hash=new Uint8Array(await crypto.subtle.digest('SHA-256',buffer));
 const scene=new TriangleScene(readOpaqueCase(buffer));
 const shape=scene.bounds.subarray(0,6);
 const coarse=measure(scene,lattice(shape,spacing*2),null,(done,total)=>notify('Sky visibility',done,total));
 const grid=measure(scene,lattice(shape,spacing),coarse,(done,total)=>notify('Diffuse bounce',done,total));
 const file=new Uint8Array(60+grid.data.length),header=new DataView(file.buffer);
 file.set([73,80,86,49]); // IPV1
 grid.size.forEach((n,i)=>header.setUint16(4+2*i,n,true));
 grid.origin.forEach((n,i)=>header.setFloat32(12+4*i,n,true));
 header.setFloat32(24,spacing,true);file.set(hash,28);file.set(grid.data,60);
 const compressed=await new Response(new Blob([file]).stream().pipeThrough(new CompressionStream('gzip'))).arrayBuffer();
 return {compressed,rawBytes:grid.data.length,size:grid.size,triangles:scene.faceCount,
  fingerprint:Array.from(hash,b=>b.toString(16).padStart(2,'0')).join(''),
  seconds:(performance.now()-start)/1000};
}

if(typeof WorkerGlobalScope!=='undefined'&&self instanceof WorkerGlobalScope){
 self.onmessage=async e=>{
  try{
   const result=await bakeProject(e.data.buffer,(stage,done,total)=>self.postMessage({stage,done,total}));
   self.postMessage(result,[result.compressed]);
  }catch(error){self.postMessage({error:error.message});}
 };
}
