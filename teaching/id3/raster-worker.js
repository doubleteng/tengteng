const geometries=new Map();
const finishTiles=new Map();
let lightVolume=null,daylight=null,streetSky=null;

// Repeating photographic finishes and equirectangular reflection probes use
// independent width and height. Build their mip levels once per asset.
function imagePyramid(image){
 const levels=[image];
 while(levels.at(-1).width>1||levels.at(-1).height>1){
  const src=levels.at(-1),width=Math.max(1,src.width>>1),height=Math.max(1,src.height>>1);
  const pixels=new Uint8Array(4*width*height);
  for(let y=0;y<height;y++)for(let x=0;x<width;x++){
   const base=(Math.min(2*y,src.height-1)*src.width+2*x)*4;
   const east=src.width===1?0:4,south=src.height===1?0:src.width*4;
   for(let k=0;k<4;k++)pixels[4*(y*width+x)+k]=(src.pixels[base+k]+src.pixels[base+east+k]+
    src.pixels[base+south+k]+src.pixels[base+south+east+k]+2)>>2;
  }
  levels.push({pixels,width,height,wrapS:image.wrapS,wrapT:image.wrapT});
 }
 return levels;
}
function imageCoordinate(t,size,wrap){
 // glTF's default is repeat. Clamp and mirror extend the edge texel at a turn.
 if(wrap===1002)t=1-Math.abs(1-(t-2*Math.floor(t/2)));
 if(wrap===1001||wrap===1002)return Math.max(0,Math.min(size-1,t*size-.5));
 return (t-Math.floor(t))*size-.5;
}
function transformedUV(g,d){
 const uv=g.finishUVs?.[d.uvChannel||0];if(!uv||(!d.flipY&&!d.uvMatrix))return uv;
 const m=d.uvMatrix||[1,0,0,1,0,0],key=d.tileID,entry=g.uvTransforms?.get(key);
 if(entry&&entry.flip===d.flipY&&entry.channel===d.uvChannel&&sameMatrix(entry.m,m))return entry.values;
 const values=new Float32Array(uv.length);
 for(let i=0;i<uv.length;i+=2){
  values[i]=m[0]*uv[i]+m[2]*uv[i+1]+m[4];
  const y=m[1]*uv[i]+m[3]*uv[i+1]+m[5];values[i+1]=d.flipY?1-y:y;
 }
 (g.uvTransforms??=new Map()).set(key,{m,flip:d.flipY,channel:d.uvChannel,values});
 return values;
}
function imageSample(image,u,v,out,panorama=false){
 const {pixels,width,height,wrapS,wrapT}=image;
 const x=imageCoordinate(u,width,wrapS),y=imageCoordinate(v,height,panorama?1001:wrapT);
 const ix=Math.floor(x),iy=Math.floor(y),fx=x-ix,fy=y-iy;
 const x0=ix<0?width-1:ix,y0=iy<0?height-1:iy;
 const x1=x0+1<width?x0+1:(wrapS===1001||wrapS===1002?x0:0);
 const y1=y0+1<height?y0+1:(panorama||wrapT===1001||wrapT===1002?y0:0);
 const a=(y0*width+x0)*4,b=(y0*width+x1)*4,c=(y1*width+x0)*4,d=(y1*width+x1)*4;
 for(let k=0;k<out.length;k++){
  const top=pixels[a+k]+fx*(pixels[b+k]-pixels[a+k]),bottom=pixels[c+k]+fx*(pixels[d+k]-pixels[c+k]);
  out[k]=top+fy*(bottom-top);
 }
}
function finishLevel(levels,uv,coords,a,b,c,A,B,C,D){
 const q=[a,b,c].map(i=>coords.cameraW?1/coords.cameraW[i/3]:1);
 const Q=uvPlane([1,1,1],q,A,B,C,D),w=3/(q[0]+q[1]+q[2]);
 let footprint=0;
 for(let k=0;k<2;k++){
  const P=uvPlane([uv[(a/3)*2+k],uv[(b/3)*2+k],uv[(c/3)*2+k]],q,A,B,C,D);
  const v=(P[0]/3+P[1]/3+P[2])*w,size=k===0?levels[0].width:levels[0].height;
  footprint=Math.max(footprint,Math.abs(P[3]-v*Q[3])*w*size,Math.abs(P[4]-v*Q[4])*w*size);
 }
 return levels[Math.min(levels.length-1,Math.max(0,Math.round(Math.log2(footprint||1))))];
}
// The leaf atlas is a power-of-two repeating PNG. Cache its alpha channel and
// coverage range once per mip so a distant, fully covered mip needs no pixel lookups.
function prepareLeafMask(levels){
 for(const level of levels){
  const a=new Uint8Array(level.width*level.height);let min=255,max=0;
  for(let i=0;i<a.length;i++){a[i]=level.pixels[4*i+3];min=Math.min(min,a[i]);max=Math.max(max,a[i]);}
  level.leafAlpha=a;level.minAlpha=min;level.maxAlpha=max;
 }
}
function leafMip(levels,uv,a,b,c,A,B,C,D){
 const u=uv[a]-uv[c],v=uv[b]-uv[c],s=uv[a+1]-uv[c+1],t=uv[b+1]-uv[c+1];
 const footprint=levels[0].width*Math.max(Math.abs(A*u+C*v),Math.abs(B*u+D*v),Math.abs(A*s+C*t),Math.abs(B*s+D*t));
 const level=Math.round(Math.log2(Math.max(1,footprint)));
 return levels[Math.min(level,levels.length-1)];
}
function prepareVolume(v){
 // A covered, open market also receives diffuse light reflected from the
 // surrounding bright court. Its horizontal directional coefficients locate
 // the lit edges and doorways independently of the camera position.
 const courtBounce=new Uint8Array(v.data.length/4);
 for(let j=0;j<courtBounce.length;j++){
  const i=4*j,lateral=v.data[i]+Math.hypot(v.data[i+1]-128,v.data[i+3]-128);
  courtBounce[j]=Math.min(150,Math.max(0,(lateral-44)*1.30));
 }
 return {...v,courtBounce,inv:1/v.step,strideY:v.size[0]*4,strideZ:v.size[0]*v.size[1]*4};
}
function visibility(v,x,y,z,nx,ny,nz,court=false){
 // The texture encodes the directional first moment of visible sky at each
 // grid node. Shift just outside the face before trilinear interpolation.
 x=Math.min(v.size[0]-1.00001,Math.max(0,(x-v.origin[0])*v.inv+.62*nx));
 y=Math.min(v.size[1]-1.00001,Math.max(0,(y-v.origin[1])*v.inv+.62*ny));
 z=Math.min(v.size[2]-1.00001,Math.max(0,(z-v.origin[2])*v.inv+.62*nz));
 const ix=x|0,iy=y|0,iz=z|0;x-=ix;y-=iy;z-=iz;
 const at=ix*4+iy*v.strideY+iz*v.strideZ,sy=v.strideY,sz=v.strideZ,bytes=v.data;
 const dot=i=>bytes[i]+(bytes[i+1]-128)*nx+(bytes[i+2]-128)*ny+(bytes[i+3]-128)*nz+(court?v.courtBounce[i>>2]:0);
 const ax=1-x,ay=1-y;
 const low=ay*(ax*dot(at)+x*dot(at+4))+y*(ax*dot(at+sy)+x*dot(at+sy+4));
 const high=ay*(ax*dot(at+sz)+x*dot(at+sz+4))+y*(ax*dot(at+sz+sy)+x*dot(at+sz+sy+4));
 return Math.min(1,Math.max(0,(low+z*(high-low))/255));
}
function reflectedDirection(pass,world,i,nx,ny,nz){
 let ex=pass.eyeDirection[0],ey=pass.eyeDirection[1],ez=pass.eyeDirection[2];
 if(pass.near){
  ex=pass.eye[0]-world[i];ey=pass.eye[1]-world[i+1];ez=pass.eye[2]-world[i+2];
  const inv=1/(Math.sqrt(ex*ex+ey*ey+ez*ez)||1);ex*=inv;ey*=inv;ez*=inv;
 }
 const cosine=nx*ex+ny*ey+nz*ez,twice=cosine*2;
 return [.5+Math.atan2(nz*twice-ez,nx*twice-ex)/(2*Math.PI),
  .5-Math.asin(Math.max(-1,Math.min(1,ny*twice-ey)))/Math.PI,Math.abs(cosine)];
}
function triangleReflection(pass,world,a,b,c,nx,ny,nz,roughness){
 const p=reflectedDirection(pass,world,a,nx,ny,nz),q=reflectedDirection(pass,world,b,nx,ny,nz),r=reflectedDirection(pass,world,c,nx,ny,nz);
 // Interpolate on the shorter arc through the longitude seam.
 for(const point of [p,q])point[0]-=Math.round(point[0]-r[0]);
 const levels=pass.environment;
 return {p,q,r,image:levels?.[Math.min(levels.length-1,Math.floor(roughness*roughness*5))],color:[0,0,0]};
}
function sampleReflection(refl,l0,l1,l2){
 const {p,q,r,image,color}=refl,u=l0*p[0]+l1*q[0]+l2*r[0],v=l0*p[1]+l1*q[1]+l2*r[1];
 if(image)imageSample(image,u,v,color,true);
 else{
  const sky=Math.max(0,Math.min(1,(.55-v)*6));
  color[0]=103+58*sky;color[1]=105+83*sky;color[2]=97+115*sky;
 }
 return Math.max(0,1-(l0*p[2]+l1*q[2]+l2*r[2]))**5;
}

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

function shadowCoverage(depth,size,x,y,z,slopeX,slopeY){
 // Interpolate four depth comparisons in shadow-texel space.
 x-=.5;y-=.5;
 const ix=Math.floor(x),iy=Math.floor(y);
 if(z< -1||z>1||ix<0||iy<0||ix+1>=size||iy+1>=size)return 0;
 const i=iy*size+ix,fx=x-ix,fy=y-iy;
 // Compare each tap at the depth of this receiver plane. A large constant
 // bias separates posts and feet from their shadows on sloping pavement.
 const z00=z-fx*slopeX-fy*slopeY-.000012;
 const top=(1-fx)*(z00>depth[i])+fx*(z00+slopeX>depth[i+1]);
 const bottom=(1-fx)*(z00+slopeY>depth[i+size])+fx*(z00+slopeX+slopeY>depth[i+size+1]);
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
  world[i],world[i+1],world[i+2],lightCoords?.[i]||0,lightCoords?.[i+1]||0,lightCoords?.[i+2]||0,uv?.[(i/3)*2]||0,uv?.[(i/3)*2+1]||0,d.ambient?.[i/3]??255,d.figureLight?.[i/3]??0,d.contactFade?.[i/3]??0]);
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
 const screen=new Float64Array(out.length*3),wpos=[],light=[],clippedUV=[],clippedAmbient=[];
 screen.cameraW=out.map(a=>a[3]);
 out.forEach((a,i)=>{
  screen.set([(a[0]/a[3]*.5+.5)*pass.w,(.5-a[1]/a[3]*.5)*pass.h,a[2]/a[3]],i*3);
  wpos.push(...a.slice(4,7));light.push(...a.slice(7,10));clippedUV.push(a[10],a[11]);clippedAmbient.push(a[12]);
 });
 const indices=polygon?(out.length===4?[0,1,2,0,2,3]:[0,1,2]):[0,1];
 paint(pass,screen,indices,{...d,canopyLight:null,chunkBounds:null,localVisibility:null,ambient:d.ambient?clippedAmbient:null,figureLight:d.figureLight?out.map(a=>a[13]):null,contactFade:d.contactFade?out.map(a=>a[14]):null,widths:d.widths&&!polygon?[d.widths[offsets[0]/3],d.widths[offsets[1]/3]]:null,start:0,count:indices.length,kind:polygon?'tri':'segments'},lightCoords?light:null,wpos,uv?clippedUV:null);
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
  const density=pass.inkProjection/cw,px=d.widths[a/3]*d.worldScale*density;
  const t=Math.min(1,Math.max(0,(px-1)/3));
  const f=Math.min(1,Math.max(0,(density-.7)/4.3));
  alpha*=t*t*(3-2*t)*(.42+.58*f*f*(3-2*f));
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
// Draw cutouts before writing depth in both the eye and sun passes. The
// architecture's general material shader never samples the foliage mask.
function rasterLeaf(pass,coords,a,b,c,light,leaf,scan,uv,tones){
 const [xmin,xmax,ymin,ymax,A,B,C,D]=scan;
 const [baseU,baseV,aU,aV,bU,bV,cutoff]=uv;
 const [red,green,blue,fill,fillU,fillV,key,keyU,keyV,slopeX,slopeY]=tones;
 const {w,depth,pixels}=pass,cx=coords[c],cy=coords[c+1];
 const perspective=!!coords.cameraW;
 const aw=perspective?1/coords.cameraW[a/3]:1,bw=perspective?1/coords.cameraW[b/3]:1,cw=perspective?1/coords.cameraW[c/3]:1;
 const baseZ=coords[c+2],zU=coords[a+2]-baseZ,zV=coords[b+2]-baseZ;
 for(let y=ymin;y<=ymax;y++){
  let u=A*(xmin+.5-cx)+B*(y+.5-cy),v=C*(xmin+.5-cx)+D*(y+.5-cy);
  let first=xmin,last=xmax;
  if(xmax-xmin>16){
   const t=1-u-v,S=-A-C;
   let lo=0,hi=xmax-xmin;
   if(A>0)lo=Math.max(lo,(-.00001-u)/A);else if(A<0)hi=Math.min(hi,(-.00001-u)/A);
   if(C>0)lo=Math.max(lo,(-.00001-v)/C);else if(C<0)hi=Math.min(hi,(-.00001-v)/C);
   if(S>0)lo=Math.max(lo,(-.00001-t)/S);else if(S<0)hi=Math.min(hi,(-.00001-t)/S);
   const skip=Math.max(0,Math.ceil(lo));if(skip>hi)continue;
   first+=skip;last=Math.min(last,xmin+Math.floor(hi));u+=A*skip;v+=C*skip;
  }
  for(let x=first;x<=last;x++,u+=A,v+=C){
   const t=1-u-v;if(u<-.00001||v<-.00001||t<-.00001)continue;
   const p=y*w+x,z=baseZ+u*zU+v*zV;if(z< -1||z>1||z>=depth[p])continue;
   let i=u,j=v;
   if(perspective){const inv=1/(i*aw+j*bw+t*cw);i*=aw*inv;j*=bw*inv;}
   if(leaf){
    const sx=(baseU+i*aU+j*bU)|0,sy=(baseV+i*aV+j*bV)|0;
    if(leaf.leafAlpha[(sy&(leaf.height-1))*leaf.width+(sx&(leaf.width-1))]<cutoff)continue;
   }
   depth[p]=z;if(!pixels)continue;
   let sun=key+i*keyU+j*keyV;
   if(light&&sun>0){
    const k=1-i-j;
    sun*=1-shadowCoverage(pass.shadowDepth,pass.ss,
     i*light[a]+j*light[b]+k*light[c],i*light[a+1]+j*light[b+1]+k*light[c+1],
     i*light[a+2]+j*light[b+2]+k*light[c+2],slopeX,slopeY);
   }
   const shade=fill+i*fillU+j*fillV+sun,off=4*p;
   pixels[off]=shade*red;pixels[off+1]=shade*green;pixels[off+2]=shade*blue;
  }
 }
}
function paintLeaves(pass,coords,indices,d,light,world,uv){
 const {pixels,dir}=pass,levels=d.finishTile,cutoff=d.alphaTest*255;
 for(let i=d.start,end=i+d.count;i<end;i+=3){
  const a=3*(indices?indices[i]:i),b=3*(indices?indices[i+1]:i+1),c=3*(indices?indices[i+2]:i+2);
  const colors=d.finishes;
  const red=colors?colors[a]:255*d.color[0],green=colors?colors[a+1]:255*d.color[1],blue=colors?colors[a+2]:255*d.color[2];
  if(coords.clip){
   const wa=coords.cameraW[a/3],wb=coords.cameraW[b/3],wc=coords.cameraW[c/3];
   if(wa<pass.near||wb<pass.near||wc<pass.near){
    if(wa>=pass.near||wb>=pass.near||wc>=pass.near)
     drawNearClipped(pass,coords,[a,b,c],colors?{...d,finishes:null,color:[red/255,green/255,blue/255]}:d,light,world,uv);
    continue;
   }
  }
  const ax=coords[a],ay=coords[a+1],bx=coords[b],by=coords[b+1],cx=coords[c],cy=coords[c+1];
  const den=(by-cy)*(ax-cx)+(cx-bx)*(ay-cy);
  if(Math.abs(den)<.000001||(den<0)===d.flipped)continue;
  const xmin=Math.max(0,Math.floor(Math.min(ax,bx,cx))),xmax=Math.min(pass.w-1,Math.ceil(Math.max(ax,bx,cx)));
  const ymin=Math.max(0,Math.floor(Math.min(ay,by,cy))),ymax=Math.min(pass.h-1,Math.ceil(Math.max(ay,by,cy)));
  if(xmax<xmin||ymax<ymin)continue;
  const A=(by-cy)/den,B=(cx-bx)/den,C=(cy-ay)/den,D=(ax-cx)/den,ia=2*(a/3),ib=2*(b/3),ic=2*(c/3);
  const mip=leafMip(levels,uv,ia,ib,ic,A,B,C,D);if(mip.maxAlpha<cutoff)continue;
  let leaf=null,baseU=0,baseV=0,aU=0,aV=0,bU=0,bV=0;
  if(mip.minAlpha<cutoff){
   baseU=mip.width*uv[ic];baseV=mip.height*uv[ic+1];
   aU=mip.width*(uv[ia]-uv[ic]);aV=mip.height*(uv[ia+1]-uv[ic+1]);
   bU=mip.width*(uv[ib]-uv[ic]);bV=mip.height*(uv[ib+1]-uv[ic+1]);
   if(aU||aV||bU||bV)leaf=mip;
   else if(mip.leafAlpha[(baseV|0)*mip.width+(baseU|0)]<cutoff)continue;
  }
  let fill=0,fillU=0,fillV=0,sun=0,sunU=0,sunV=0,slopeX=0,slopeY=0;
  if(pixels){
   const ux=world[b]-world[a],uy=world[b+1]-world[a+1],uz=world[b+2]-world[a+2],vx=world[c]-world[a],vy=world[c+1]-world[a+1],vz=world[c+2]-world[a+2];
   const nx=uy*vz-uz*vy,ny=uz*vx-ux*vz,nz=ux*vy-uy*vx,inv=1/(Math.sqrt(nx*nx+ny*ny+nz*nz)||1);
   const sky=pass.skyGain*(.93+.07*ny*inv),ambient=d.ambient;
   fill=sky;
   if(ambient){const strength=.50*sky/255,base=ambient[c/3];fill+=strength*(base-255);fillU=strength*(ambient[a/3]-base);fillV=strength*(ambient[b/3]-base);}
   if(d.canopyLight){sun=d.canopyLight[c/3];sunU=d.canopyLight[a/3]-sun;sunV=d.canopyLight[b/3]-sun;}
   else sun=Math.sqrt(sky*sky+pass.keyGain*Math.max(0,inv*(nx*dir[0]+ny*dir[1]+nz*dir[2])))-sky;
   if(light&&d.receive){
    const dx=light[b]-light[a],dy=light[b+1]-light[a+1],ex=light[c]-light[a],ey=light[c+1]-light[a+1],det=dx*ey-ex*dy;
    if(Math.abs(det)>1e-8){
     const dz=light[b+2]-light[a+2],ez=light[c+2]-light[a+2];
     slopeX=(dz*ey-ez*dy)/det;slopeY=(dx*ez-ex*dz)/det;
    }
   }
  }
  rasterLeaf(pass,coords,a,b,c,d.receive?light:null,leaf,[xmin,xmax,ymin,ymax,A,B,C,D],
   [baseU,baseV,aU,aV,bU,bV,cutoff],[red,green,blue,fill,fillU,fillV,sun,sunU,sunV,slopeX,slopeY]);
 }
}
function paint(pass,coords,indices,d,lightCoords,world,uv){
 if(d.cutoutTrees&&d.finishTile&&uv){paintLeaves(pass,coords,indices,d,lightCoords,world,uv);return;}
 paintSurfaces(pass,coords,indices,d,lightCoords,world,uv);
}
function paintSurfaces(pass,coords,indices,d,lightCoords,world,uv){
 const {w,h,depth,pixels,shadowDepth,ss,dir}=pass;
 const end=d.start+d.count;
 const canopyLight=pixels&&d.canopyLight;
 const smoothLight=pixels&&d.figureLight,contact=pixels&&d.contactFade;
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
  const frontFacing=(den<0)!==d.flipped;
  if((pixels||pass.eyeDepth)&&((d.side===0&&!frontFacing)||(d.side===1&&frontFacing)))continue;
  const xmin=Math.max(0,Math.floor(Math.min(ax,bx,cx))),xmax=Math.min(w-1,Math.ceil(Math.max(ax,bx,cx))),ymin=Math.max(0,Math.floor(Math.min(ay,by,cy))),ymax=Math.min(h-1,Math.ceil(Math.max(ay,by,cy)));
  if(xmax<xmin||ymax<ymin)continue;
  const inv=1/den,A=(by-cy)*inv,B=(cx-bx)*inv,C=(cy-ay)*inv,D=(ax-cx)*inv;
  const paving=pixels&&d.tile&&uv?pavingTriangle(d.tile,uv,coords,a,b,c,A,B,C,D):null;
  const photo=pixels&&d.finishTile&&uv?finishLevel(d.finishTile,uv,coords,a,b,c,A,B,C,D):null;
  const texel=photo?(d.alphaTest||d.sourceBlend?[255,255,255,255]:[255,255,255]):null;
  const volume=pixels&&d.proposal&&pass.volume;
  let reflection=null,fillLight=0,nx=0,ny=0,nz=0,largeFace=false;
  let crownBase=0,crownU=0,crownV=0;
  let lum=1, direct=0, sky=0, slopeX=0, slopeY=0, occlusion=0;
  const ambient=pixels?d.ambient:null;
  const ambientA=ambient?ambient[a/3]:255,ambientB=ambient?ambient[b/3]:255,ambientC=ambient?ambient[c/3]:255;
  const varied=ambientA!==ambientC||ambientB!==ambientC;
  if(pixels){
   const ux=world[b]-world[a],uy=world[b+1]-world[a+1],uz=world[b+2]-world[a+2],vx=world[c]-world[a],vy=world[c+1]-world[a+1],vz=world[c+2]-world[a+2];
   nx=uy*vz-uz*vy;ny=uz*vx-ux*vz;nz=ux*vy-uy*vx;
   const invLength=1/(Math.sqrt(nx*nx+ny*ny+nz*nz)||1);nx*=invLength;ny*=invLength;nz*=invLength;
   const diffuse=Math.max(0,nx*dir[0]+ny*dir[1]+nz*dir[2]);
   const fill=pass.skyGain*(d.proposal ? .94+.06*ny : .93+.07*ny);
   fillLight=fill;
   // Small members share one local field sample. Large soffits and floors
   // sample across the triangle, retaining shadows between vertex positions.
   if(volume){
    largeFace=(xmax-xmin>8||ymax-ymin>8)&&Math.max(ux*ux+uy*uy+uz*uz,vx*vx+vy*vy+vz*vz)>volume.step*volume.step;
   }
   if(d.blendPane||d.reflective)reflection=triangleReflection(pass,world,a,b,c,nx,ny,nz,d.roughness??.4);
   // The worker shades sRGB colors. Combine sky and sun in approximate
   // linear light once per triangle; only the solar component is occluded.
   direct=Math.sqrt(fill*fill+pass.keyGain*diffuse)-fill;
   if(canopyLight){
    crownBase=canopyLight[c/3];crownU=canopyLight[a/3]-crownBase;crownV=canopyLight[b/3]-crownBase;
    direct=crownBase+(crownU+crownV)/3;
   }
   occlusion=.50*fill;
   lum=fill+direct-occlusion*(1-ambientC/255);
   if(lightCoords&&d.receive&&(direct>0||smoothLight)){
    const du=lightCoords[b]-lightCoords[a],dv=lightCoords[b+1]-lightCoords[a+1],
          eu=lightCoords[c]-lightCoords[a],ev=lightCoords[c+1]-lightCoords[a+1];
    const determinant=du*ev-eu*dv;
    if(Math.abs(determinant)>1e-8){
     const dz=lightCoords[b+2]-lightCoords[a+2],ez=lightCoords[c+2]-lightCoords[a+2];
     slopeX=(dz*ev-ez*dv)/determinant;slopeY=(du*ez-eu*dz)/determinant;
    }
   }
   if(d.glass){
    let [ex,ey,ez]=pass.eyeDirection;
    if(pass.near){
     ex=pass.eye[0]-(world[a]+world[b]+world[c])/3;
     ey=pass.eye[1]-(world[a+1]+world[b+1]+world[c+1])/3;
     ez=pass.eye[2]-(world[a+2]+world[b+2]+world[c+2])/3;
     const length=Math.hypot(ex,ey,ez)||1;ex/=length;ey/=length;ez/=length;
    }
    const cosine=ex*nx+ey*ny+ez*nz,reflectionY=2*cosine*ny-ey;
    const grazing=1-Math.min(1,Math.abs(cosine)),height=Math.min(1,Math.max(0,(reflectionY+.15)/.8));
    sky=(.045+.20*grazing**3)*(.24+.60*height*height*(3-2*height))*110;
   }
  }
  const centerVisibility=volume&&!largeFace?(d.localVisibility?.[i/3]||visibility(volume,(world[a]+world[b]+world[c])/3,
   (world[a+1]+world[b+1]+world[c+1])/3,(world[a+2]+world[b+2]+world[c+2])/3,nx,ny,nz,d.openCanopy)):1;
  if(volume&&!largeFace&&d.localVisibility)d.localVisibility[i/3]=centerVisibility;
  const wet=d.blendPane,frosted=d.finish==='frosted',glazeTint=wet?Math.min(.85,d.alpha)*(frosted ? .87 : .42):0;
  const wide=xmax-xmin>20;
  const slopeT=-A-C,invA=1/A,invC=1/C,invT=1/slopeT;
  const aw=coords.cameraW?1/coords.cameraW[a/3]:1,bw=coords.cameraW?1/coords.cameraW[b/3]:1,cw=coords.cameraW?1/coords.cameraW[c/3]:1;
  for(let y=ymin;y<=ymax;y++){
   let nextSample=-1,sample=1,sampleStep=0;
   const dy=y+.5-cy;let u=A*(xmin+.5-cx)+B*dy,v=C*(xmin+.5-cx)+D*dy;
   let first=xmin,last=xmax;
   if(wide){
    // Intersect the scanline with the triangle's three half-planes. Round
    // outwards, then use the original coverage test at the pixel centres.
    const t=1-u-v;
    let lo=0,hi=xmax-xmin;
    if(A>0)lo=Math.max(lo,(-.00001-u)*invA);else if(A<0)hi=Math.min(hi,(-.00001-u)*invA);
    if(C>0)lo=Math.max(lo,(-.00001-v)*invC);else if(C<0)hi=Math.min(hi,(-.00001-v)*invC);
    if(slopeT>0)lo=Math.max(lo,(-.00001-t)*invT);else if(slopeT<0)hi=Math.min(hi,(-.00001-t)*invT);
    const skip=Math.max(0,Math.floor(lo)-1);
    if(skip>hi+1)continue;
    first+=skip;last=Math.min(xmax,xmin+Math.ceil(hi)+1);
    // Match the incremental depth and colour rounding at shared edges.
    for(let off=0;off<skip;off++){u+=A;v+=C;}
   }
   for(let x=first;x<=last;x++,u+=A,v+=C){
    const t=1-u-v;if(u<-.00001||v<-.00001||t<-.00001)continue;
    const z=u*coords[a+2]+v*coords[b+2]+t*coords[c+2];const p=y*w+x;
    if(z< -1||z>1||z>=depth[p])continue;
    if(pixels&&!contact&&!wet&&d.alpha<.98&&((x*13+y*7)%17)>=d.alpha*17)continue;
    if(!pixels){depth[p]=z;continue;}let shade=lum;
    const hasShadow=lightCoords&&d.receive&&(direct>0||smoothLight);
    let l0=u,l1=v,l2=t;
    if(coords.cameraW&&(photo||reflection||largeFace||hasShadow||varied||smoothLight||contact)){
     l0*=aw;l1*=bw;l2*=cw;
     const invW=1/(l0+l1+l2);l0*=invW;l1*=invW;l2*=invW;
    }
    if(varied)shade+=occlusion/255*(l0*(ambientA-ambientC)+l1*(ambientB-ambientC));
    if(contact){
     const alpha=d.alpha*(l0*contact[a/3]+l1*contact[b/3]+l2*contact[c/3]);
     for(let k=0;k<3;k++)pixels[p*4+k]+=alpha*(d.color[k]*255-pixels[p*4+k]);
     continue;
    }
    let key=direct;
    if(canopyLight){key=crownBase+l0*crownU+l1*crownV;shade+=key-direct;}
    if(smoothLight){
     const diffuse=l0*smoothLight[a/3]+l1*smoothLight[b/3]+l2*smoothLight[c/3];
     key=Math.sqrt(fillLight*fillLight+pass.keyGain*diffuse)-fillLight;
     shade+=key-direct;
    }
    if(hasShadow){
     const lx=l0*lightCoords[a]+l1*lightCoords[b]+l2*lightCoords[c];
     const ly=l0*lightCoords[a+1]+l1*lightCoords[b+1]+l2*lightCoords[c+1];
     const lz=l0*lightCoords[a+2]+l1*lightCoords[b+2]+l2*lightCoords[c+2];
     const blocked=key*shadowCoverage(shadowDepth,ss,lx,ly,lz,slopeX,slopeY);shade-=blocked;key-=blocked;
    }
    if(volume){
     let skyVis=centerVisibility;
     if(largeFace){
      if(x>=nextSample){
       const here=visibility(volume,l0*world[a]+l1*world[b]+l2*world[c],l0*world[a+1]+l1*world[b+1]+l2*world[c+1],l0*world[a+2]+l1*world[b+2]+l2*world[c+2],nx,ny,nz,d.openCanopy);
       const span=Math.max(1,Math.min(6,xmax-x+1));
       let e0=u+span*A,e1=v+span*C,e2=1-e0-e1;
       if(coords.cameraW){
        e0*=aw;e1*=bw;e2*=cw;
        const invW=1/(e0+e1+e2);e0*=invW;e1*=invW;e2*=invW;
       }
       const end=visibility(volume,e0*world[a]+e1*world[b]+e2*world[c],e0*world[a+1]+e1*world[b+1]+e2*world[c+1],e0*world[a+2]+e1*world[b+2]+e2*world[c+2],nx,ny,nz,d.openCanopy);
       sample=end;sampleStep=(end-here)/span;nextSample=x+span;
      }
      skyVis=sample-(nextSample-x)*sampleStep;
     }
     // The volume bakes indirect light in linear units; the worker's
     // display-space colours need the square-root response.
     shade-=fillLight*(1-Math.sqrt(.32+.68*skyVis));
    }
    const off=p*4;if(paving){depth[p]=z;pavingPixel(paving,u,v,shade,pixels,off);continue;}
    let rr=red,gg=green,bb=blue;
    if(smoothLight&&finish){
     rr=l0*red+l1*finish[b]+l2*finish[c];
     gg=l0*green+l1*finish[b+1]+l2*finish[c+1];
     bb=l0*blue+l1*finish[b+2]+l2*finish[c+2];
    }
    if(photo){
     const ua=(a/3)*2,ub=(b/3)*2,uc=(c/3)*2;
     imageSample(photo,uv[ua]*l0+uv[ub]*l1+uv[uc]*l2,uv[ua+1]*l0+uv[ub+1]*l1+uv[uc+1]*l2,texel);
     if(texel.length===4){
      const coverage=texel[3]*d.alpha/255;
      if(coverage<(d.alphaTest||0)||(!wet&&d.sourceBlend&&((x*13+y*7)%17)>=coverage*17))continue;
     }
     rr*=texel[0]/255;gg*=texel[1]/255;bb*=texel[2]/255;
    }
    if(d.proposal){
     // Slightly cooler sky fill and warmer sun leave material hue legible
     // when the sun angle or the separate light/dark sliders change.
     const indirect=shade-key,bounce=Math.max(0,-ny)*indirect;
     rr*=shade-.035*indirect+.035*key+.075*bounce;
     gg*=shade;
     bb*=shade+.045*indirect-.065*key-.035*bounce;
    }else{
     rr=rr*shade+sky*.82;gg=gg*shade+sky;bb=bb*shade+sky*1.12;
    }
    if(reflection){
     const grazing=sampleReflection(reflection,l0,l1,l2),env=reflection.color;
     if(wet){
      // Colour the view through the pane, then reflect the daylight at this
      // viewing angle. Use the solid scene once even on closed double skins.
      const base=pass.opaque;
      const R=(frosted ? .085 : .065)+(frosted ? .44 : .9)*grazing,through=1-R;
      rr=through*(base[off]*(1-glazeTint)*.96+rr*glazeTint)+R*env[0];
      gg=through*(base[off+1]*(1-glazeTint)*.99+gg*glazeTint)+R*env[1];
      bb=through*(base[off+2]*(1-glazeTint)+bb*glazeTint)+R*env[2];
     }else{
      const strength=Math.min(.90,(.07+.48*(d.metalness??0)+.32*grazing)*(1-.45*(d.roughness??.4))*d.reflectionMix);
      rr+=strength*(env[0]-rr);gg+=strength*(env[1]-gg);bb+=strength*(env[2]-bb);
     }
    }
    depth[p]=z;pixels[off]=rr;pixels[off+1]=gg;pixels[off+2]=bb;
   }
  }
 }
}
const identity=[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1];
// GLBs batch many small solids into a few draws. Test small contiguous
// index ranges against the six camera planes before visiting their faces.
const chunkIndices=192;
function meshBounds(g){
 const {xyz,index}=g,number=index?.length??xyz.length/3;
 const stride=g.treeStride||chunkIndices;
 const bounds=new Float32Array(Math.ceil(number/stride)*6);
 for(let i=0,offset=0;i<number;i+=stride,offset+=6){
  let xmin=Infinity,ymin=Infinity,zmin=Infinity,xmax=-Infinity,ymax=-Infinity,zmax=-Infinity;
  for(let j=i,end=Math.min(number,i+stride);j<end;j++){
   const k=3*(index?index[j]:j),x=xyz[k],y=xyz[k+1],z=xyz[k+2];
   if(x<xmin)xmin=x;if(x>xmax)xmax=x;if(y<ymin)ymin=y;if(y>ymax)ymax=y;if(z<zmin)zmin=z;if(z>zmax)zmax=z;
  }
  bounds.set([xmin,ymin,zmin,xmax,ymax,zmax],offset);
 }
 return bounds;
}
// Project just the vertices referenced by visible primitive runs. One scratch
// buffer serves the whole camera pass; shadow coordinates remain independent.
let screenSpace,vertexStamp,drawStamp=0;
function projectRun(g,m,w,h,perspective,start,end){
 const xyz=g.xyz,index=g.index;
 for(let j=start;j<end;j++){
  const k=index?index[j]:j;if(vertexStamp[k]===drawStamp)continue;
  vertexStamp[k]=drawStamp;
  const i=3*k,x=xyz[i],y=xyz[i+1],z=xyz[i+2];
  const cx=m[0]*x+m[4]*y+m[8]*z+m[12],cy=m[1]*x+m[5]*y+m[9]*z+m[13],cz=m[2]*x+m[6]*y+m[10]*z+m[14];
  let cw=1;
  if(perspective){
   cw=m[3]*x+m[7]*y+m[11]*z+m[15];screenSpace.cameraW[k]=cw;
   screenSpace.clip[i]=cx;screenSpace.clip[i+1]=cy;screenSpace.clip[i+2]=cz;
  }
  screenSpace[i]=(cx/cw*.5+.5)*w;screenSpace[i+1]=(.5-cy/cw*.5)*h;screenSpace[i+2]=cz/cw;
 }
}
function prepareScreen(length,perspective){
 if(!screenSpace||screenSpace.length<length){
  screenSpace=new Float64Array(length);vertexStamp=new Uint32Array(length/3);
  screenSpace.cameraDepth=new Float64Array(length/3);screenSpace.clipPositions=new Float64Array(length);
 }
 if(++drawStamp>0xffffffff){vertexStamp.fill(0);drawStamp=1;}
 screenSpace.clip=perspective?screenSpace.clipPositions:null;
 screenSpace.cameraW=perspective?screenSpace.cameraDepth:null;
}
// Capture the farthest covered pixel in each tile. A single uncovered pixel
// keeps the entire tile open, so windows, stair openings and gaps stay visible.
const tileSize=16;
function rememberDepth(pass){
 const {w,h,depth}=pass,cols=Math.ceil(w/tileSize),rows=Math.ceil(h/tileSize);
 const all=pass.coverage??=new Float64Array(cols*rows);
 all.fill(-Infinity);
 for(let y=0;y<h;y++){
  const row=Math.floor(y/tileSize)*cols;
  for(let x=0;x<w;x+=tileSize){
   const k=row+Math.floor(x/tileSize);
   let far=all[k];if(far===Infinity)continue;
   for(let i=y*w+x,end=i+Math.min(tileSize,w-x);i<end;i++){
    if(depth[i]>far){far=depth[i];if(far===Infinity)break;}
   }
   all[k]=far;
  }
 }
}
function behindDepth(pass,b,k,m){
 let left=Infinity,bottom=Infinity,right=-Infinity,top=-Infinity,nearest=Infinity;
 for(let i=0;i<8;i++){
  const x=b[k+(i&1?3:0)],y=b[k+(i&2?4:1)],z=b[k+(i&4?5:2)];
  const w=m[3]*x+m[7]*y+m[11]*z+m[15];if(w<=pass.near)return false;
  const sx=(m[0]*x+m[4]*y+m[8]*z+m[12])/w,sy=(m[1]*x+m[5]*y+m[9]*z+m[13])/w;
  nearest=Math.min(nearest,(m[2]*x+m[6]*y+m[10]*z+m[14])/w);
  left=Math.min(left,sx);right=Math.max(right,sx);bottom=Math.min(bottom,sy);top=Math.max(top,sy);
 }
 const cols=Math.ceil(pass.w/tileSize),rows=Math.ceil(pass.h/tileSize);
 const x0=Math.max(0,Math.floor(((left+1)*.5*pass.w-1)/tileSize));
 const x1=Math.min(cols-1,Math.floor(((right+1)*.5*pass.w+1)/tileSize));
 const y0=Math.max(0,Math.floor(((1-top)*.5*pass.h-1)/tileSize));
 const y1=Math.min(rows-1,Math.floor(((1-bottom)*.5*pass.h+1)/tileSize));
 for(let y=y0;y<=y1;y++)for(let x=x0;x<=x1;x++){
  if(nearest<=pass.coverage[y*cols+x]+1e-6)return false;
 }
 return true;
}
function paintVisible(pass,g,d,transform,light,world){
 const frustum=planes(transform);
 if(outside(g.bounds,0,frustum))return;
 const stride=g.treeStride||chunkIndices;
 const testDepth=pass.coverage&&d.kind==='tri'&&d.count>=chunkIndices;
 if(testDepth&&behindDepth(pass,g.bounds,0,transform))return;
 if(g.treeStride&&g.normals){
  // Static canopy normals and a uniform node scale allow one light bake per sun
  // setting. Moving the eye reuses these values for all street trees.
  const m=d.m,[sx,sy,sz]=pass.dir,scale=1/Math.hypot(m[0],m[1],m[2]);
  const x=(sx*m[0]+sy*m[1]+sz*m[2])*scale,y=(sx*m[4]+sy*m[5]+sz*m[6])*scale,z=(sx*m[8]+sy*m[9]+sz*m[10])*scale;
  if(g.sunX!==x||g.sunY!==y||g.sunZ!==z||g.sky!==pass.skyGain||g.sun!==pass.keyGain){
   const n=g.normals,light=g.canopyLight??=new Float32Array(n.length/3);
   for(let i=0;i<light.length;i++){
    const diffuse=Math.max(0,x*n[3*i]+y*n[3*i+1]+z*n[3*i+2]);
    light[i]=Math.sqrt(pass.skyGain*pass.skyGain+pass.keyGain*diffuse)-pass.skyGain;
   }
   g.sunX=x;g.sunY=y;g.sunZ=z;g.sky=pass.skyGain;g.sun=pass.keyGain;
  }
  d.canopyLight=g.canopyLight;
 }else if(g.normals){
  // The figure has rigid, unit-scale joint transforms. Rotate the sun into
  // each joint's frame once, then interpolate its vertex lighting on screen.
  const n=g.normals,m=d.m,[sx,sy,sz]=pass.dir;
  const x=sx*m[0]+sy*m[1]+sz*m[2],y=sx*m[4]+sy*m[5]+sz*m[6],z=sx*m[8]+sy*m[9]+sz*m[10];
  const light=g.figureLight??=new Float32Array(n.length/3);
  for(let i=0;i<light.length;i++)light[i]=Math.max(0,x*n[3*i]+y*n[3*i+1]+z*n[3*i+2]);
  d.figureLight=light;
 }
 const near=!!pass.near,start=d.start,end=start+d.count;
 const uv=d.tile?g.paving.coords:d.finishTile?transformedUV(g,d):null;
 prepareScreen(g.xyz.length,near);
 // Keep connected line strips and non-aligned authored primitive groups intact.
 const primitive=d.kind==='tri'?3:d.kind==='segments'?2:d.kind==='point'?1:0;
 if(!primitive||start%primitive){
  projectRun(g,transform,pass.w,pass.h,near,start,end);
  paint(pass,screenSpace,g.index,d,light,world,uv);return;
 }
 let visibleStart=-1;
 for(let i=start;i<end;){
  const block=Math.floor(i/stride),next=Math.min(end,(block+1)*stride);
  if(!outside(g.chunkBounds,6*block,frustum)&&!(testDepth&&behindDepth(pass,g.chunkBounds,6*block,transform))){
   if(visibleStart<0)visibleStart=i;
   projectRun(g,transform,pass.w,pass.h,near,i,next);
  }else if(visibleStart>=0){
   d.start=visibleStart;d.count=i-visibleStart;paint(pass,screenSpace,g.index,d,light,world,uv);visibleStart=-1;
  }
  i=next;
 }
 if(visibleStart>=0){d.start=visibleStart;d.count=end-visibleStart;paint(pass,screenSpace,g.index,d,light,world,uv);}
 d.start=start;d.count=end-start;
}
function planes(m){
 const result=[];
 for(let axis=0;axis<3;axis++)for(const sign of [-1,1]){
  const x=m[3]+sign*m[axis],y=m[7]+sign*m[4+axis],z=m[11]+sign*m[8+axis];
  result.push([x,y,z,m[15]+sign*m[12+axis],x<0?0:3,y<0?1:4,z<0?2:5]);
 }
 return result;
}
function outside(bounds,offset,frustum){
 for(const p of frustum){
  if(p[0]*bounds[offset+p[4]]+p[1]*bounds[offset+p[5]]+p[2]*bounds[offset+p[6]]+p[3]<-.00005)return true;
 }
 return false;
}
function sameMatrix(a,b){return !!a&&a.every((x,i)=>x===b[i]);}
function paintStreetSky(pixels,w,h,view){
 const world=view.world,[fx,fy,offsetX,offsetY]=view.projection;
 // Raycast a sparse grid through the camera and interpolate adjacent samples
 // along each scanline. The equirectangular lookup wraps across due west.
 const stepX=Math.max(4,Math.min(16,Math.floor(w/60)));
 const stepY=Math.max(2,Math.min(6,Math.floor(h/60)));
 const columns=Math.ceil(w/stepX)+1, rgb=[0,0,0];
 let upper=new Float32Array(3*columns),lower=new Float32Array(3*columns);
 function sampleRow(y,colors){
  const sy=(1-2*(y+.5)/h+offsetY)/fy;
  const bx=world[4]*sy-world[8],by=world[5]*sy-world[9],bz=world[6]*sy-world[10];
  for(let j=0;j<columns;j++){
   const sx=(2*(j*stepX+.5)/w-1+offsetX)/fx;
   const dx=bx+world[0]*sx,dy=by+world[1]*sx,dz=bz+world[2]*sx;
   const u=.5+Math.atan2(dz,dx)/(2*Math.PI),v=.5+Math.atan2(dy,Math.sqrt(dx*dx+dz*dz))/Math.PI;
   imageSample(streetSky,u,v,rgb,true);
   colors[3*j]=rgb[0];colors[3*j+1]=rgb[1];colors[3*j+2]=rgb[2];
  }
 }
 sampleRow(0,lower);
 for(let y=0;y<h;y++){
  const row=y%stepY;
  if(!row){
   const swap=upper;upper=lower;lower=swap;
   sampleRow(y+stepY,lower);
  }
  const t=row/stepY;
  let r=upper[0]+t*(lower[0]-upper[0]),g=upper[1]+t*(lower[1]-upper[1]),b=upper[2]+t*(lower[2]-upper[2]);
  let i=4*y*w;
  for(let x=0,j=3;x<w;x+=stepX,j+=3){
   const r1=upper[j]+t*(lower[j]-upper[j]),g1=upper[j+1]+t*(lower[j+1]-upper[j+1]),b1=upper[j+2]+t*(lower[j+2]-upper[j+2]);
   const dr=(r1-r)/stepX,dg=(g1-g)/stepX,db=(b1-b)/stepX;
   const end=i+4*Math.min(stepX,w-x);
   for(;i<end;i+=4){
    pixels[i]=r;pixels[i+1]=g;pixels[i+2]=b;pixels[i+3]=255;
    r+=dr;g+=dg;b+=db;
   }
   r=r1;g=g1;b=b1;
  }
 }
}
function refitBounds(g){
  g.chunkBounds=meshBounds(g);
  g.bounds=[Infinity,Infinity,Infinity,-Infinity,-Infinity,-Infinity];
  for(let i=0;i<g.chunkBounds.length;i+=6)for(let k=0;k<3;k++){
   g.bounds[k]=Math.min(g.bounds[k],g.chunkBounds[i+k]);g.bounds[k+3]=Math.max(g.bounds[k+3],g.chunkBounds[i+k+3]);
  }
}
onmessage=({data:q})=>{
 for(const id of q.removedTiles||[])finishTiles.delete(id);
 for(const tile of q.tiles||[]){
  const levels=imagePyramid(tile);
  if(tile.leafMask)prepareLeafMask(levels);
  finishTiles.set(tile.id,levels);
 }
 if(q.resources?.volume)lightVolume=prepareVolume(q.resources.volume);
 if(q.resources?.environment)daylight=imagePyramid(q.resources.environment);
 if(q.resources?.streetSky)streetSky=q.resources.streetSky;
 for(const k of q.removed)geometries.delete(k);for(const g of q.fresh){
  if(g.paving)g.paving.levels=pavingMips(g.paving);
  refitBounds(g);
  geometries.set(g.id,g);
 }
 for(const {id,xyz,normals} of q.deformed||[]){
  const g=geometries.get(id);if(!g)continue;
  g.xyz=xyz;g.normals=normals;g.worldMatrix=null;refitBounds(g);
 }
 const ss=shadowSize,shadowDepth=cachedShadow;
 const objs=q.draws.map(d=>{
  const g=geometries.get(d.id),m=d.m,xyz=g.xyz;
  // During an orbit only the eye changes; district/world and light coordinates
  // remain valid until an object's transform or the light projection changes.
  if(!sameMatrix(g.worldMatrix,m)){
   g.worldMatrix=m;
   g.world=sameMatrix(identity,m)?xyz:new Float32Array(xyz.length);
   if(g.world!==xyz)for(let i=0;i<xyz.length;i+=3){
    const x=xyz[i],y=xyz[i+1],z=xyz[i+2];
    g.world[i]=m[0]*x+m[4]*y+m[8]*z+m[12];
    g.world[i+1]=m[1]*x+m[5]*y+m[9]*z+m[13];
    g.world[i+2]=m[2]*x+m[6]*y+m[10]*z+m[14];
   }
   g.lightMatrix=null;g.light=null;
  }
  const lit=q.shadow&&(d.cast||d.receive);
  if(lit&&!sameMatrix(g.lightMatrix,q.shadow)){
   g.lightMatrix=q.shadow;g.light=project(xyz,multiply(q.shadow,m),ss,ss);
  }
  d.blendPane=(d.finish==='glass'||d.finish==='frosted'||d.reflection==='glass')&&d.alpha<.995;
  d.reflectionMix=Math.min(3,Math.max(.2,d.reflectionGain??1));
  d.reflective=(d.reflection==='metal'||d.finish==='pv'||d.finish==='zinc')&&!!q.useEnvironment;
  d.finishTile=finishTiles.get(d.tileID);
  d.flipped=m[0]*(m[5]*m[10]-m[6]*m[9])-m[4]*(m[1]*m[10]-m[2]*m[9])+m[8]*(m[1]*m[6]-m[2]*m[5])<0;
  if(q.useVolume&&d.proposal&&d.kind==='tri'){
   if(g.visibilityField!==lightVolume||g.visibilityTransform!==g.worldMatrix){
    g.visibilityField=lightVolume;g.visibilityTransform=g.worldMatrix;
    g.localVisibility=new Float32Array(Math.ceil((g.index?.length||g.xyz.length/3)/3));
   }
   d.localVisibility=g.localVisibility;
  }
  if(g.contactFade)d.contactFade=g.contactFade;
  if(d.baked)d.ambient=g.ambient;
  if(d.paving)d.tile=g.paving;
  if(d.vertexColors)d.finishes=g.finishes;
  if(g.widths){d.widths=g.widths;d.worldScale=Math.hypot(m[0],m[1],m[2]);}
  return {d,g,world:g.world,l:lit?g.light:null};
 });
 if(q.shadow&&q.updateShadow){
  shadowDepth.fill(Infinity);
  for(const {d,g,l} of objs)if(d.cast&&!d.blendPane)paint({w:ss,h:ss,depth:shadowDepth},l,g.index,d,null,null,d.cutoutTrees&&d.finishTile?transformedUV(g,d):null);
 }
 const pixels=new Uint8ClampedArray(q.w*q.h*4);
 if(q.streetView&&streetSky)paintStreetSky(pixels,q.w,q.h,q.streetView);
 else for(let y=0;y<q.h;y++){
  let r=q.background[0]*255,g=q.background[1]*255,b=q.background[2]*255;
  if(q.skyRow){
   const [forward,up,offset,invFocal]=q.skyRow,slope=(1-2*(y+.5)/q.h+offset)*invFocal;
   const elevation=(forward+up*slope)/Math.sqrt(1+slope*slope),below=Math.max(0,-elevation);
   const h=Math.max(0,Math.min(1,elevation)),t=Math.min(1,2*h),z=Math.max(0,2*h-1);
   r=231-71*t-46*z-15*below;g=233-37*t-38*z-16*below;b=230-9*t-26*z-19*below;
  }
  for(let i=4*y*q.w,end=i+4*q.w;i<end;i+=4){pixels[i]=r;pixels[i+1]=g;pixels[i+2]=b;pixels[i+3]=255;}
 }
 const pass={volume:q.useVolume?lightVolume:null,environment:q.useEnvironment?daylight:null,w:q.w,h:q.h,depth:new Float64Array(q.w*q.h).fill(Infinity),pixels,shadowDepth,ss,eye:q.eye,eyeDirection:q.eyeDirection,dir:q.dir,skyGain:Math.sqrt(.33*q.skyPower),keyGain:.21*q.sunPower,near:q.perspectiveNear,inkProjection:q.inkProjection};
 // Resolve solid depth before compositing visible linework.
 const order=d=>d.kind!=='tri'?3:d.blendPane?2:d.contactFade?1:0;
 objs.sort((a,b)=>order(a.d)-order(b.d));
 // Indoors, rasterize the depths of opaque walls and slabs first. The colour
 // pass keeps its authored order, including surfaces at the same depth.
 if(q.insideProject&&pass.near&&objs.some(({d})=>d.solidShell)){
  const prepass={w:q.w,h:q.h,depth:pass.depth,near:pass.near,eyeDepth:true};
  for(const {d,g,world} of objs){
   if(d.solidShell)paintVisible(prepass,g,{...d,finishTile:null},multiply(q.view,d.m),null,world);
  }
  // Bias only this provisional buffer. The normal colour/depth pass resolves
  // the exact nearest surface and coplanar ties with its original precision.
  for(let i=0;i<pass.depth.length;i++)pass.depth[i]+=1e-6;
  rememberDepth(pass);
 }
 let drawn=0;
 const useCoverage=pass.near&&objs.length>48;
 for(const {d,g,l,world} of objs){
  if(useCoverage&&(drawn===Math.floor(objs.length*.22)||drawn===Math.floor(objs.length*.52)))rememberDepth(pass);
  drawn++;
  if(d.blendPane&&!pass.opaque)pass.opaque=pixels.slice();
  const transform=multiply(q.view,d.m);
  paintVisible(pass,g,d,transform,l,world);
 }
 postMessage({w:q.w,h:q.h,buffer:pixels.buffer},[pixels.buffer]);
};
