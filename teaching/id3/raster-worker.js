const geometries=new Map();
const shadowSize=768;
const cachedShadow=new Float32Array(shadowSize*shadowSize);

// The triangulation and UVs are identical to WebGL. Build the tiny embedded
// brick tile's mip pyramid once when this geometry reaches the worker.
function pavingMips(tile){
 const chain=[tile.pixels];
 for(let size=tile.width;size>1;size/=2){
  const previous=chain.at(-1),next=new Uint8Array(size*size);
  for(let y=0;y<size/2;y++)for(let x=0;x<size/2;x++){
   const a=(2*y*size+2*x)*4,b=a+size*4,d=(y*(size/2)+x)*4;
   for(let channel=0;channel<3;channel++)
    next[d+channel]=(previous[a+channel]+previous[a+4+channel]+previous[b+channel]+previous[b+4+channel]+2)>>2;
  }
  chain.push(next);
 }
 return chain;
}
function sampleLevel(level,size,u,v,out){
 const sx=u*size-.5,sy=v*size-.5,x=Math.floor(sx),y=Math.floor(sy);
 const mask=size-1,fx=sx-x,fy=sy-y;
 const a=((y&mask)*size+(x&mask))*4,b=((y&mask)*size+((x+1)&mask))*4;
 const c=(((y+1)&mask)*size+(x&mask))*4,d=(((y+1)&mask)*size+((x+1)&mask))*4;
 for(let k=0;k<3;k++)out[k]=((1-fx)*level[a+k]+fx*level[b+k])*(1-fy)+((1-fx)*level[c+k]+fx*level[d+k])*fy;
}
function uvPlane(values,q,A,B,C,D){
 const va=values[0]*q[0],vb=values[1]*q[1],vc=values[2]*q[2];
 return [va-vc,vb-vc,vc,(va-vc)*A+(vb-vc)*C,(va-vc)*B+(vb-vc)*D];
}
function pavingTriangle(tile,uv,coords,a,b,c,A,B,C,D){
 const ids=[a/3,b/3,c/3];
 const q=ids.map(i=>coords.cameraW?1/coords.cameraW[i]:1);
 const plane=values=>uvPlane(values,q,A,B,C,D);
 return {tile,U:plane(ids.map(i=>uv[i*2])),V:plane(ids.map(i=>uv[i*2+1])),Q:plane([1,1,1]),
         first:[0,0,0],second:[0,0,0]};
}
function pavingPixel(tex,bu,bv,shade,pixels,off){
 const {tile,U,V,Q,first,second}=tex;
 const inverseW=bu*Q[0]+bv*Q[1]+Q[2],w=1/inverseW;
 const u=(bu*U[0]+bv*U[1]+U[2])*w,v=(bu*V[0]+bv*V[1]+V[2])*w;
 // Perspective-correct footprint from the derivatives of (u/w)/(1/w).
 const ux=U[3]-u*Q[3],uy=U[4]-u*Q[4],vx=V[3]-v*Q[3],vy=V[4]-v*Q[4];
 const span2=Math.max(ux*ux+vx*vx,uy*uy+vy*vy)*(tile.width*w)**2;
 const lod=Math.min(tile.levels.length-1,Math.max(0,.5*Math.log2(Math.max(1,span2))));
 const lo=Math.floor(lod),hi=Math.min(lo+1,tile.levels.length-1),t=lod-lo;
 sampleLevel(tile.levels[lo],tile.width>>lo,u,v,first);
 if(t>0)sampleLevel(tile.levels[hi],tile.width>>hi,u,v,second);
 for(let k=0;k<3;k++)pixels[off+k]=shade*(first[k]+(second[k]-first[k])*t);
}

function shadowCoverage(depth,size,x,y,z){
 // Interpolate four depth comparisons in shadow-texel space.
 x-=.5;y-=.5;
 const ix=Math.floor(x),iy=Math.floor(y);
 if(ix<0||iy<0||ix+1>=size||iy+1>=size)return 0;
 const i=iy*size+ix,fx=x-ix,fy=y-iy;
 const top=(1-fx)*(z>depth[i])+fx*(z>depth[i+1]);
 const bottom=(1-fx)*(z>depth[i+size])+fx*(z>depth[i+size+1]);
 return top*(1-fy)+bottom*fy;
}
function multiply(a,b){const c=new Float64Array(16);for(let i=0;i<4;i++)for(let j=0;j<4;j++)for(let k=0;k<4;k++)c[4*i+j]+=a[4*k+j]*b[4*i+k];return c;}
function project(xyz,m,w,h,perspective=false){
 const dest=new Float64Array(xyz.length);
 if(perspective){
  dest.cameraW=new Float64Array(xyz.length/3);
  dest.clip=new Float64Array(xyz.length);
 }
 for(let i=0;i<xyz.length;i+=3){
  const x=xyz[i],y=xyz[i+1],z=xyz[i+2];
  const cx=m[0]*x+m[4]*y+m[8]*z+m[12],cy=m[1]*x+m[5]*y+m[9]*z+m[13],cz=m[2]*x+m[6]*y+m[10]*z+m[14];
  let cw=1;
  if(perspective){
   cw=m[3]*x+m[7]*y+m[11]*z+m[15];
   dest.cameraW[i/3]=cw;dest.clip[i]=cx;dest.clip[i+1]=cy;dest.clip[i+2]=cz;
  }
  dest[i]=(cx/cw*.5+.5)*w;dest[i+1]=(.5-cy/cw*.5)*h;dest[i+2]=cz/cw;
 }
 return dest;
}
// Clip geometry that crosses behind the camera before dividing by w.
// Carry world and light coordinates through the same edge interpolation.
function drawNearClipped(pass,coords,offsets,d,lightCoords,world,uv){
 const near=pass.near,polygon=offsets.length===3;
 const vertices=offsets.map(i=>[coords.clip[i],coords.clip[i+1],coords.clip[i+2],coords.cameraW[i/3],
  world[i],world[i+1],world[i+2],lightCoords?.[i]||0,lightCoords?.[i+1]||0,lightCoords?.[i+2]||0,uv?.[(i/3)*2]||0,uv?.[(i/3)*2+1]||0]);
 const out=[];
 for(let i=0;i<vertices.length;i++){
  const a=vertices[i],b=vertices[(i+1)%vertices.length];
  if(a[3]>=near)out.push(a);
  if(!polygon&&i===vertices.length-1)break;
  if((a[3]<near)!==(b[3]<near)){
   const t=(near-a[3])/(b[3]-a[3]);out.push(a.map((val,j)=>val+t*(b[j]-val)));
  }
 }
 if(out.length<offsets.length)return;
 const screen=new Float64Array(out.length*3),wpos=[],light=[],clippedUV=[];
 screen.cameraW=out.map(a=>a[3]);
 out.forEach((a,i)=>{
  screen.set([(a[0]/a[3]*.5+.5)*pass.w,(.5-a[1]/a[3]*.5)*pass.h,a[2]/a[3]],i*3);
  wpos.push(...a.slice(4,7));light.push(...a.slice(7,10));clippedUV.push(...a.slice(10));
 });
 const indices=polygon?(out.length===4?[0,1,2,0,2,3]:[0,1,2]):[0,1];
 paint(pass,screen,indices,{...d,widths:d.widths&&!polygon?[d.widths[offsets[0]/3],d.widths[offsets[1]/3]]:null,start:0,count:indices.length,kind:polygon?'tri':'segments'},lightCoords?light:null,wpos,uv?clippedUV:null);
}
function paintLine(pass,coords,a,b,d){
 const {w,h,depth,pixels}=pass,ax=coords[a],ay=coords[a+1],dx=coords[b]-ax,dy=coords[b+1]-ay;
 let lo=0,hi=1;
 // Limit work to the visible part of each projected line.
 for(const [p,v,limit] of [[ax,dx,w],[ay,dy,h]]){
  if(v===0){if(p<0||p>=limit)return;continue;}
  const t0=-p/v,t1=(limit-p)/v;
  lo=Math.max(lo,Math.min(t0,t1));hi=Math.min(hi,Math.max(t0,t1));if(lo>hi)return;
 }
 let alpha=d.alpha;
 if(d.widths){
  const cw=coords.cameraW ? Math.max(pass.near,(coords.cameraW[a/3]+coords.cameraW[b/3])/2) : 1;
  const px=d.widths[a/3]*d.worldScale*pass.inkProjection/cw;
  const t=Math.min(1,Math.max(0,(px-.85)/(3.6-.85)));
  alpha*=t*t*(3-2*t);
  if(alpha<.015)return;
 }
 const steps=Math.max(1,Math.ceil((hi-lo)*Math.max(Math.abs(dx),Math.abs(dy))));
 for(let j=0;j<=steps;j++){
  const t=lo+(hi-lo)*j/steps,x=Math.floor(ax+t*dx),y=Math.floor(ay+t*dy);
  if(x<0||y<0||x>=w||y>=h)continue;
  const z=coords[a+2]+t*(coords[b+2]-coords[a+2]),p=y*w+x;
  const bias=d.outline?(coords.cameraW?Math.max(2e-7,(1-z)*.003):.00015):0;
  if(z< -1||z>1||z>depth[p]+bias)continue;
  if(!d.outline)depth[p]=Math.min(z,depth[p]);
  for(let c=0;c<3;c++)pixels[p*4+c]+=alpha*(d.color[c]*255-pixels[p*4+c]);
 }
}
function paint(pass,coords,indices,d,lightCoords,world,uv){
 const {w,h,depth,pixels,shadowDepth,ss,dir}=pass;
 const end=d.start+d.count;
 const idx=i=>3*(indices?indices[i]:i);
 if(d.kind!=='tri'){
  if(!pixels)return;
  const step=d.kind==='segments'?2:1;
  for(let i=d.start;i<end-(d.kind==='point'?0:1);i+=step){
   const a=idx(i),b=idx(d.kind==='point'?i:i+1);
   if(coords.clip&&(coords.cameraW[a/3]<pass.near||coords.cameraW[b/3]<pass.near)){
    if(coords.cameraW[a/3]>=pass.near||coords.cameraW[b/3]>=pass.near)drawNearClipped(pass,coords,[a,b],d,lightCoords,world);
    continue;
   }
   paintLine(pass,coords,a,b,d);
  }return;
 }
 for(let i=d.start;i+2<end;i+=3){
  const a=idx(i),b=idx(i+1),c=idx(i+2);
  const finish=d.finishes;
  const red=finish?finish[a]:d.color[0]*255,green=finish?finish[a+1]:d.color[1]*255,blue=finish?finish[a+2]:d.color[2]*255;
  if(coords.clip){
   const wa=coords.cameraW[a/3],wb=coords.cameraW[b/3],wc=coords.cameraW[c/3];
   if(wa<pass.near||wb<pass.near||wc<pass.near){
    if(wa>=pass.near||wb>=pass.near||wc>=pass.near)drawNearClipped(pass,coords,[a,b,c],finish?{...d,finishes:null,color:[red/255,green/255,blue/255]}:d,lightCoords,world,uv);
    continue;
   }
  }
  const ax=coords[a],ay=coords[a+1],bx=coords[b],by=coords[b+1],cx=coords[c],cy=coords[c+1];
  const den=(by-cy)*(ax-cx)+(cx-bx)*(ay-cy);if(Math.abs(den)<.000001)continue;
  const xmin=Math.max(0,Math.floor(Math.min(ax,bx,cx))),xmax=Math.min(w-1,Math.ceil(Math.max(ax,bx,cx))),ymin=Math.max(0,Math.floor(Math.min(ay,by,cy))),ymax=Math.min(h-1,Math.ceil(Math.max(ay,by,cy)));
  if(xmax<xmin||ymax<ymin)continue;
  const inv=1/den,A=(by-cy)*inv,B=(cx-bx)*inv,C=(cy-ay)*inv,D=(ax-cx)*inv;
  const paving=pixels&&d.tile&&uv?pavingTriangle(d.tile,uv,coords,a,b,c,A,B,C,D):null;
  let lum=1;
  if(pixels){
   const ux=world[b]-world[a],uy=world[b+1]-world[a+1],uz=world[b+2]-world[a+2],vx=world[c]-world[a],vy=world[c+1]-world[a+1],vz=world[c+2]-world[a+2];
   const nx=uy*vz-uz*vy,ny=uz*vx-ux*vz,nz=ux*vy-uy*vx;const n=Math.hypot(nx,ny,nz)||1;
   lum=.70+(pass.sunVisible?.30:0)*Math.max(0,(nx*dir[0]+ny*dir[1]+nz*dir[2])/n)+.035*Math.max(0,ny/n);
  }
  for(let y=ymin;y<=ymax;y++){
   const dy=y+.5-cy;let u=A*(xmin+.5-cx)+B*dy,v=C*(xmin+.5-cx)+D*dy;
   for(let x=xmin;x<=xmax;x++,u+=A,v+=C){
    const t=1-u-v;if(u<-.00001||v<-.00001||t<-.00001)continue;
    const z=u*coords[a+2]+v*coords[b+2]+t*coords[c+2];const p=y*w+x;
    if(z< -1||z>1||z>=depth[p])continue;
    if(pixels&&d.alpha<.98&&((x*13+y*7)%17)>=d.alpha*17)continue;
    depth[p]=z;if(!pixels)continue;let shade=lum;
    if(lightCoords&&d.receive){
     let l0=u,l1=v,l2=t;
     if(coords.cameraW){
      l0/=coords.cameraW[a/3];l1/=coords.cameraW[b/3];l2/=coords.cameraW[c/3];
      const inv=1/(l0+l1+l2);l0*=inv;l1*=inv;l2*=inv;
     }
     const lx=l0*lightCoords[a]+l1*lightCoords[b]+l2*lightCoords[c];
     const ly=l0*lightCoords[a+1]+l1*lightCoords[b+1]+l2*lightCoords[c+1];
     const lz=l0*lightCoords[a+2]+l1*lightCoords[b+2]+l2*lightCoords[c+2]-.0015;
     shade*=1-.26*shadowCoverage(shadowDepth,ss,lx,ly,lz);
    }
    const off=p*4;if(paving){pavingPixel(paving,u,v,shade,pixels,off);continue;}
    pixels[off]=red*shade;pixels[off+1]=green*shade;pixels[off+2]=blue*shade;
   }
  }
 }
}
onmessage=({data:q})=>{
 for(const k of q.removed)geometries.delete(k);for(const g of q.fresh){
  if(g.paving)g.paving.levels=pavingMips(g.paving);
  geometries.set(g.id,g);
 }
 const ss=shadowSize,shadowDepth=cachedShadow;
 const objs=q.draws.map(d=>{const g=geometries.get(d.id),m=d.m,xyz=g.xyz;const world=new Float32Array(xyz.length);
  for(let i=0;i<xyz.length;i+=3){const x=xyz[i],y=xyz[i+1],z=xyz[i+2];world[i]=m[0]*x+m[4]*y+m[8]*z+m[12];world[i+1]=m[1]*x+m[5]*y+m[9]*z+m[13];world[i+2]=m[2]*x+m[6]*y+m[10]*z+m[14];}
  if(d.paving)d.tile=g.paving;
  if(d.vertexColors)d.finishes=g.finishes;
  if(g.widths){d.widths=g.widths;d.worldScale=Math.hypot(m[0],m[1],m[2]);}
  return {d,g,world,l:q.shadow?project(xyz,multiply(q.shadow,m),ss,ss):null};
 });
 if(q.shadow&&q.updateShadow){
  shadowDepth.fill(Infinity);
  for(const {d,g,l} of objs)if(d.cast)paint({w:ss,h:ss,depth:shadowDepth},l,g.index,d);
 }
 const pixels=new Uint8ClampedArray(q.w*q.h*4);for(let i=0;i<pixels.length;i+=4){pixels[i]=q.background[0]*255;pixels[i+1]=q.background[1]*255;pixels[i+2]=q.background[2]*255;pixels[i+3]=255;}
 const pass={w:q.w,h:q.h,depth:new Float64Array(q.w*q.h).fill(Infinity),pixels,shadowDepth,ss,dir:q.dir,sunVisible:q.sunVisible,near:q.perspectiveNear,inkProjection:q.inkProjection};
 // Resolve solid depth before compositing visible linework.
 objs.sort((a,b)=>Number(a.d.kind!=='tri')-Number(b.d.kind!=='tri'));
 for(const {d,g,l,world} of objs)paint(pass,project(g.xyz,multiply(q.view,d.m),q.w,q.h,!!q.perspectiveNear),g.index,d,l,world,g.paving?.coords);
 postMessage({w:q.w,h:q.h,buffer:pixels.buffer},[pixels.buffer]);
};
